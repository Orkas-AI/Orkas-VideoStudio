import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { fitVideoParameters, resolveFfmpegTools, runOk } from '@orkas/video-studio-core';
import { startStudio } from '../src/studio/server.js';
import { CanvasJobs, type CanvasJob } from '../src/studio/jobs.js';
import { studioContext } from '../src/studio/host.js';
import * as renderTool from '../src/render/render.js';
import { withTimelineLock } from '../src/composition/timeline.js';

// Render, delivery and paid generation stand in only where a case installs a fixture; every
// other case uses the real modules.
const fixture = vi.hoisted(() => ({
  render: undefined as undefined | ((p: { signal?: AbortSignal }) => Promise<unknown>),
  take: undefined as undefined | ((params: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>),
  ship: undefined as undefined | ((p: any) => Promise<unknown>),
  shipped: 0,
}));
vi.mock('../src/composition/timeline-actions.js', async importActual => {
  const actual = await importActual<typeof import('../src/composition/timeline-actions.js')>();
  return {
    ...actual,
    checkTimeline: ((...args: Parameters<typeof actual.checkTimeline>) => fixture.render ? Promise.resolve({ ok: true }) : actual.checkTimeline(...args)) as typeof actual.checkTimeline,
    renderTimeline: ((p: Parameters<typeof actual.renderTimeline>[0]) => fixture.render ? fixture.render(p) : actual.renderTimeline(p)) as typeof actual.renderTimeline,
    shipTimeline: ((...args: Parameters<typeof actual.shipTimeline>) => { if (fixture.render) fixture.shipped++; return fixture.ship ? fixture.ship(args[0]) : actual.shipTimeline(...args); }) as typeof actual.shipTimeline,
  };
});
vi.mock('../src/video/native.js', async importActual => {
  const actual = await importActual<typeof import('../src/video/native.js')>();
  return {
    ...actual,
    generateNativeVideo: ((params: Parameters<typeof actual.generateNativeVideo>[0], config: Parameters<typeof actual.generateNativeVideo>[1], options: Parameters<typeof actual.generateNativeVideo>[2]) =>
      fixture.take ? fixture.take(params as unknown as Record<string, unknown>, options?.signal) : actual.generateNativeVideo(params, config, options)) as typeof actual.generateNativeVideo,
  };
});

let root: string;
let studio: Awaited<ReturnType<typeof startStudio>> | undefined;
beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), 'ovs-studio-'));
  await fs.mkdir(join(root, 'videos/main'), { recursive: true });
  await fs.writeFile(join(root, 'assets.json'), JSON.stringify({ assets: [] }));
  await fs.writeFile(join(root, 'videos/main/manifest.json'), JSON.stringify({
    schema_version: 3, id: 'main', label: 'Example', canvas: { width: 640, height: 360, fps: 30 },
    scenes: [{ id: 'one', duration: 1, text: { title: { value: 'Before' } } }, { id: 'two', duration: 1 }],
  }));
});
afterEach(async () => { await studio?.close(); studio = undefined; await fs.rm(root, { recursive: true, force: true }); });

async function connect(originalConversation?: Parameters<typeof startStudio>[0]['originalConversation']) {
  studio = await startStudio({ production: root, originalConversation });
  const link = new URL(studio.url);
  const response = await fetch(`${link.origin}/api/connect`, {
    method: 'POST', headers: { Origin: link.origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: link.hash.slice(1) }),
  });
  expect(response.status).toBe(200);
  const cookie = response.headers.get('set-cookie')!.split(';')[0];
  const invoke = async (method: string, params: Record<string, unknown> = {}) => {
    const response = await fetch(`${link.origin}/api/invoke`, { method: 'POST',
      headers: { Origin: link.origin, Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, params }),
    });
    return response.json() as Promise<any>;
  };
  return { origin: link.origin, cookie, invoke };
}

