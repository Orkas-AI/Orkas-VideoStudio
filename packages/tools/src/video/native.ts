/** Native BYO payloads; shared bounded lifecycle never retries a create request. */
import * as fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fitVideoParameters, videoModelSpec, videoFrameSupport, VIDEO_MODEL_SPECS, WAN_REGIONS, videoOutputConversion, fetchAndReadWithTimeout, readResponseBytes, ProviderHttpError, RequestTimeoutError, resolveFfmpegTools, runOk, type VideoProviderConfig } from '@orkas/video-studio-core';
import type { VideoParams, GenerateVideoOpts, VideoResult } from './video.js';
import { validateDownloadedVideo } from './video.js';
import { probeMedia } from '../edit/edit.js';
import { createVideoCloudCredentials } from './cloud-auth.js';
const MAX_VIDEO = 100 * 1024 * 1024;
type Json = Record<string, any>; // Untrusted native envelopes are checked at each consumption boundary.
type NativeRequest = { url: string; headers: Record<string, string>; body: Json; query: (id: string) => { url: string; body?: Json }; state: (value: Json, id: string) => { state: string; url?: string; inline?: string; googleFile?: boolean }; wanted: Json; native: Json; token?: () => Promise<string> };
async function binary(url: string, signal?: AbortSignal, maxBytes = MAX_VIDEO, headers?: Record<string, string>) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Use an HTTP media URL without embedded credentials.');
  return fetchAndReadWithTimeout(url, { headers, signal, redirect: 'error', timeoutMs: 600_000 }, async (res, bounded) => {
    if (!res.ok) { await res.body?.cancel(); throw new ProviderHttpError(res.status); }
    return readResponseBytes(res, maxBytes, bounded);
  });
}
async function image(url: string, signal?: AbortSignal) {
  const bytes = await binary(url, signal, 100 * 1024 * 1024);
  const mime = bytes.subarray(0, 4).equals(Buffer.from([137, 80, 78, 71])) ? 'image/png' : bytes[0] === 255 && bytes[1] === 216 ? 'image/jpeg' : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : '';
  if (!mime) throw new Error('Reference image must contain PNG, JPEG or WebP bytes.');
  return { mimeType: mime, bytesBase64Encoded: bytes.toString('base64') };
}
export async function nativeVideoRequest(cfg: VideoProviderConfig, p: VideoParams, signal?: AbortSignal): Promise<NativeRequest> {
  const provider = cfg.provider ?? 'doubao';
  const model = p.model ?? cfg.model ?? VIDEO_MODEL_SPECS[provider]?.[0]?.id;
  if (!model || !cfg.api_key) throw new Error('Configure a native video model and API key before generating.');
  const spec = videoModelSpec(provider, model);
  if (!spec) throw new Error('This native video model is unsupported; select a configured catalog model.');
  const first = p.first_frame_url, last = p.last_frame_url;
  const images = p.reference_image_urls ?? (p.image_url ? [p.image_url] : []), videos = p.reference_video_urls ?? [];
  if (last && !first) throw new Error('last_frame requires a first_frame.');
  const support = videoFrameSupport(provider, model);
  if (first && (support.frames === 'none' || (last && support.frames !== 'first_last'))) throw new Error('This model does not support the requested first/last frames.');
  if (first && (images.length || videos.length) && !support.withReferences) throw new Error('This model cannot combine frames and generic references.');
  if (images.length + (support.withReferences ? Number(Boolean(first)) + Number(Boolean(last)) : 0) > spec.images || videos.length > spec.videos) throw new Error('Too many reference images or videos for this model.');
  if (p.operation === 'edit' && (first || !videos.length || !spec.videos)) throw new Error('Editing requires a supported source video and cannot use first/last frames.');
  if (!p.prompt.trim() || p.prompt.length > 100_000) throw new Error('Provide a bounded nonempty video prompt.');
  if (provider === 'kling') {
    let latin = 0, other = 0;
    for (const c of p.prompt) c.codePointAt(0)! <= 127 ? latin++ : other++;
    if (latin * 11000 + other * 26000 > 26000 * 11000) throw new Error('Shorten the Kling prompt to its character budget.');
  }
  const wanted = { duration: p.duration ?? 5, resolution: p.resolution ?? '720p', ratio: p.ratio ?? '16:9', generateAudio: p.generate_audio, seed: p.seed, firstFrameUrl: first, lastFrameUrl: last, referenceImageUrls: images, referenceVideoUrls: videos, operation: p.operation };
  const fitted = fitVideoParameters(wanted, provider, model);
  if (fitted.duration !== undefined && !(Number.isInteger(fitted.duration) && fitted.duration >= spec.minDuration && fitted.duration <= spec.maxDuration) && !(fitted.duration === -1 && spec.autoDuration)) throw new Error('The requested duration exceeds this model; split the requested action into shots.');
  const n = { ...fitted, duration: fitted.duration ?? 5, resolution: fitted.resolution ?? spec.resolutions[0], ratio: fitted.ratio ?? (first && support.fixRatio ? 'adaptive' : '16:9'), generateAudio: fitted.generateAudio !== false };
  if (provider === 'google') delete (n as Json).duration;
  if (provider === 'aliyun' && (!/^[A-Za-z0-9-]{1,100}$/.test(cfg.workspace_id ?? '') || !(WAN_REGIONS as readonly string[]).includes(cfg.region ?? '') || p.prompt.length > 20_000)) throw new Error('Configure a valid Alibaba workspace and region and keep the prompt within 20000 characters.');
  const bases: Record<string, string> = { doubao: 'https://ark.cn-beijing.volces.com/api/v3', minimax: 'https://api.minimax.io', vidu: 'https://api.vidu.com', kling: 'https://api-singapore.klingai.com', google: 'https://generativelanguage.googleapis.com/v1beta', runway: 'https://api.dev.runwayml.com', aliyun: `https://${cfg.workspace_id}.${cfg.region}.maas.aliyuncs.com/api/v1` };
  let base = (cfg.base_url ?? bases[provider] ?? '').replace(/\/+$/, '');
  const headers: Record<string, string> = { Authorization: `Bearer ${cfg.api_key}`, 'Content-Type': 'application/json' };
  const frame = [...(first ? [{ type: 'image_url', role: 'first_frame', image_url: { url: first } }] : []), ...(last ? [{ type: 'image_url', role: 'last_frame', image_url: { url: last } }] : [])];
  const content = [{ type: 'text', text: p.prompt }, ...frame, ...images.map(url => ({ type: 'image_url', role: 'reference_image', image_url: { url } })), ...videos.map(url => ({ type: 'video_url', role: 'reference_video', video_url: { url } }))];
  const request: NativeRequest = { url: '', body: {}, headers, wanted, native: n, query: () => ({ url: '' }), state: () => ({ state: '' }) };
  if (provider === 'doubao') Object.assign(request, { url: base + '/contents/generations/tasks', body: { model, content, duration: n.duration, ratio: n.ratio, resolution: n.resolution, generate_audio: n.generateAudio, watermark: false, ...(n.seed !== undefined ? { seed: n.seed } : {}) }, query: (id: string) => ({ url: base + '/contents/generations/tasks/' + encodeURIComponent(id) }), state: (d: Json) => ({ state: d.status, url: d.content?.video_url }) });
  if (provider === 'minimax') Object.assign(request, { url: base + '/v2/video_generation', body: { model, content, resolution: n.resolution.toUpperCase(), duration: n.duration, ratio: n.ratio }, query: (id: string) => ({ url: base + '/v2/query/video_generation/' + encodeURIComponent(id) }), state: (d: Json) => ({ state: d.task?.status, url: d.task?.content?.url }) });
  if (provider === 'vidu') {
    headers.Authorization = `Token ${cfg.api_key}`;
    const start = first ?? images[0];
    Object.assign(request, { url: base + '/ent/v2/' + (last ? 'start-end2video' : start ? 'img2video' : 'text2video'), body: { model, prompt: p.prompt, duration: n.duration, resolution: n.resolution, audio: n.generateAudio, off_peak: false, ...(n.seed !== undefined ? { seed: n.seed } : {}), ...(start ? { images: last ? [start, last] : [start] } : { aspect_ratio: n.ratio }) }, query: (id: string) => ({ url: base + '/ent/v2/tasks/' + encodeURIComponent(id) + '/creations' }), state: (d: Json) => ({ state: d.state ?? d.status, url: d.creations?.[0]?.url ?? d.video_url }) });
  }
  if (provider === 'kling') {
    const refs = first || images.length || videos.length;
    const contents: Json[] = [{ type: 'prompt', text: p.prompt }, ...videos.map((url, i) => ({ type: p.operation === 'edit' && i === 0 ? 'base_video' : 'feature_video', url, id: `Video${i + 1}` })), ...(first ? [{ type: 'first_frame', url: first }] : []), ...images.map((url, i) => ({ type: 'refer_image', url, id: `Image${i + 1}` })), ...(last ? [{ type: 'last_frame', url: last }] : [])];
    Object.assign(request, { url: base + '/' + (refs ? 'omni-video' : 'text-to-video') + '/' + (model.endsWith('flash') ? 'kling-4.0-flash' : 'kling-4.0'), body: { ...(refs ? { contents } : { prompt: p.prompt }), settings: { duration: n.duration, resolution: n.resolution, aspect_ratio: n.ratio }, options: { watermark_info: { enabled: false } } }, query: (id: string) => ({ url: base + '/tasks?' + new URLSearchParams({ task_ids: id }) }), state: (d: Json, id: string) => { const row = Array.isArray(d.data) ? d.data.find((r: Json) => r?.id === id) : null; return { state: row?.status, url: row?.outputs?.find((r: Json) => r?.type === 'video')?.url }; } });
  }
  if (provider === 'runway') {
    headers['X-Runway-Version'] = '2024-11-06'; const start = first ?? images[0];
    const ratio = ({ '16:9': '1280:720', '9:16': '720:1280', '1:1': '960:960', '4:3': '1104:832', '3:4': '832:1104', '21:9': '1584:672' } as Json)[n.ratio] ?? '1280:720';
    Object.assign(request, { url: base + '/v1/' + (start ? 'image_to_video' : 'text_to_video'), body: { model, promptText: p.prompt, ratio, duration: n.duration, ...(start ? { promptImage: start } : {}) }, query: (id: string) => ({ url: base + '/v1/tasks/' + encodeURIComponent(id) }), state: (d: Json) => ({ state: d.status, url: d.output?.[0] }) });
  }
  if (provider === 'aliyun') {
    headers['X-DashScope-Async'] = 'enable';
    const media = [...(first ? [{ type: 'first_frame', url: first }] : []), ...(last ? [{ type: 'last_frame', url: last }] : []), ...images.map(url => ({ type: 'reference_image', url })), ...videos.map(url => ({ type: 'reference_video', url }))];
    Object.assign(request, { url: base + '/services/aigc/video-generation/video-synthesis', body: { model, input: { prompt: p.prompt, ...(media.length ? { media } : {}) }, parameters: { resolution: n.resolution.toUpperCase(), ratio: n.ratio, duration: n.duration, audio: n.generateAudio, ...(n.seed !== undefined ? { seed: n.seed } : {}) } }, query: (id: string) => ({ url: base + '/tasks/' + encodeURIComponent(id) }), state: (d: Json) => ({ state: d.output?.task_status, url: d.output?.video_url }) });
  }
  if (provider === 'google-cloud') {
    const credentials = createVideoCloudCredentials(cfg.api_key, signal); request.token = credentials.token;
    base = cfg.base_url ?? `https://us-central1-aiplatform.googleapis.com/v1/projects/${credentials.projectId}/locations/us-central1/publishers/google/models/${model}`;
    const instance: Json = { prompt: p.prompt };
    if (first ?? images[0]) instance.image = await image((first ?? images[0])!, signal);
    if (last) instance.lastFrame = await image(last, signal);
    Object.assign(request, { url: base + ':predictLongRunning', body: { instances: [instance], parameters: { aspectRatio: n.ratio, durationSeconds: n.duration, resolution: n.resolution, sampleCount: 1, generateAudio: n.generateAudio, ...(n.seed !== undefined ? { seed: n.seed } : {}) } }, query: (id: string) => ({ url: base + ':fetchPredictOperation', body: { operationName: id } }), state: (d: Json) => ({ state: d.error ? 'failed' : d.done ? 'completed' : 'running', inline: d.response?.videos?.[0]?.mimeType === 'video/mp4' ? d.response.videos[0].bytesBase64Encoded : undefined }) });
  }
  if (provider === 'google') {
    delete headers.Authorization; headers['x-goog-api-key'] = cfg.api_key;
    const input: Json[] = [{ type: 'text', text: p.prompt }];
    for (const url of images) { const asset = await image(url, signal); input.push({ type: 'image', mime_type: asset.mimeType, data: asset.bytesBase64Encoded }); }
    for (const url of videos) { const asset = await binary(url, signal, 20 * 1024 * 1024); validateDownloadedVideo(asset); input.push({ type: 'video', mime_type: 'video/mp4', data: asset.toString('base64') }); }
    Object.assign(request, { url: base + '/interactions', body: { model, input, background: true, response_format: { type: 'video', delivery: 'uri', aspect_ratio: n.ratio, resolution: n.resolution } }, query: (id: string) => ({ url: base + '/interactions/' + encodeURIComponent(id) }), state: (d: Json) => { const video = d.steps?.filter((s: Json) => s?.type === 'model_output').flatMap((s: Json) => Array.isArray(s.content) ? s.content : []).find((v: Json) => v?.type === 'video'); return { state: d.status, ...(video?.mime_type === 'video/mp4' ? { inline: video.data, url: video.uri, googleFile: true } : {}) }; } });
  }
  return request;
}
async function json(url: string, headers: Record<string, string>, body: Json | undefined, timeoutMs: number, signal?: AbortSignal, maxBytes = 1024 * 1024): Promise<Json> {
  return fetchAndReadWithTimeout(url, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined, signal, redirect: 'error', timeoutMs }, async (res, bounded) => {
    if (!res.ok) { await res.body?.cancel(); throw new ProviderHttpError(res.status); }
    const data = JSON.parse((await readResponseBytes(res, maxBytes, bounded)).toString('utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('The provider returned an invalid task envelope.');
    return data;
  });
}
async function writeTaskReceipt(path: string, value: unknown) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try { await fs.writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); await fs.rename(temporary, path); }
  finally { await fs.rm(temporary, { force: true }); }
}
export async function generateNativeVideo(p: VideoParams, cfg: VideoProviderConfig, opts: GenerateVideoOpts): Promise<VideoResult> {
  opts.signal?.throwIfAborted();
  const req = await nativeVideoRequest(cfg, p, opts.signal);
  const out = resolve(p.output), lockPath = `${out}.video.lock`, receiptPath = `${out}.video-task.json`;
  await fs.mkdir(dirname(out), { recursive: true });
  const claim = await fs.open(lockPath, 'wx').catch(() => { throw new Error('Another native video request owns this output; inspect its existing result before retrying.'); });
  let ownsReceipt = false;
  try {
    if (await fs.lstat(out).catch((e: NodeJS.ErrnoException) => { if (e.code === 'ENOENT') return null; throw e; })) throw new Error('The native video output already exists; choose a new output and preserve the existing file.');
    await fs.writeFile(receiptPath, JSON.stringify({ provider: cfg.provider, phase: 'preflight', created_at: new Date().toISOString() }) + '\n', { flag: 'wx' }).catch(() => { throw new Error('An existing video task receipt owns this output; inspect its outcome before submitting another generation.'); });
    ownsReceipt = true;
    const result = await generateClaimedVideo(p, cfg, opts, req, receiptPath);
    await writeTaskReceipt(receiptPath, { provider: cfg.provider, phase: 'completed', task_id: result.task_id, output: result.output, bytes: result.bytes });
    return result;
  } catch (cause) {
    if (!ownsReceipt) throw cause;
    throw Object.assign(new Error(`Native video dispatch or tracking stopped. Inspect task receipt ${receiptPath} before any new paid request; do not automatically resubmit.`, { cause }), { task_id: (cause as any)?.task_id, post_dispatch: (cause as any)?.post_dispatch });
  } finally { await claim.close(); await fs.rm(lockPath, { force: true }); }
}
async function generateClaimedVideo(p: VideoParams, cfg: VideoProviderConfig, opts: GenerateVideoOpts, req: NativeRequest, receiptPath: string): Promise<VideoResult> {
  const now = opts.now ?? Date.now;
  const deadline = now() + 3_600_000;
  if (req.token) req.headers.Authorization = `Bearer ${await req.token()}`;
  await writeTaskReceipt(receiptPath, { provider: cfg.provider, phase: 'dispatch_started', started_at: new Date().toISOString() });
  const created = await json(req.url, req.headers, req.body, 60_000, opts.signal, cfg.provider?.startsWith('google') ? 140 * 1024 * 1024 : undefined);
  const id = created.id ?? created.task_id ?? created.name ?? created.data?.id ?? created.output?.task_id;
  if (typeof id !== 'string' || !id || id.length > 1024) throw new Error('Video creation returned no valid task receipt; do not automatically resubmit.');
  await writeTaskReceipt(receiptPath, { provider: cfg.provider, phase: 'accepted', task_id: id });
  let failures = 0, current = created;
  try {
    while (now() < deadline) {
      opts.signal?.throwIfAborted();
      const poll = req.state(current, id), state = String(poll.state ?? '').toLowerCase();
      if (['success', 'succeeded', 'completed'].includes(state)) {
        let buf: Buffer;
        if (poll.inline) {
          if (poll.inline.length > Math.ceil(MAX_VIDEO / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(poll.inline)) throw new Error('Invalid video encoding.');
          buf = Buffer.from(poll.inline, 'base64');
          if (buf.toString('base64') !== poll.inline) throw new Error('Invalid video encoding.');
        } else if (poll.url && poll.googleFile) {
          const uri = new URL(poll.url); const match = /^\/v1beta\/files\/([A-Za-z0-9_-]+)(?::download)?$/.exec(uri.pathname);
          if (uri.protocol !== 'https:' || uri.hostname !== 'generativelanguage.googleapis.com' || !match) throw new Error('Unsupported Google video file URL.');
          const fileUrl = `https://generativelanguage.googleapis.com/v1beta/files/${match[1]}`;
          const fileHeaders = { 'x-goog-api-key': cfg.api_key! };
          let ready = false;
          for (let attempts = 0; attempts < 120 && now() < deadline; attempts++) {
            const file = await json(fileUrl, fileHeaders, undefined, Math.min(30_000, Math.max(1, deadline - now())), opts.signal);
            if (file.state === 'ACTIVE') { ready = true; break; }
            if (file.state !== 'PROCESSING') throw new Error('The generated Google file is unavailable.');
            await new Promise<void>((done, reject) => {
              const abort = () => { clearTimeout(timer); reject(opts.signal?.reason); };
              const timer = setTimeout(() => { opts.signal?.removeEventListener('abort', abort); done(); }, opts.pollIntervalMs ?? 1000);
              opts.signal?.addEventListener('abort', abort, { once: true }); if (opts.signal?.aborted) abort();
            });
          }
          if (!ready) throw new Error('The generated Google file is still processing; retain its task receipt.');
          buf = await binary(`${fileUrl}:download?alt=media`, opts.signal, MAX_VIDEO, fileHeaders);
        } else {
          if (typeof poll.url !== 'string' || !poll.url) throw new Error('Video task completed without a video output.');
          buf = await binary(poll.url, opts.signal);
        }
        validateDownloadedVideo(buf);
        const out = resolve(p.output), source = `${out}.${randomUUID()}.source.mp4`, converted = `${out}.${randomUUID()}.mp4`;
        await fs.mkdir(dirname(out), { recursive: true });
        try {
          await fs.writeFile(source, buf, { flag: 'wx' });
          const measured = await probeMedia(source);
          if (!(measured.width > 0 && measured.height > 0 && measured.duration > 0)) throw new Error('The returned bytes contain no readable video.');
          const conversion = videoOutputConversion(req.wanted, { ...req.native, duration: measured.duration });
          if (conversion.duration || conversion.mute || conversion.filters.length) {
            await runOk(resolveFfmpegTools().ffmpeg, ['-hide_banner', '-nostdin', '-loglevel', 'error', '-threads', '2', '-i', source, ...(conversion.duration ? ['-t', String(conversion.duration)] : []), '-map', '0:v:0', ...(conversion.mute ? ['-an'] : ['-map', '0:a?']), ...(conversion.filters.length ? ['-vf', conversion.filters.join(',')] : []), '-c:v', 'libx264', '-threads', '2', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', ...(conversion.mute ? [] : conversion.audioFilters.length ? ['-af', conversion.audioFilters.join(','), '-c:a', 'aac'] : ['-c:a', 'copy']), '-movflags', '+faststart', converted], { signal: opts.signal, timeoutMs: 120_000, maxBuffer: 64 * 1024 });
            await fs.link(converted, out);
          } else await fs.link(source, out);
          return { output: out, bytes: (await fs.stat(out)).size, task_id: id };
        } finally { await Promise.all([fs.rm(source, { force: true }), fs.rm(converted, { force: true })]); }
      }
      if (['failed', 'fail', 'cancelled', 'canceled', 'expired', 'unknown'].includes(state)) throw new Error('The provider could not complete the accepted video task.');
      if (state && !['queued', 'pending', 'submitted', 'running', 'processing', 'in_progress'].includes(state)) throw new Error('Unknown accepted task state.');
      await new Promise<void>((done, reject) => { const aborted = () => { clearTimeout(timer); reject(opts.signal?.reason); }; const timer = setTimeout(() => { opts.signal?.removeEventListener('abort', aborted); done(); }, Math.min(opts.pollIntervalMs ?? 10_000, Math.max(0, deadline - now()))); opts.signal?.addEventListener('abort', aborted, { once: true }); if (opts.signal?.aborted) aborted(); });
      const query = req.query(id);
      try {
        if (req.token) req.headers.Authorization = `Bearer ${await req.token()}`;
        current = await json(query.url, req.headers, query.body, Math.min(30_000, Math.max(1, deadline - now())), opts.signal, cfg.provider?.startsWith('google') ? 140 * 1024 * 1024 : undefined); failures = 0;
      } catch (error) {
        if (opts.signal?.aborted || !(error instanceof RequestTimeoutError || error instanceof ProviderHttpError && (error.status === 429 || error.status >= 500)) || ++failures >= 5) throw error;
      }
    }
    throw new Error('Accepted video task reached its tracking deadline.');
  } catch (cause) { throw Object.assign(new Error('Video tracking or delivery stopped after creation; preserve the task receipt and do not automatically submit another generation.', { cause }), { task_id: id, post_dispatch: true }); }
}
