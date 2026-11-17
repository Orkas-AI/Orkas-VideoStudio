import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { acquireLease } from './lease.js';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import * as canvas from './canvas.js';
import { canvasRevision, fileEditLock, isPathAllowed, studioContext } from './host.js';
import { NativeAgent, type AgentOptions } from './agent.js';
import { CanvasJobs, type CanvasJob } from './jobs.js';
import { connectOriginalConversation } from './conversation.js';
import { importTimelineAssets, withTimelineLock } from '../composition/timeline.js';

const JSON_LIMIT = 1024 * 1024;
const UPLOAD_LIMIT = 512 * 1024 * 1024;
const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.flac': 'audio/flac' };
const PUBLIC = new Set(['index.html', 'studio.js', 'studio.css', 'canvas.js', 'canvas.css', 'controls.js', 'icons.js', 'locales.json']);
function validEdit(value: any) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const id = (key: string) => typeof value[key] === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(value[key]);
  const text = (key: string) => typeof value[key] === 'string' && value[key].length <= 20_000;
  switch (value.kind) {
    case 'set_text': return id('video') && id('scene') && text('value') && text('slot') && !['__proto__', 'constructor', 'prototype'].includes(value.slot);
    case 'reorder': return id('video') && Array.isArray(value.order) && value.order.length <= 1000 && value.order.every((item: unknown) => typeof item === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(item));
    case 'remove_scene': return id('video') && id('scene');
    case 'restore_scene': return id('video') && id('removed');
    case 'set_narration': return id('video') && id('scene') && text('value');
    case 'set_voice': return id('video') && text('route_ref') && text('voice_ref');
    case 'add_scene': return id('video') && id('asset') && (value.after === undefined || id('after'));
    case 'swap_clip': return id('video') && id('scene') && id('asset') && (value.if_current === undefined || id('if_current'));
    case 'set_fact': return id('fact') && text('text');
    case 'remove_asset': case 'use_result': return id('asset');
    case 'replace_asset': return id('asset') && id('with');
    default: return false;
  }
}
async function body(request: IncomingMessage) {
  const parts: Buffer[] = []; let size = 0;
  for await (const part of request) { size += part.length; if (size > JSON_LIMIT) throw new Error('too_large'); parts.push(part); }
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(value));
}
function safeError(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'OVS_TIMELINE_BUSY') return 'busy';
  const code = error instanceof Error ? error.message : '';
  return ['invalid', 'changed', 'busy', 'not_found', 'unsupported', 'agent_required', 'agent_busy', 'agent_unavailable', 'agent_version', 'agent_session', 'agent_timeout', 'in_progress'].includes(code) ? code : 'failed';
}
export type StudioOptions = {
  production: string; port?: number; agent?: AgentOptions['engine']; resume?: string; newSession?: boolean; recover?: boolean;
  /** The launching host owns recipient identity, delivery receipts and request-id deduplication.
   * Never implement this by starting or resuming an independent native session. */
  originalConversation?: {
    label: string;
    status?(): Promise<{ connected: boolean; busy: boolean; label: string }>;
    send(request: { requestId: string; text: string }): Promise<{ accepted: boolean }>;
  };
};