describe('browser production continuity', () => {
  it('opens the real production, saves scene text, rejects a stale edit and keeps it after reopen', async () => {
    const { invoke } = await connect();
    const before = await invoke('videoCanvas.read');
    expect(before.productions[0].videos[0].scenes[0].texts[0].value).toBe('Before');
    const changed = await invoke('videoCanvas.edit', { dir: '.', revision: before.revision,
      edit: { kind: 'set_text', video: 'main', scene: 'one', slot: 'title', value: 'After' } });
    expect(changed.ok).toBe(true);
    expect(await invoke('videoCanvas.edit', { dir: '.', revision: before.revision,
      edit: { kind: 'remove_scene', video: 'main', scene: 'one' } })).toMatchObject({ ok: false, code: 'changed' });
    await studio!.close(); studio = undefined;
    const reopened = await connect();
    const after = await reopened.invoke('videoCanvas.read');
    expect(after.productions[0].videos[0].scenes).toHaveLength(2);
    expect(after.productions[0].videos[0].scenes[0].texts[0].value).toBe('After');
  });

  it('moves cards and restores a removed scene without creating a delivery', async () => {
    const { invoke } = await connect();
    let state = await invoke('videoCanvas.read');
    expect((await invoke('videoCanvas.layout', { dir: '.', cards: { 'video:main': { x: 123, y: 234 } } })).ok).toBe(true);
    state = await invoke('videoCanvas.read');
    expect((await invoke('videoCanvas.edit', { dir: '.', revision: state.revision,
      edit: { kind: 'remove_scene', video: 'main', scene: 'one' } })).ok).toBe(true);
    state = await invoke('videoCanvas.read');
    const video = state.productions[0].videos[0];
    expect(video.scenes.map((s: any) => s.id)).toEqual(['two']);
    expect((await invoke('videoCanvas.edit', { dir: '.', revision: state.revision,
      edit: { kind: 'restore_scene', video: 'main', removed: video.removed_scenes[0].key } })).ok).toBe(true);
    state = await invoke('videoCanvas.read');
    expect(state.productions[0].videos[0].scenes.map((s: any) => s.id)).toEqual(['one', 'two']);
    expect(state.productions[0].layout['video:main']).toEqual({ x: 123, y: 234 });
    await expect(fs.stat(join(root, 'versions.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('does not pretend an unbound Agent is connected', async () => {
    const { invoke } = await connect();
    expect(await invoke('agent.send', { text: 'Change the title' })).toMatchObject({ ok: false, code: 'agent_unavailable' });
  });

  it('sends only to the host-bound original conversation and never accepts a browser-selected recipient', async () => {
    const received: unknown[] = [];
    const { invoke } = await connect({ label: '视频制作原对话', async send(request) {
      received.push(request);
      return { accepted: true };
    } });
    expect(await invoke('conversation.status')).toMatchObject({ ok: true, connected: true, label: '视频制作原对话' });
    expect(await invoke('conversation.send', { request_id: 'request-1', text: '改第 2 段', cid: 'another-conversation' })).toMatchObject({ ok: false, code: 'invalid' });
    expect(received).toEqual([]);
    expect(await invoke('conversation.send', { request_id: 'request-1', text: '改第 2 段' })).toMatchObject({ ok: true, accepted: true });
    expect(received).toEqual([{ requestId: 'request-1', text: '改第 2 段' }]);
  });

  it('reports an unavailable original conversation without dispatching a native session', async () => {
    const { invoke } = await connect();
    expect(await invoke('conversation.status')).toMatchObject({ ok: true, connected: false });
    expect(await invoke('conversation.send', { request_id: 'request-1', text: '改第 2 段' })).toMatchObject({ ok: false, code: 'conversation_unavailable' });
    expect((await invoke('studio.status')).agent).toBeNull();
  });
});

describe('local browser boundary', () => {
  it('rejects unauthenticated, foreign-origin and unregistered operations', async () => {
    const { origin, cookie, invoke } = await connect();
    expect((await fetch(`${origin}/api/invoke`, { method: 'POST', headers: { Origin: origin }, body: '{}' })).status).toBe(401);
    expect((await fetch(`${origin}/api/invoke`, { method: 'POST', headers: { Origin: 'https://example.com', Cookie: cookie }, body: '{}' })).status).toBe(403);
    expect(await invoke('run-shell', { command: 'anything' })).toMatchObject({ ok: false, code: 'invalid' });
  });

  it('never serves project HTML, private state, traversal or symlinks as media', async () => {
    await fs.writeFile(join(root, 'secret.json'), '{"private":true}');
    await fs.writeFile(join(root, 'videos/main/index.html'), '<script>parent.attack()</script>');
    await fs.symlink(join(root, 'secret.json'), join(root, 'linked.png'));
    const { origin, cookie } = await connect();
    for (const file of ['secret.json', 'videos/main/index.html', '../secret.json', 'linked.png']) {
      expect((await fetch(`${origin}/media?file=${encodeURIComponent(file)}`, { headers: { Cookie: cookie } })).status).toBe(404);
    }
  });
});

// Ported from Orkas video_canvas_jobs.test.ts at f4c0b51da8; the quote assertion is host-only.
async function until(test: () => boolean, ms = 5_000) {
  const end = Date.now() + ms;
  while (!test()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise(done => setTimeout(done, 5));
  }
}
function useVideoService(provider: string, model: string) {
  vi.stubEnv('OVS_CONFIG_DIR', join(root, '.no-config'));
  vi.stubEnv('OVS_VIDEO_PROVIDER', provider);
  vi.stubEnv('OVS_VIDEO_MODEL', model);
  vi.stubEnv('OVS_VIDEO_API_KEY', 'fixture-key');
}
async function addTake(id: string, request: Record<string, unknown> = {}) {
  const ledger = JSON.parse(await fs.readFile(join(root, 'assets.json'), 'utf8'));
  ledger.assets.push({ id, kind: 'video', label: id, path: `shots/${id}.mp4`, origin: 'generated', shot: id, prompt: 'A lamp turns on',
    request: { ratio: '16:9', duration: 5, resolution: '720p', ...request } });
  await fs.writeFile(join(root, 'assets.json'), JSON.stringify(ledger));
}
function resetFixture() {
  fixture.render = undefined; fixture.take = undefined; fixture.ship = undefined; fixture.shipped = 0;
  vi.useRealTimers(); vi.unstubAllEnvs();
}

// Decided in Orkas 2026-11-18 (review S4-6, option A): the canvas fits a setting the way the Agent's
// generation does (fitVideoParameters), so a take asks a service for the same thing from either.
describe('the settings a shot can be made again with', () => {
  afterEach(resetFixture);
  const choiceOf = async (asset: string, model: string, settings?: Record<string, unknown>) => {
    const options = await new CanvasJobs(root, () => {}, () => {}).options({ asset, ...(settings ? { settings } : {}) }, false) as any;
    return options.choices.find((choice: any) => choice.id === model);
  };

  it.each([
    ['doubao', 'doubao-seedance-2-0-fast-260128', ['480p', '720p'], '720p'],
    ['minimax', 'MiniMax-H3-Lite', ['480p', '768p'], '768p'],
    ['vidu', 'viduq3-pro', ['540p', '720p', '1080p'], '540p'],
  ])('fits a resolution %s/%s does not make to the lowest it offers not below it, as the Agent does', async (provider, model, resolutions, made) => {
    useVideoService(provider, model);
    await addTake('take');
    const choice = await choiceOf('take', model, { resolution: '540p' });
    // Asked for 540p: Seedance 2.0 Fast and H3 Lite make the next sharper one, not a softer 480p;
    // Vidu makes 540p itself. What each lists is unchanged.
    expect(choice).toMatchObject({ resolutions, params: { resolution: made } });
    expect(choice.params.resolution).toBe(fitVideoParameters({ resolution: '540p' }, provider, model).resolution);
    expect(choice).not.toHaveProperty('unavailable');
  });

  it('rounds a length a service cannot make up as the Agent does, keeping Veo to 4, 6 or 8 seconds', async () => {
    const agentLength = (provider: string, model: string, duration: number) =>
      fitVideoParameters({ duration, resolution: '720p' }, provider, model).duration;
    await addTake('take');
    // One second asked for: Runway makes 2 at the least, Seedance 4.
    useVideoService('runway', 'gen4.5');
    expect((await choiceOf('take', 'gen4.5', { duration: 1 })).params.duration).toBe(2);
    expect(agentLength('runway', 'gen4.5', 1)).toBe(2);
    useVideoService('doubao', 'doubao-seedance-2-0-260128');
    expect((await choiceOf('take', 'doubao-seedance-2-0-260128', { duration: 1 })).params.duration).toBe(4);

    // A take on record at 8.4 seconds asks for the whole second above, as its call did, not a
    // shorter 8; Veo takes its next step up, and still lists only 4, 6 and 8.
    await addTake('odd', { duration: 8.4 });
    const odd = await choiceOf('odd', 'doubao-seedance-2-0-260128');
    expect(odd.params.duration).toBe(9);
    expect(odd.durations).toContain(9);
    expect(odd.params.duration).toBe(agentLength('doubao', 'doubao-seedance-2-0-260128', 8.4));
    useVideoService('google-cloud', 'veo-3.1-fast-generate-001');
    await addTake('veo', { duration: 4.2 });
    const onVeo = await choiceOf('veo', 'veo-3.1-fast-generate-001');
    expect(onVeo).toMatchObject({ params: { duration: 6 }, durations: [4, 6, 8] });
    expect(onVeo.params.duration).toBe(agentLength('google-cloud', 'veo-3.1-fast-generate-001', 4.2));
    expect(onVeo).not.toHaveProperty('unavailable');

    // A take left to the service's own length keeps asking for that on a service that offers it,
    // and becomes a length the service makes on one that does not.
    useVideoService('doubao', 'doubao-seedance-2-5-260628');
    await addTake('auto', { duration: -1 });
    expect((await choiceOf('auto', 'doubao-seedance-2-5-260628')).params.duration).toBe(-1);
    expect(agentLength('doubao', 'doubao-seedance-2-5-260628', -1)).toBe(-1);
    useVideoService('doubao', 'doubao-seedance-2-0-260128');
    expect((await choiceOf('auto', 'doubao-seedance-2-0-260128')).params.duration).toBe(agentLength('doubao', 'doubao-seedance-2-0-260128', -1));

    // A take is one shot: a length above the longest a service makes becomes its longest.
    useVideoService('doubao', 'doubao-seedance-2-0-260128');
    await addTake('long', { duration: 20 });
    expect((await choiceOf('long', 'doubao-seedance-2-0-260128')).params.duration).toBe(15);
  });

  it('asks the service for what the panel showed', async () => {
    useVideoService('doubao', 'doubao-seedance-2-0-fast-260128');
    await addTake('take', { duration: 8.4 });
    let asked: Record<string, unknown> | undefined;
    fixture.take = async (params) => { asked = params; throw new Error('provider stand-in'); };
    const events: CanvasJob[] = [];
    const jobs = new CanvasJobs(root, () => {}, event => events.push(event));
    expect(await jobs.generate({ asset: 'take', settings: { resolution: '540p' } }, false)).toEqual({ ok: true });
    await until(() => events.some(event => event.status !== 'running'));
    expect(asked).toMatchObject({ resolution: '720p', duration: 9 });
    expect(events.at(-1)).toMatchObject({ kind: 'redo', status: 'failed' });
  });
});

// Orkas review 2026-11-16 S4-10: closing the canvas service stops what it started, so a renderer
// does not run on after it and partial files are removed.
describe('closing the canvas service', () => {
  afterEach(resetFixture);

  it('stops a render and a take in progress, reports neither as failed, and waits for them to let go', async () => {
    let unwound = false, renderSignal: AbortSignal | undefined, takeSignal: AbortSignal | undefined;
    fixture.render = ({ signal }) => new Promise(resolve => {
      renderSignal = signal;
      signal?.addEventListener('abort', () => setTimeout(() => { unwound = true; resolve({ ok: false, code: 'E_RENDER_ABORTED' }); }, 30));
    });
    fixture.take = (_params, signal) => new Promise((_resolve, reject) => {
      takeSignal = signal;
      signal?.addEventListener('abort', () => reject(new Error('operation aborted')));
    });
    useVideoService('doubao', 'doubao-seedance-2-0-260128');
    await addTake('shot');
    const events: CanvasJob[] = [];
    const jobs = new CanvasJobs(root, () => {}, event => events.push(event));
    await studioContext.run({ root }, async () => {
      expect(await jobs.update('main')).toEqual({ ok: true });
      expect(await jobs.generate({ asset: 'shot' }, false)).toEqual({ ok: true });
    });
    await until(() => !!renderSignal && !!takeSignal);

    await jobs.close();

    expect(renderSignal!.aborted).toBe(true);
    expect(takeSignal!.aborted).toBe(true);
    expect(unwound).toBe(true);
    expect(fixture.shipped).toBe(0);
    expect(events.some(event => event.status === 'failed' || event.status === 'done')).toBe(false);
    expect(jobs.state()).toEqual([]);
  });

  it('does not hold the shutdown open for a render that never lets go', async () => {
    let rendering = false;
    fixture.render = () => { rendering = true; return new Promise(() => {}); };
    const jobs = new CanvasJobs(root, () => {}, () => {});
    await studioContext.run({ root }, async () => { expect(await jobs.update('main')).toEqual({ ok: true }); });
    await until(() => rendering);
    vi.useFakeTimers();
    let done = false;
    const closing = jobs.close().then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(4_999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await closing;
    expect(done).toBe(true);
  });

  it('returns at once when nothing is running', async () => {
    await expect(new CanvasJobs(root, () => {}, () => {}).close()).resolves.toBeUndefined();
  });
});

// Ported from Orkas video_canvas_jobs.test.ts at fbcfd5820a (cdaf9cd221): an Update that the
// held-stills check stops waits for the user's one decision on that render. The account-switch
// variant is host-only; this canvas serves one production.
describe('an update paused because scenes hold still images', () => {
  afterEach(resetFixture);
  const finding = { percent: 76, scenes: [{ id: 'one', seconds: 2 }] };
  // Stands in for shipTimeline with the reviewHeldStills contract: it asks for the decision once,
  // and keeps the version only while the decision's guard still says it is current.
  function shipAfterReview() {
    const shipped = { delivered: false, guard: undefined as undefined | (() => boolean) | null };
    fixture.ship = async options => {
      const current = await options.reviewHeldStills(finding);
      shipped.guard = current;
      if (!current?.() || options.signal.aborted) return { ok: false, issues: [{ code: 'DELIVERY_HELD_STILLS', severity: 'error', message: 'held' }] };
      shipped.delivered = true;
      return { ok: true, version: { id: 'v2' } };
    };
    return shipped;
  }
  async function reviewOnCanvas(invoke: (method: string, params?: Record<string, unknown>) => Promise<any>) {
    for (const end = Date.now() + 5_000; Date.now() < end;) {
      const review = (await invoke('videoCanvas.read')).jobs?.find((job: any) => job.status === 'review')?.review;
      if (review) return review;
      await new Promise(done => setTimeout(done, 10));
    }
    throw new Error('no review offered');
  }

  it.each(['deliver', 'edit'] as const)('resolves a still-frame review only while it is the current one (%s)', async decision => {
    let renders = 0;
    fixture.render = async () => { renders++; return { ok: true }; };
    const shipped = shipAfterReview();
    const events: CanvasJob[] = [];
    const jobs = new CanvasJobs(root, () => {}, event => events.push(event));
    await studioContext.run({ root }, async () => { expect(await jobs.update('main')).toEqual({ ok: true }); });
    await until(() => events.some(event => event.status === 'review'));
    const review = events.find(event => event.status === 'review')!.review!;
    expect(jobs.state()).toMatchObject([{ video_id: 'main', kind: 'render', status: 'review', review: { ...finding, id: review.id } }]);
    // The render the user previews is the one the decision keeps.
    expect(review.preview_path.startsWith(join(root, 'render', 'main-'))).toBe(true);
    expect(review.preview_path.endsWith('.mp4')).toBe(true);
    expect(shipped.delivered).toBe(false);
    // Another Update cannot start over a render waiting for its decision.
    await studioContext.run({ root }, async () => { expect(await jobs.update('main')).toMatchObject({ ok: false, code: 'busy' }); });

    expect(await jobs.resolveDelivery('main', 'older-review', 'deliver', () => false)).toEqual({ ok: false, code: 'changed' });
    expect(await jobs.resolveDelivery('other', review.id, 'deliver', () => false)).toEqual({ ok: false, code: 'changed' });
    expect(await jobs.resolveDelivery('main', review.id, 'publish', () => false)).toEqual({ ok: false, code: 'invalid' });
    expect(await jobs.resolveDelivery('main', review.id, 'deliver', () => true)).toEqual({ ok: false, code: 'busy' });
    expect(await jobs.resolveDelivery('main', review.id, decision, () => false)).toEqual({ ok: true });
    // One decision per review.
    expect((await jobs.resolveDelivery('main', review.id, 'deliver', () => false)).ok).toBe(false);
    await until(() => jobs.state().length === 0);

    expect(shipped.delivered).toBe(decision === 'deliver');
    expect(events.at(-1)).toMatchObject(decision === 'deliver' ? { status: 'done', version: 'v2' } : { status: 'stopped' });
    expect(events.some(event => event.status === 'failed')).toBe(false);
    // Update anyway keeps the render it showed: nothing renders again.
    expect(renders).toBe(1);
  });

  it('keeps the version only while the Agent stays out of it after the user confirms', async () => {
    fixture.render = async () => ({ ok: true });
    const shipped = shipAfterReview();
    let busy = false;
    const jobs = new CanvasJobs(root, () => {}, () => {});
    await studioContext.run({ root }, async () => { expect(await jobs.update('main')).toEqual({ ok: true }); });
    await until(() => jobs.state().some(job => job.status === 'review'));
    const [{ review }] = jobs.state();
    expect(await jobs.resolveDelivery('main', review!.id, 'deliver', () => busy)).toEqual({ ok: true });
    await until(() => shipped.guard !== undefined);
    busy = true;
    expect(shipped.guard?.()).toBe(false);
  });

  it('stops the review, with no outcome, when the render is stopped or the service closes', async () => {
    fixture.render = async () => ({ ok: true });
    const shipped = shipAfterReview();
    const events: CanvasJob[] = [];
    const jobs = new CanvasJobs(root, () => {}, event => events.push(event));
    await studioContext.run({ root }, async () => { expect(await jobs.update('main')).toEqual({ ok: true }); });
    await until(() => jobs.state().some(job => job.status === 'review'));
    await jobs.stop(['main']);
    expect(jobs.state()).toEqual([]);
    expect(shipped.guard).toBeNull();
    await studioContext.run({ root }, async () => { expect(await jobs.update('main')).toEqual({ ok: true }); });
    await until(() => jobs.state().some(job => job.status === 'review'));
    await jobs.close();
    expect(jobs.state()).toEqual([]);
    expect(shipped.delivered).toBe(false);
    expect(events.some(event => event.status === 'failed' || event.status === 'done')).toBe(false);
  });

  it('says the video changed when the confirmed render no longer matches it', async () => {
    fixture.render = async () => ({ ok: true });
    fixture.ship = async options => {
      await options.reviewHeldStills(finding);
      return { ok: false, errorCode: 'E_VIDEO_SHIP_REVIEW_EXPIRED', message: 'The video changed. Update it again.' };
    };
    const events: CanvasJob[] = [];
    const jobs = new CanvasJobs(root, () => {}, event => events.push(event));
    await studioContext.run({ root }, async () => { expect(await jobs.update('main')).toEqual({ ok: true }); });
    await until(() => jobs.state().some(job => job.status === 'review'));
    const [{ review }] = jobs.state();
    expect(await jobs.resolveDelivery('main', review!.id, 'deliver', () => false)).toEqual({ ok: true });
    await until(() => events.at(-1)?.status === 'failed');
    expect(events.at(-1)).toMatchObject({ video_id: 'main', kind: 'render', status: 'failed', code: 'review_expired' });
    expect(events.at(-1)).not.toHaveProperty('review');
  });

  it('offers the decision on the canvas, and withdraws it once the Agent starts working', async () => {
    fixture.render = async () => ({ ok: true });
    const shipped = shipAfterReview();
    let busy = false;
    const { invoke } = await connect({ label: 'Original conversation', status: async () => ({ connected: true, busy, label: 'Original conversation' }), send: async () => ({ accepted: true }) });
    expect(await invoke('videoCanvas.render', { video: 'main' })).toEqual({ ok: true });
    const review = await reviewOnCanvas(invoke);
    expect(review).toMatchObject(finding);
    expect(await invoke('videoCanvas.resolveDelivery', { dir: '.', video: 'main', reviewId: 'older-review', decision: 'deliver' })).toEqual({ ok: false, code: 'changed' });
    busy = true;
    expect(await invoke('videoCanvas.resolveDelivery', { dir: '.', video: 'main', reviewId: review.id, decision: 'deliver' })).toEqual({ ok: false, code: 'busy' });
    expect((await invoke('videoCanvas.read')).jobs).toEqual([]);
    busy = false;
    expect(await invoke('videoCanvas.resolveDelivery', { dir: '.', video: 'main', reviewId: review.id, decision: 'deliver' })).toEqual({ ok: false, code: 'changed' });
    expect(shipped.delivered).toBe(false);
    expect((await invoke('studio.status')).jobs.at(-1)).toMatchObject({ video_id: 'main', status: 'stopped' });
  });

  // Review finding 2 (2026-11-25): the source's guard re-reads its busy state each time it is
  // asked; here the original conversation's busy state is re-read through its status owner.
  it('refuses the confirmed version when the original conversation becomes busy after the click', async () => {
    fixture.render = async () => ({ ok: true });
    let busy = false, delivered = false, release!: () => void;
    const recording = new Promise<void>(done => { release = done; });
    fixture.ship = async options => {
      const current = await options.reviewHeldStills(finding);
      // Delivery work between the click and recording the version.
      await recording;
      if (!current?.() || options.signal.aborted) return { ok: false, errorCode: 'E_VIDEO_SHIP_REVIEW_EXPIRED', message: 'The video changed. Update it again.' };
      delivered = true;
      return { ok: true, version: { id: 'v2' } };
    };
    const { invoke } = await connect({ label: 'Original conversation', status: async () => ({ connected: true, busy, label: 'Original conversation' }), send: async () => ({ accepted: true }) });
    expect(await invoke('videoCanvas.render', { video: 'main' })).toEqual({ ok: true });
    const review = await reviewOnCanvas(invoke);
    expect(await invoke('videoCanvas.resolveDelivery', { dir: '.', video: 'main', reviewId: review.id, decision: 'deliver' })).toEqual({ ok: true });
    // The original conversation starts a turn; the canvas' next status read sees it.
    busy = true;
    expect((await invoke('studio.status')).conversation).toMatchObject({ busy: true });
    release();
    let last: any;
    for (const end = Date.now() + 5_000; Date.now() < end && last?.status !== 'failed' && last?.status !== 'done';) {
      last = (await invoke('studio.status')).jobs.at(-1);
      await new Promise(done => setTimeout(done, 10));
    }
    expect(delivered).toBe(false);
    expect(last).toMatchObject({ video_id: 'main', status: 'failed', code: 'review_expired' });
  });

  it('keeps the version the user confirms on the canvas', async () => {
    fixture.render = async () => ({ ok: true });
    const shipped = shipAfterReview();
    const { invoke } = await connect();
    expect(await invoke('videoCanvas.render', { video: 'main' })).toEqual({ ok: true });
    const review = await reviewOnCanvas(invoke);
    expect(await invoke('videoCanvas.resolveDelivery', { dir: '.', video: 'main', reviewId: review.id, decision: 'deliver' })).toEqual({ ok: true });
    let last: any;
    for (const end = Date.now() + 5_000; Date.now() < end && last?.status !== 'done';) {
      last = (await invoke('studio.status')).jobs.at(-1);
      await new Promise(done => setTimeout(done, 10));
    }
    expect(shipped.delivered).toBe(true);
    expect(last).toMatchObject({ video_id: 'main', status: 'done', version: 'v2' });
  });

  // The contract with timeline ship itself (no stand-in): only the HyperFrames check and render are
  // replaced, the render by a cut whose two picture scenes stand still for four of six seconds.
  describe('with the real delivery check', () => {
    const ff = (args: string[]) => runOk(resolveFfmpegTools().ffmpeg, ['-v', 'error', '-nostdin', '-y', ...args], { timeoutMs: 120_000 });
    const encode = ['-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p'];
    const sha = async (file: string) => createHash('sha256').update(await fs.readFile(file)).digest('hex');
    const versions = async () => (JSON.parse(await fs.readFile(join(root, 'versions.json'), 'utf8').catch(() => '{}')) as { versions?: any[]; held_stills_stopped?: Record<string, string> });
    async function heldStillsProduction() {
      await fs.writeFile(join(root, 'assets.json'), JSON.stringify({ assets: [
        { id: 'shot', kind: 'image', label: 'Site', path: 'shot.png', origin: 'upload' },
        { id: 'walk', kind: 'video', label: 'Street', path: 'walk.mp4', origin: 'upload', duration: 2 },
      ] }));
      await ff(['-f', 'lavfi', '-i', 'color=c=0x336699:s=360x640:d=1', '-frames:v', '1', join(root, 'shot.png')]);
      await ff(['-f', 'lavfi', '-i', 'testsrc2=s=360x640:r=30:d=2', ...encode, join(root, 'walk.mp4')]);
      await fs.writeFile(join(root, 'videos/main/manifest.json'), JSON.stringify({ schema_version: 3, id: 'main', label: 'Ship', canvas: { width: 360, height: 640, fps: 30 }, scenes: [
        { id: 'hook', clips: [{ id: 'hook-shot', asset: 'shot', in: 0, dur: 2 }] },
        { id: 'site', clips: [{ id: 'site-shot', asset: 'shot', in: 0, dur: 2 }] },
        { id: 'street', clips: [{ id: 'street-walk', asset: 'walk', in: 0, dur: 2 }] },
      ] }));
      const cut = join(root, 'cut.mp4');
      await ff(['-f', 'lavfi', '-i', 'color=c=0x336699:s=360x640:r=30:d=4', '-f', 'lavfi', '-i', 'testsrc2=s=360x640:r=30:d=2', '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v]', '-map', '[v]', ...encode, cut]);
      const rendered = vi.spyOn(renderTool, 'render').mockImplementation(async params => { await fs.copyFile(cut, params.output); return { output: params.output } as any; });
      const actual = await vi.importActual<typeof import('../src/composition/timeline-actions.js')>('../src/composition/timeline-actions.js');
      fixture.render = p => actual.renderTimeline(p as Parameters<typeof actual.renderTimeline>[0]);
      return rendered;
    }
    afterEach(() => { vi.restoreAllMocks(); });

    it('waits for the decision outside the production lock, records nothing on Return to editing, and keeps the shown render on Update anyway', async () => {
      const rendered = await heldStillsProduction();
      const events: CanvasJob[] = [];
      const jobs = new CanvasJobs(root, () => {}, event => events.push(event));
      const update = () => studioContext.run({ root }, () => jobs.update('main'));
      expect(await update()).toEqual({ ok: true });
      await until(() => jobs.state().some(job => job.status === 'review') || events.some(event => event.status === 'failed'), 60_000);
      let [job] = jobs.state();
      expect(job).toMatchObject({ status: 'review', review: { percent: expect.any(Number), scenes: expect.arrayContaining([expect.objectContaining({ id: 'hook' }), expect.objectContaining({ id: 'site' })]) } });
      expect(job.review!.percent).toBeGreaterThan(50);
      expect(job.review!.scenes.map(scene => scene.id)).not.toContain('street');
      // Other canvas and Agent work on the production goes on while the user decides.
      await expect(withTimelineLock(root, async () => 'free')).resolves.toBe('free');
      expect(await jobs.resolveDelivery('main', job.review!.id, 'edit', () => false)).toEqual({ ok: true });
      await until(() => jobs.state().length === 0, 30_000);
      expect((await versions()).versions ?? []).toEqual([]);
      // Returning to editing is not a stop that lets the next file through with a warning.
      expect((await versions()).held_stills_stopped).toBeUndefined();

      expect(await update()).toEqual({ ok: true });
      await until(() => jobs.state().some(job => job.status === 'review'), 60_000);
      [job] = jobs.state();
      const previewed = await sha(job.review!.preview_path);
      expect(await jobs.resolveDelivery('main', job.review!.id, 'deliver', () => false)).toEqual({ ok: true });
      await until(() => jobs.state().length === 0, 60_000);
      expect(events.at(-1)).toMatchObject({ status: 'done', version: 'v1' });
      const [version] = (await versions()).versions!;
      expect(version).toMatchObject({ id: 'v1', video_id: 'main', sha256: previewed, override: { codes: ['DELIVERY_HELD_STILLS'], reason: 'User confirmed this rendered version on the video canvas.' } });
      // Update anyway does not render again: one render per Update.
      expect(rendered).toHaveBeenCalledTimes(2);
    }, 120_000);

    it('says the video changed when the timeline changed while the user decided', async () => {
      await heldStillsProduction();
      const events: CanvasJob[] = [];
      const jobs = new CanvasJobs(root, () => {}, event => events.push(event));
      expect(await studioContext.run({ root }, () => jobs.update('main'))).toEqual({ ok: true });
      await until(() => jobs.state().some(job => job.status === 'review') || events.some(event => event.status === 'failed'), 60_000);
      const [job] = jobs.state();
      expect(job.status).toBe('review');
      // Changed outside the canvas, for example by the Agent's own timeline command.
      const manifest = JSON.parse(await fs.readFile(join(root, 'videos/main/manifest.json'), 'utf8'));
      manifest.scenes = [manifest.scenes[1], manifest.scenes[0], manifest.scenes[2]];
      await fs.writeFile(join(root, 'videos/main/manifest.json'), JSON.stringify(manifest));
      expect(await jobs.resolveDelivery('main', job.review!.id, 'deliver', () => false)).toEqual({ ok: true });
      await until(() => events.at(-1)?.status === 'failed', 60_000);
      expect(events.at(-1)).toMatchObject({ status: 'failed', code: 'review_expired' });
      expect((await versions()).versions ?? []).toEqual([]);
    }, 120_000);
  });
});

import { spawn } from 'node:child_process';
import { acquireLease } from '../src/studio/lease.js';
it('allows one stale-lock recovery and never steals a live owner during concurrent recovery', async () => {
  const deadPid = await new Promise<number>((done, reject) => {
    const child = spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore' });
    child.once('error', reject); child.once('close', () => done(child.pid!));
  });
  const file = join(root, 'stale.lock'); await fs.writeFile(file, JSON.stringify({ pid: deadPid }));
  const attempts = await Promise.allSettled([acquireLease(file, true), acquireLease(file, true)]);
  expect(attempts.filter(attempt => attempt.status === 'fulfilled')).toHaveLength(1);
  await expect(acquireLease(file, true)).rejects.toThrow('busy');
  for (const attempt of attempts) if (attempt.status === 'fulfilled') await attempt.value.release();
});
