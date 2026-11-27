import * as fs from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fitVideoParameters, loadConfig, VEO_DURATIONS, VIDEO_MODEL_SPECS, type HeldStillsFinding, type VideoAssetRecord } from '@orkas/video-studio-core';
import { checkTimeline, renderTimeline, shipTimeline } from '../composition/timeline-actions.js';
import { readTimelineJson, timelineDigest, withTimelineLock, writeTimelineJson } from '../composition/timeline.js';
import { generateImage, validateGeneratedImage } from '../image/image.js';
import { generateVideo, type VideoParams } from '../video/video.js';
import { generateNativeVideo } from '../video/native.js';
import { INLINE_IMAGE_PROVIDERS, INLINE_VIDEO_PROVIDERS, localReference } from './references.js';
import { readGenerationRecord } from '../generation-record.js';
import { probeMedia } from '../edit/edit.js';
import { applyVideoCanvasEdit, readProductionLedger, readVideoCanvasDraft, settleVideoCanvasDraft, videoUpToDate } from './canvas.js';
import { isPathAllowed, recordCanvasDelivery } from './host.js';

/** `review`: an Update stopped only by the held-stills check, waiting for the user's one decision
 *  on that render (Orkas cdaf9cd221). */
export type CanvasJob = { dir: string; video_id?: string; kind: 'render' | 'redo' | 'new_shot'; status: 'running' | 'failed' | 'done' | 'stopped' | 'review'; review?: HeldStillsFinding & { id: string; preview_path: string }; shot?: string; phase?: string; code?: string; version?: string; asset_id?: string; swapped?: boolean; own_key?: boolean };
type Source = { kind: 'video' | 'image'; prompt: string; method: 'references' | 'frames'; inputs: string[]; choice?: string; ratio?: string; duration?: number; resolution?: string; audio?: boolean; shot: string; previous?: VideoAssetRecord; remoteImages?: string[]; remoteVideos?: string[] };

/** Renders and takes still running get this long to stop the renderer and remove partial files
 *  when the service closes (Orkas review 2026-11-16 S4-10). */
const CLOSE_UNWIND_MS = 5_000;

/**
 * A take's resolution and length as one service makes them, and the lengths it offers (decided
 * 2026-11-18, Orkas review S4-6): each is fitted by the rule the Agent's generation uses
 * (fitVideoParameters), so a take asks a service for the same thing from either. A length still
 * not offered (above the longest, since a canvas take is one shot) takes the next it offers, else
 * its longest. Veo makes 4, 6 or 8 seconds only. A service that times a video itself keeps the
 * length as asked.
 */
function videoOffer(provider: string, spec: { id: string; minDuration: number; maxDuration: number; autoDuration?: boolean }, resolution: string, duration: number) {
  const durations = provider === 'muapi' ? [5, 10]
    : provider === 'google-cloud' ? VEO_DURATIONS.filter(seconds => seconds >= spec.minDuration && seconds <= spec.maxDuration)
    : Array.from({ length: spec.maxDuration - spec.minDuration + 1 }, (_, i) => i + spec.minDuration);
  const fitted = fitVideoParameters({ resolution, duration }, provider, spec.id);
  const length = fitted.duration;
  return {
    resolution: fitted.resolution ?? resolution,
    // -1 asks a service that times the video itself to do so (fitVideoParameters keeps it only there).
    duration: length === undefined ? duration : length === -1 || durations.includes(length) ? length : durations.find(seconds => seconds >= length) ?? durations[durations.length - 1],
    durations: spec.autoDuration ? [-1, ...durations] : durations,
  };
}