/** The CLI owns this loopback service; Orkas PC's Electron main stays unchanged. */
export async function startStudio(options: StudioOptions) {
  const root = await fs.realpath(resolve(options.production));
  if (!(await fs.stat(root)).isDirectory()) throw new Error('Open an existing production directory.');
  await canvasRevision(root);
  const lockFile = join(root, '.ovs-studio.lock');
  if (!isPathAllowed(lockFile, [root])) throw new Error('The production service lock is outside the project.');
  const lock = await acquireLease(lockFile, options.recover).catch(() => { throw new Error('A canvas owns this production. Close it first; --recover only clears locks whose recorded processes have exited.'); });
  const secret = randomBytes(32).toString('hex'), cookie = randomBytes(32).toString('hex');
  let origin = '', closed = false, generation = 0, uploads = 0;
  const companion = !options.originalConversation && process.env.ORKAS_CANVAS_CLIENT ? connectOriginalConversation(process.env.ORKAS_CANVAS_CLIENT) : undefined;
  const conversation = options.originalConversation ?? companion;
  const conversationStatus = async () => {
    try { return conversation?.status ? await conversation.status() : { connected: !!conversation, busy: false, label: conversation?.label ?? '' }; }
    catch { return { connected: false, busy: false, label: '' }; }
  };
  let agent = options.agent ? new NativeAgent({ engine: options.agent, root, resume: options.resume, newSession: options.newSession, recover: options.recover }) : undefined;
  let lastAgentGeneration = 0;
  const events: Array<CanvasJob & { seq: number; cid: string }> = [];
  let eventSeq = 0;
  const jobs = new CanvasJobs(root, () => generation++, event => { events.push({ ...event, seq: ++eventSeq, cid: 'studio' }); if (events.length > 100) events.shift(); });
  let pendingUpdate: { video: string; cancelled: boolean } | undefined;
  const handoffs = new Set<Promise<void>>();
  agent?.onSettled(status => {
    const update = pendingUpdate;
    if (!update) return;
    if (status !== 'completed' || closed || update.cancelled) {
      pendingUpdate = undefined; jobs.failedUpdate(update.video, status === 'stopped'); return;
    }
    // The user's Update includes delivery. Native completion is the structured
    // handoff; do not interpret replies, change prompts or submit another turn.
    const work = studioContext.run({ root }, async () => {
      try {
        if (!update.cancelled && !closed && !(await jobs.update(update.video, { afterAgent: true })).ok) jobs.failedUpdate(update.video);
      } catch { jobs.failedUpdate(update.video); }
      finally { if (pendingUpdate === update) pendingUpdate = undefined; }
    });
    handoffs.add(work); void work.finally(() => handoffs.delete(work));
  });
  const headersCookie = `ovs_studio_${randomBytes(8).toString('hex')}=${cookie}`;
  const authenticated = (request: IncomingMessage) => (request.headers.cookie ?? '').split(';').some(part => part.trim() === headersCookie);
  const sameOrigin = (request: IncomingMessage) => request.headers.origin === origin;
  const mutations = new Set(['videoCanvas.edit', 'videoCanvas.draft', 'videoCanvas.redo', 'videoCanvas.generateDraft', 'videoCanvas.agentUpdate']);
  async function invoke(method: unknown, p: any) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return { ok: false, code: 'invalid' };
    if (p.dir !== undefined && p.dir !== '.') return { ok: false, code: 'not_found' };
    const original = await conversationStatus();
    const busy = agent?.state().busy === true || !!pendingUpdate || original.busy;
    if (mutations.has(String(method)) && busy) return { ok: false, code: 'busy' };
    if (mutations.has(String(method)) && p.revision !== await canvasRevision(root)) return { ok: false, code: 'changed' };
    const common = { uid: '', cid: 'studio', dir: '.' };
    switch (method) {
      case 'conversation.status': return { ok: true, ...original };
      case 'conversation.send': {
        if (Object.keys(p).some(key => !['request_id', 'text'].includes(key))
          || typeof p.request_id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(p.request_id)
          || typeof p.text !== 'string' || !p.text.trim() || p.text.length > 20_000) return { ok: false, code: 'invalid' };
        if (!conversation || !original.connected) return { ok: false, code: 'conversation_unavailable' };
        const receipt = await conversation.send({ requestId: p.request_id, text: p.text });
        return receipt.accepted ? { ok: true, accepted: true } : { ok: false, code: 'conversation_unavailable' };
      }
      case 'videoCanvas.read': {
        const revision = await canvasRevision(root);
        const productions = await canvas.readVideoCanvasProductions('', 'studio');
        if (revision !== await canvasRevision(root)) return { ok: false, code: 'changed' };
        return { ok: true, productions, jobs: jobs.state(), busy, video_studio: true, revision };
      }
      case 'videoCanvas.layout': return { ...await canvas.saveVideoCanvasLayout({ ...common, cards: p.cards }), revision: await canvasRevision(root) };
      case 'videoCanvas.edit': {
        if (!validEdit(p.edit)) return { ok: false, code: 'invalid' };
        // Stop an obsolete render before claiming the same production lock.
        if (typeof p.edit.video === 'string') await jobs.stop([p.edit.video]);
        else await jobs.stop(jobs.state().filter(j => j.kind === 'render' && j.video_id).map(j => j.video_id!));
        const result = await withTimelineLock(root, async () => {
          if (p.revision !== await canvasRevision(root)) return { ok: false as const, code: 'changed' as const };
          return canvas.applyVideoCanvasEdit({ ...common, busy, edit: p.edit });
        });
        if (result.ok) { await jobs.stop(result.changed_videos); generation++; }
        return { ...result, revision: await canvasRevision(root) };
      }
      case 'videoCanvas.draft': return withTimelineLock(root, async () => {
        if (p.revision !== await canvasRevision(root)) return { ok: false, code: 'changed' };
        return { ...await canvas.applyVideoCanvasDraftChange({ ...common, change: p.change }), revision: await canvasRevision(root) };
      });
      case 'videoCanvas.voices': return canvas.readVideoCanvasVoices('', 'studio', '.', p.video);
      case 'videoCanvas.render': return busy ? { ok: false, code: 'busy' } : jobs.update(String(p.video));
      case 'videoCanvas.redoOptions': return jobs.options(p, false);
      case 'videoCanvas.draftOptions': return jobs.options(p, true);
      case 'videoCanvas.quoteRedo': return jobs.quote(p, false);
      case 'videoCanvas.quoteDraft': return jobs.quote(p, true);
      case 'videoCanvas.redo': return jobs.generate(p, false);
      case 'videoCanvas.generateDraft': return jobs.generate(p, true);
      case 'videoCanvas.agentUpdate': {
        if (!agent) return { ok: false, code: 'agent_unavailable' };
        if (jobs.busy() || uploads || pendingUpdate) return { ok: false, code: 'busy' };
        if (typeof p.video !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(p.video)) return { ok: false, code: 'invalid' };
        const productions = await canvas.readVideoCanvasProductions('', 'studio');
        if (!productions[0]?.videos.some(video => video.id === p.video)) return { ok: false, code: 'not_found' };
        if (p.revision !== await canvasRevision(root)) return { ok: false, code: 'changed' };
        const update = { video: p.video, cancelled: false };
        pendingUpdate = update;
        try { return await agent.send(p.text); }
        catch (error) { if (pendingUpdate === update) pendingUpdate = undefined; throw error; }
      }
      case 'agent.send': {
        if (!agent) return { ok: false, code: 'agent_unavailable' };
        if (jobs.busy() || uploads || pendingUpdate) return { ok: false, code: 'busy' };
        return agent.send(p.text);
      }
      case 'agent.respond': if (!agent) return { ok: false, code: 'agent_unavailable' }; await agent.respond(p.id, p.answer ?? {}); return { ok: true };
      case 'agent.stop': {
        const update = pendingUpdate;
        if (update) update.cancelled = true;
        await agent?.stop();
        await Promise.allSettled([...handoffs]);
        if (update) { await jobs.stop([update.video]); if (pendingUpdate === update) pendingUpdate = undefined; }
        return { ok: true };
      }
      case 'studio.status': {
        const current = agent?.state();
        if (current && current.generation !== lastAgentGeneration) { generation++; lastAgentGeneration = current.generation; }
        return { ok: true, conversation: original, agent: current ?? null, jobs: events.filter(e => e.seq > Number(p.after ?? 0)), eventSeq, generation, revision: await canvasRevision(root) };
      }
      default: return { ok: false, code: 'invalid' };
    }
  }
  const server = createServer((request, response) => {
    void studioContext.run({ root }, async () => {
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('Referrer-Policy', 'no-referrer');
      response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
      try {
        if (request.headers.host !== new URL(origin).host) return json(response, 403, { ok: false, code: 'denied' });
        const url = new URL(request.url ?? '/', origin);
        if (request.method === 'POST' && !sameOrigin(request)) return json(response, 403, { ok: false, code: 'denied' });
        if (url.pathname === '/api/connect' && request.method === 'POST') {
          const p = await body(request), received = Buffer.from(typeof p.token === 'string' ? p.token : '');
          if (received.length !== secret.length || !timingSafeEqual(received, Buffer.from(secret))) return json(response, 401, { ok: false });
          response.setHeader('Set-Cookie', `${headersCookie}; HttpOnly; SameSite=Strict; Path=/`);
          return json(response, 200, { ok: true });
        }
        if (url.pathname.startsWith('/api/') || url.pathname === '/media') {
          if (!authenticated(request)) return json(response, 401, { ok: false, code: 'denied' });
          if (url.pathname === '/api/invoke' && request.method === 'POST') {
            const { method, params } = await body(request);
            const dispatch = () => invoke(method, params ?? {});
            const result = mutations.has(method) || method === 'videoCanvas.render' || method === 'agent.send'
              ? await fileEditLock(`${root}:studio-dispatch`).runExclusive(dispatch) : await dispatch();
            return json(response, 200, result);
          }
          if (url.pathname === '/api/upload' && request.method === 'POST') {
            if (agent?.state().busy || (await conversationStatus()).busy || uploads >= 2) return json(response, 409, { ok: false, code: 'busy' });
            const name = basename(url.searchParams.get('name') ?? ''), extension = extname(name).toLowerCase();
            if (!MIME[extension]) return json(response, 400, { ok: false, code: 'unsupported' });
            uploads++;
            let directory: string | undefined;
            try {
              directory = await fs.mkdtemp(join(tmpdir(), 'ovs-upload-'));
              let size = 0;
              const file = join(directory, name), handle = await fs.open(file, 'wx');
              await pipeline(request, new Transform({ transform(chunk, _encoding, callback) { size += chunk.length; callback(size > UPLOAD_LIMIT ? new Error('too_large') : null, chunk); } }), handle.createWriteStream());
              const result = await importTimelineAssets({ production: root, inputs: [file], reuse: true });
              generation++;
              return json(response, 200, { ok: true, files: [{ ok: true, name, asset_id: result.assets[0].id }], revision: await canvasRevision(root) });
            } finally { uploads--; if (directory) await fs.rm(directory, { recursive: true, force: true }); }
          }
          if (url.pathname === '/media' && (request.method === 'GET' || request.method === 'HEAD')) {
            const file = resolve(root, url.searchParams.get('file') ?? ''), type = MIME[extname(file).toLowerCase()];
            if (!type || !isPathAllowed(file, [root])) return json(response, 404, { ok: false });
            const physical = await fs.realpath(file).catch(() => '');
            if (!physical || extname(physical).toLowerCase() !== extname(file).toLowerCase()) return json(response, 404, { ok: false });
            const stat = await fs.stat(file).catch(() => null);
            if (!stat?.isFile()) return json(response, 404, { ok: false });
            let start = 0, end = stat.size - 1, partial = false;
            if (request.headers.range) {
              const match = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range);
              if (!match) return json(response, 416, { ok: false });
              start = Number(match[1]); end = match[2] ? Math.min(end, Number(match[2])) : end; partial = true;
              if (start > end || !Number.isSafeInteger(start)) return json(response, 416, { ok: false });
            }
            response.writeHead(partial ? 206 : 200, { 'Content-Type': type, 'Content-Length': Math.max(0, end - start + 1), 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store',
              ...(partial ? { 'Content-Range': `bytes ${start}-${end}/${stat.size}` } : {}),
              ...(url.searchParams.has('download') ? { 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(basename(file))}` } : {}) });
            if (request.method === 'HEAD' || stat.size === 0) return response.end();
            await pipeline(createReadStream(file, { start, end }), response); return;
          }
          return json(response, 404, { ok: false });
        }
        const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        if (request.method !== 'GET' || !PUBLIC.has(file)) return json(response, 404, { ok: false });
        const asset = join(fileURLToPath(new URL('./web/', import.meta.url)), file);
        response.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript; charset=utf-8' : file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(await fs.readFile(asset));
      } catch (error) {
        if (!response.headersSent) json(response, 400, { ok: false, code: safeError(error) });
        else response.destroy();
      }
    });
  });
  server.requestTimeout = 600_000; server.headersTimeout = 15_000; server.maxConnections = 64;
  try {
    await new Promise<void>((ready, reject) => { server.once('error', reject); server.listen(options.port ?? 0, '127.0.0.1', ready); });
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('Canvas could not start.');
    origin = `http://127.0.0.1:${address.port}`;
  } catch (error) { await lock.release(); throw error; }
  return { url: `${origin}/#${secret}`, origin, async close() {
    if (closed) return; closed = true;
    companion?.close();
    if (pendingUpdate) pendingUpdate.cancelled = true;
    await agent?.close(); await Promise.allSettled([...handoffs]); await jobs.close();
    server.closeAllConnections();
    await new Promise<void>(done => server.close(() => done()));
    await lock.release();
  } };
}