export class CanvasJobs {
  private jobs = new Map<string, CanvasJob>();
  private controllers = new Map<string, AbortController>();
  private work = new Set<Promise<unknown>>();
  private workByKey = new Map<string, Promise<unknown>>();
  /** Answers the review a render waits on: a guard that still owns the update, or null to stop. */
  private answers = new Map<string, (isCurrent: (() => boolean) | null) => void>();
  constructor(private root: string, private changed: () => void, private emit: (event: CanvasJob) => void) {}
  state() { return [...this.jobs.values()].filter(j => j.status !== 'done' && j.status !== 'stopped'); }
  busy() { return [...this.jobs.values()].some(j => j.status === 'running'); }
  failedUpdate(video: string, stopped = false) { this.publish(`render:${video}`, { dir: '.', video_id: video, kind: 'render', status: stopped ? 'stopped' : 'failed', code: 'failed' }); }
  private publish(key: string, event: CanvasJob) { this.jobs.set(key, event); this.emit(event); this.changed(); }
  private run(key: string, job: CanvasJob, task: (signal: AbortSignal) => Promise<Partial<CanvasJob>>) {
    if (['running', 'review'].includes(this.jobs.get(key)?.status ?? '') || this.controllers.size >= 2) return { ok: false, code: 'busy' };
    const controller = new AbortController(); this.controllers.set(key, controller);
    this.publish(key, job);
    const work = (async () => {
      try { const extra = await task(controller.signal); this.publish(key, { ...job, ...extra, status: controller.signal.aborted ? 'stopped' : 'done' }); }
      catch (error) {
        const code = error instanceof Error && ['check_failed', 'render_failed', 'delivery_failed', 'review_expired', 'in_progress', 'changed', 'unsupported'].includes(error.message) ? error.message : 'failed';
        this.publish(key, { ...job, status: controller.signal.aborted ? 'stopped' : 'failed', code });
      }
      finally { this.controllers.delete(key); }
    })();
    this.work.add(work); this.workByKey.set(key, work); void work.finally(() => { this.work.delete(work); this.workByKey.delete(key); });
    return { ok: true };
  }
  /** Renders waiting for a decision on held stills. */
  reviewing() { return [...this.jobs.values()].filter(j => j.kind === 'render' && j.status === 'review' && j.video_id).map(j => j.video_id!); }
  /** The user's decision on the review a render waits on, while it is still that review: `edit`
   *  stops the render and returns to editing; `deliver` keeps the render shown, without rendering
   *  again, for as long as the Agent stays out of it (`isBusy`). */
  async resolveDelivery(video: unknown, reviewId: unknown, decision: unknown, isBusy: () => boolean) {
    if (decision !== 'deliver' && decision !== 'edit') return { ok: false, code: 'invalid' };
    const key = `render:${String(video)}`;
    const job = this.jobs.get(key), answer = this.answers.get(key);
    if (typeof video !== 'string' || !answer || job?.status !== 'review' || job.review?.id !== reviewId) return { ok: false, code: 'changed' };
    if (isBusy()) return { ok: false, code: 'busy' };
    if (decision === 'edit') { await this.stop([video]); return { ok: true }; }
    const { review: _review, ...state } = job;
    this.publish(key, { ...state, status: 'running', phase: 'deliver' });
    answer(() => !isBusy());
    return { ok: true };
  }
  async stop(videos: string[]) { for (const id of videos) this.controllers.get(`render:${id}`)?.abort(); await Promise.allSettled(videos.map(id => this.workByKey.get(`render:${id}`))); }
  /** Stop every render and take, and wait up to five seconds for them to stop the renderer and
   *  remove partial files, so one that never lets go cannot hold the service open. A stopped take
   *  is not cancelled at the service; it ends as any interrupted generation request does. */
  async close() {
    for (const controller of this.controllers.values()) controller.abort();
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([
      Promise.allSettled([...this.work]),
      new Promise<void>(done => { timer = setTimeout(done, CLOSE_UNWIND_MS); timer.unref?.(); }),
    ]);
    if (timer) clearTimeout(timer);
  }
  async update(video: string, options: { afterAgent?: boolean } = {}) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(video)) return { ok: false, code: 'invalid' };
    if (await videoUpToDate(this.root, video)) return { ok: true, unchanged: true };
    const productions = await import('./canvas.js').then(c => c.readVideoCanvasProductions('', ''));
    const card = productions[0]?.videos.find(v => v.id === video);
    if (!card) return { ok: false, code: 'not_found' };
    if (!options.afterAgent && (card.product_changes.length || card.narration_changes.length || card.voice_wanted)) return { ok: false, code: 'agent_required' };
    return this.run(`render:${video}`, { dir: '.', video_id: video, kind: 'render', status: 'running', phase: 'render' }, async signal => {
      const p = { production: this.root, video_id: video, signal };
      // A delivered video's words/order can change without rewriting its original creative
      // budget. Preserve that document; validate the edited timeline and actual browser runtime.
      // A user's own canvas edit is not held to the agent's narrated-sound check.
      if (!(await checkTimeline(p, { design: card.versions.length === 0, requireSound: false })).ok) throw new Error('check_failed');
      const output = join(this.root, 'render', `${video}-${randomUUID()}.mp4`);
      if (!(await renderTimeline({ ...p, output, requireSound: false })).ok) throw new Error('render_failed');
      signal.throwIfAborted();
      this.publish(`render:${video}`, { dir: '.', video_id: video, kind: 'render', status: 'running', phase: 'deliver' });
      // Stopped only for held stills, delivery waits for the user's decision on this render: it
      // previews the file, returns to editing, or keeps it as it is (Orkas cdaf9cd221).
      const reviewHeldStills = (finding: HeldStillsFinding) => signal.aborted ? Promise.resolve(null) : new Promise<(() => boolean) | null>(resolve => {
        const key = `render:${video}`;
        const abort = () => settle(null);
        const settle = (isCurrent: (() => boolean) | null) => {
          signal.removeEventListener('abort', abort);
          this.answers.delete(key);
          resolve(isCurrent);
        };
        signal.addEventListener('abort', abort, { once: true });
        this.answers.set(key, settle);
        this.publish(key, { dir: '.', video_id: video, kind: 'render', status: 'review', review: { ...finding, id: randomUUID(), preview_path: output } });
      });
      const shipped = await shipTimeline({ ...p, input: output, reviewHeldStills });
      if (!shipped.ok && 'errorCode' in shipped && shipped.errorCode === 'E_VIDEO_SHIP_REVIEW_EXPIRED') throw new Error('review_expired');
      if (!shipped.ok || !('version' in shipped) || !shipped.version) throw new Error('delivery_failed');
      await recordCanvasDelivery({ productionDirAbs: this.root, videoDirAbs: join(this.root, 'videos', video) });
      return { version: shipped.version.id };
    });
  }
  private async source(p: any, draft: boolean): Promise<Source> {
    const ledger = await readProductionLedger(this.root);
    if (!ledger) throw new Error('unreadable');
    if (draft) {
      const source = await readVideoCanvasDraft(this.root, p.id);
      if ('ok' in source) throw new Error(source.code);
      return { ...source.draft, shot: String(p.id) };
    }
    const row = ledger.find(r => r.id === p.asset);
    if (!row || row.origin !== 'generated' || row.kind === 'audio' || !row.request) throw new Error('not_found');
    const inputs = p.inputs ?? {};
    if (typeof inputs !== 'object' || Array.isArray(inputs) || inputs.added !== undefined && !Array.isArray(inputs.added)) throw new Error('invalid');
    const method = inputs.method ?? (row.refs?.some(r => r.role === 'first_frame') || row.request.first_frame_url ? 'frames' : 'references');
    const selected = [...(row.refs ?? []).map(r => r.asset), ...(inputs.added ?? [])];
    if (!['frames', 'references'].includes(method) || !Array.isArray(selected) || selected.length > 30 || selected.some(id => typeof id !== 'string')) throw new Error('invalid');
    return { kind: row.kind, prompt: p.prompt ?? row.prompt ?? '', method,
      inputs: [...new Set(selected)], remoteImages: [...(Array.isArray(row.request.reference_image_urls) ? row.request.reference_image_urls as string[] : []), ...[row.request.first_frame_url, row.request.last_frame_url].filter((url): url is string => typeof url === 'string')], remoteVideos: Array.isArray(row.request.reference_video_urls) ? row.request.reference_video_urls as string[] : [], shot: row.shot ?? row.id, previous: row,
      ratio: p.settings?.ratio ?? row.request.ratio as string, duration: p.settings?.duration ?? row.request.duration as number,
      resolution: p.settings?.resolution ?? row.request.resolution as string, audio: p.settings?.audio ?? row.request.generate_audio as boolean, choice: p.choice || row.model?.split('/').slice(1).join('/') || undefined };
  }
  private async choices(source: Source) {
    const config = loadConfig();
    const rows = await readProductionLedger(this.root) ?? [];
    const inputs = source.inputs.map(id => rows.find(r => r.id === id));
    if (inputs.some(r => !r || r.kind === 'audio' || !isPathAllowed(resolve(this.root, r.path), [this.root]))) throw new Error('invalid');
    const localImages = inputs.filter(r => r!.kind === 'image').length;
    const images = localImages + (source.remoteImages?.length ?? 0), videos = inputs.length - localImages + (source.remoteVideos?.length ?? 0);
    if (source.kind === 'image') return { ok: true, kind: 'image', choices: [], current: '', ...(!config.image?.api_key || videos || images > (config.image.provider === 'gemini' ? 4 : 0) ? { unavailable: { code: 'other' } } : {}) };
    const provider = config.video?.provider ?? 'doubao';
    const native = VIDEO_MODEL_SPECS[provider];
    const legacy = provider === 'atlas' ? [{ id: config.video?.model ?? 'bytedance/seedance-2.0/text-to-video', name: 'Atlas Cloud', minDuration: 4, maxDuration: 15, resolutions: ['720p','1080p'], ratios: ['16:9','9:16','1:1'], images: 0, videos: 0, frames: 'none', silent: true }] : provider === 'muapi' ? [{ id: config.video?.model ?? 'kling-v2.1-master-t2v', name: 'MuAPI', minDuration: 5, maxDuration: 10, resolutions: ['720p'], ratios: ['16:9','9:16','1:1'], images: 0, videos: 0, frames: 'none', silent: true }] : [];
    const choices = (native ?? legacy).map(spec => {
      const unavailable = !config.video?.api_key ? { code: 'other' }
        : source.method === 'frames' && (spec.frames === 'none' || videos || images < 1 || images > 2) ? { code: 'frames_inputs' }
        : source.method === 'frames' && images > 1 && spec.frames !== 'first_last' ? { code: 'last_frame' }
        : source.method === 'references' && images > spec.images ? { code: 'images', max: spec.images }
        : videos > spec.videos ? { code: 'videos', max: spec.videos }
        : localImages && !INLINE_IMAGE_PROVIDERS.has(provider) || inputs.length > localImages && !INLINE_VIDEO_PROVIDERS.has(provider) ? { code: 'other' } : undefined;
      const offer = videoOffer(provider, spec, source.resolution ?? spec.resolutions[0], source.duration ?? Math.min(5, spec.maxDuration));
      return { id: spec.id, name: spec.name, frames: spec.frames, params: { ratio: source.ratio ?? '16:9', resolution: offer.resolution, duration: offer.duration, audio: source.audio ?? true },
        ratios: spec.ratios, resolutions: spec.resolutions, durations: offer.durations, silent: spec.silent, ...(unavailable ? { unavailable } : {}) };
    });
    return { ok: true, kind: 'video', choices, current: source.choice ?? config.video?.model ?? choices[0]?.id ?? '', method: source.method, frames_fit: videos === 0 && images <= 2 };
  }
  async options(p: any, draft: boolean) { return this.choices(await this.source(p, draft)); }
  /** A video take as the panel shows it on the chosen service: a resolution or length that
   *  service does not make is fitted as `choices` fits it, so what is made is what was shown. */
  private async fitted(source: Source): Promise<Source> {
    if (source.kind !== 'video') return source;
    const options = await this.choices(source);
    const choice = (options.choices as any[]).find(c => c.id === options.current);
    if (!choice) return source;
    return { ...source,
      ...(source.resolution !== undefined ? { resolution: choice.params.resolution } : {}),
      ...(source.duration !== undefined ? { duration: choice.params.duration } : {}) };
  }
  private async recovery(shot: string) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,150}$/.test(shot)) throw new Error('invalid');
    const file = join(this.root, 'shots', `${shot}.canvas-request.json`);
    if (!isPathAllowed(file, [this.root])) throw new Error('invalid');
    const previous = await readTimelineJson(file, null) as any;
    if (!previous) return null;
    if (!previous.source || previous.source.shot !== shot || !['image', 'video'].includes(previous.source.kind) || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,180}$/.test(previous.id ?? '') || previous.output !== join(this.root, 'shots', `${previous.id}.${previous.source.kind === 'image' ? 'png' : 'mp4'}`) || !isPathAllowed(previous.output, [this.root])) throw new Error('in_progress');
    const profile = previous.source.kind === 'image' ? loadConfig().image : loadConfig().video;
    if (previous.provider !== profile?.provider || previous.model !== profile?.model) throw new Error('changed');
    const receiptFile = `${previous.output}.video-task.json`;
    if (!isPathAllowed(receiptFile, [this.root])) throw new Error('invalid');
    const receipt = await readTimelineJson(receiptFile, null) as any;
    const output = await fs.stat(previous.output).catch(() => null);
    return { ...previous, claim: file, task: receipt?.phase === 'accepted' && receipt.provider === loadConfig().video?.provider ? receipt.task_id : undefined, complete: output?.isFile() && output.size > 0 };
  }
  async quote(p: any, draft: boolean) {
    const source = await this.source(p, draft);
    const recovery = await this.recovery(source.shot);
    if (this.jobs.get(`generate:${source.shot}`)?.status === 'running') return { ok: false, code: 'busy' };
    if (recovery) return recovery.task || recovery.complete ? { ok: true, own_key: true, sufficient: true, resume: true } : { ok: false, code: 'in_progress' };
    const options = await this.choices(source);
    if ('unavailable' in options && options.unavailable || source.kind === 'video' && !(options.choices as any[]).some(c => c.id === options.current && !c.unavailable)) return { ok: false, code: 'unsupported' };
    return { ok: true, own_key: true, sufficient: true, resume: false };
  }
  async generate(p: any, draft: boolean) {
    let source = await this.source(p, draft);
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,150}$/.test(source.shot)) return { ok: false, code: 'invalid' };
    const quote = await this.quote(p, draft);
    if (!quote.ok) return quote;
    const recovery = await this.recovery(source.shot);
    if (recovery) source = recovery.source;
    else source = await this.fitted(source);
    if (!source.prompt.trim() || source.prompt.length > 20_000) return { ok: false, code: 'invalid' };
    const key = `generate:${source.shot}`;
    if (this.jobs.get(key)?.status === 'running') return { ok: false, code: 'busy' };
    const directory = join(this.root, 'shots'); await fs.mkdir(directory, { recursive: true });
    if (!isPathAllowed(directory, [this.root])) return { ok: false, code: 'invalid' };
    const id = recovery?.id ?? `${source.shot}-${randomUUID().slice(0, 8)}`;
    const output = recovery?.output ?? join(directory, `${id}.${source.kind === 'image' ? 'png' : 'mp4'}`);
    const claim = join(directory, `${source.shot}.canvas-request.json`);
    const config = loadConfig(), profile = source.kind === 'image' ? config.image : config.video;
    if (!recovery) {
      const handle = await fs.open(claim, 'wx').catch(() => null);
      if (!handle) return { ok: false, code: 'in_progress' };
      await handle.writeFile(JSON.stringify({ state: 'dispatching', id, output, source, provider: profile?.provider, model: profile?.model, created_at: new Date().toISOString() })); await handle.close();
    }
    const started = this.run(key, { dir: '.', kind: draft ? 'new_shot' : 'redo', shot: source.shot, status: 'running', phase: recovery ? 'collect' : 'generate' }, async signal => {
      const rows = await readProductionLedger(this.root) ?? [];
      const refs = source.inputs.map(asset => rows.find(r => r.id === asset));
      if (refs.some(r => !r)) throw new Error('changed');
      try { if (!recovery?.complete) {
        if (source.kind === 'image') await generateImage({ prompt: source.prompt, output, reference_images: refs.map(r => resolve(this.root, r!.path)), reference_image_urls: source.remoteImages, model: source.previous?.model?.startsWith(`${config.image?.provider ?? 'openai'}/`) ? source.previous.model.split('/').slice(1).join('/') : undefined, negative_prompt: source.previous?.request?.negative_prompt as string[] | undefined, reference_bindings: source.previous?.request?.reference_bindings as any, ...(typeof source.previous?.request?.size === 'string' ? { size: source.previous.request.size } : {}) }, config);
        else {
          const urls = [...(source.remoteImages ?? []), ...(source.remoteVideos ?? [])];
          const kinds = [...(source.remoteImages ?? []).map(() => 'image'), ...(source.remoteVideos ?? []).map(() => 'video'), ...refs.map(ref => ref!.kind)];
          for (const ref of refs) urls.push(await localReference(this.root, ref!));
          const params = { prompt: source.prompt, output, model: source.choice || config.video?.model,
            ratio: source.ratio as VideoParams['ratio'], duration: source.duration, resolution: source.resolution as VideoParams['resolution'], generate_audio: source.audio,
            ...(source.method === 'frames' ? { first_frame_url: urls[0], last_frame_url: urls[1] } : { reference_image_urls: urls.filter((_, i) => kinds[i] === 'image'), reference_video_urls: urls.filter((_, i) => kinds[i] === 'video') }) };
          if (config.video?.provider && VIDEO_MODEL_SPECS[config.video.provider]) await generateNativeVideo(params, config.video, { signal, resumeTaskId: recovery?.task });
          else await generateVideo(params, config, { signal });
        }
      } } catch (error) {
        if (source.kind === 'video' && profile?.provider && VIDEO_MODEL_SPECS[profile.provider]) {
          const receipt = await readTimelineJson(`${output}.video-task.json`, null) as { phase?: string } | null;
          if (!receipt || receipt.phase === 'preflight') { await fs.rm(claim, { force: true }); if (receipt) await fs.rm(`${output}.video-task.json`, { force: true }); }
        }
        throw error;
      }
      if (source.kind === 'image') validateGeneratedImage(await fs.readFile(output));
      const recorded = await readGenerationRecord(output);
      const row: VideoAssetRecord = { id, kind: source.kind, label: source.previous?.label ?? source.shot, path: relative(this.root, output).replaceAll('\\', '/'), origin: 'generated', shot: source.shot, prompt: source.prompt,
        sha256: await timelineDigest(output), ...(recorded?.model ? { model: recorded.model } : {}),
        refs: source.inputs.map((asset, index) => ({ asset, role: source.method === 'frames' ? index === 0 ? 'first_frame' : 'last_frame' : 'reference' })),
        request: { ...(recorded?.request ?? source.previous?.request ?? {}), ratio: source.ratio, duration: source.duration, resolution: source.resolution, generate_audio: source.audio } };
      if (source.kind === 'video') {
        const measured = await probeMedia(output);
        if (!(measured.duration > 0 && measured.width > 0 && measured.height > 0)) throw new Error('failed');
        row.duration = measured.duration;
      }
      await withTimelineLock(this.root, async () => {
        const ledger = await readTimelineJson(join(this.root, 'assets.json'), { assets: [] }) as { assets: VideoAssetRecord[] };
        if (!ledger.assets.some(r => r.id === id)) await writeTimelineJson(join(this.root, 'assets.json'), { ...ledger, assets: [...ledger.assets, row] });
        const swapped = await applyVideoCanvasEdit({ uid: '', cid: '', dir: '.', busy: false, edit: { kind: 'use_result', asset: id } });
        if (!swapped.ok && swapped.code !== 'not_found') throw new Error('changed');
        if (draft) await settleVideoCanvasDraft(this.root, source.shot);
      });
      await fs.rm(claim);
      return { asset_id: id, own_key: true };
    });
    if (!started.ok && !recovery) await fs.rm(claim, { force: true });
    return started;
  }
}
