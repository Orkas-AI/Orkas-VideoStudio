import { deliveredFrames, deliveredHints, type DeliveredSceneSpan } from './timeline-evidence.js';
import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { deriveVideoTimeline, extractCssImports, extractCssUrls, extractHtmlResourceRefs, parseHtmlStructure, parseVideoManifest, silentSceneIssues, spokenWords, timelineAudioTracks, VideoAssetLedgerSchema, type HeldStillsFinding, type VideoEdl, type VideoManifestV3 } from '@orkas/video-studio-core';
import { screenStepIssues } from './screens.js';
import { render, check, snapshot, qaHasBlockingFailure } from '../render/render.js';
import { verifyTimelineDelivery } from '../render/delivery.js';
import { originalClipAudioWarnings, type KeptClipAudio } from '../render/narration-playback.js';
import { compareWithReference, writeReferenceComparisonSheet } from '../render/reference-compare.js';
import { prepareTimeline, readTimelineJson, timelineContained, timelineDigest, withTimelineLock, writeTimelineJson } from './timeline.js';

type Scope = { production: string; video_id?: string; signal?: AbortSignal };
const videoFolder = (root: string, id: string) => {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) throw new Error('Invalid video id.');
  return join(root, 'videos', id);
};
async function inputHash(root: string, project: string, signal?: AbortSignal) {
  const hashes: string[] = [];
  hashes.push(await timelineDigest(join(project, 'manifest.json'), signal));
  for (const file of ['product.json', 'assets.json']) hashes.push(await timelineDigest(join(root, file), signal).catch((e: NodeJS.ErrnoException) => { if (e.code === 'ENOENT') return ''; throw e; }));
  // Include actual referenced bytes: replacing an audio or image in place invalidates a render.
  const ledger = VideoAssetLedgerSchema.parse(await readTimelineJson(join(root, 'assets.json'), { assets: [] }));
  if (ledger.assets.length > 1000 || new Set(ledger.assets.map(a => a.id)).size !== ledger.assets.length) throw new Error('Asset ids must be unique, with at most 1000 records.');
  const parsed = parseVideoManifest(await readTimelineJson(join(project, 'manifest.json')));
  if (!parsed.manifest) throw new Error('Invalid timeline manifest.');
  const used = new Set(parsed.manifest.scenes.flatMap(s => [...(s.clips ?? []).map(c => c.asset), ...(s.narration?.asset ? [s.narration.asset] : [])]).concat((parsed.manifest.tracks ?? []).map(t => t.asset)));
  for (const row of ledger.assets.filter(a => used.has(a.id))) {
    signal?.throwIfAborted();
    const file = timelineContained(root, await fs.realpath(resolve(root, row.path)));
    hashes.push(await timelineDigest(file, signal));
  }
  return createHash('sha256').update(JSON.stringify(hashes)).digest('hex');
}
/** Hash the local resources the frozen project serves, using their authored URL paths. */
async function linkedInputs(project: string, html: string, signal?: AbortSignal) {
  const queue: Array<{ base: string; ref: string }> = [];
  const resources = new Map<string, string | null>();
  const enqueue = (base: string, refs: string[]) => {
    for (const ref of refs) queue.push({ base, ref });
  };
  const enqueueHtml = (base: string, markup: string) => {
    const structure = parseHtmlStructure(markup);
    enqueue(base, extractHtmlResourceRefs(structure).map(item => item.ref));
    for (const tag of structure.tags) {
      if (tag.tagName === 'style' && tag.rawText) enqueue(base, extractCssImports(tag.rawText));
      if (tag.attrs['data-composition-src']) enqueue(base, [tag.attrs['data-composition-src']]);
    }
  };
  enqueueHtml(project, html);
  for (const { base, ref } of queue) {
    signal?.throwIfAborted();
    if (queue.length > 10_000) throw new Error('The page references too many local resources.');
    const urlPath = ref.trim().split(/[?#]/, 1)[0];
    if (!urlPath || /^(?:[a-z][a-z0-9+.-]*:|[\\/])/i.test(urlPath)) continue;
    let decoded = urlPath;
    try { decoded = decodeURIComponent(urlPath); } catch { /* Keep the authored path. */ }
    const file = resolve(base, decoded.replaceAll('\\', '/'));
    const key = relative(project, file);
    if (!key || isAbsolute(key) || key.split(sep)[0] === '..' || resources.has(key)) continue;
    resources.set(key, null);
    const actual = await fs.realpath(file).catch((error: NodeJS.ErrnoException) => {
      if (['ENOENT', 'ENOTDIR', 'ELOOP'].includes(error.code ?? '')) return null;
      throw error;
    });
    if (!actual) continue;
    const target = relative(project, actual);
    if (!target || isAbsolute(target) || target.split(sep)[0] === '..') continue;
    const info = await fs.stat(actual);
    if (!info.isFile()) continue;
    const type = extname(file).toLowerCase();
    if (type === '.css' || type === '.html' || type === '.htm') {
      if (info.size > 2 * 1024 * 1024) throw new Error('A linked page or stylesheet exceeds 2 MiB.');
      const bytes = await fs.readFile(actual, { signal });
      const text = bytes.toString('utf8');
      if (type === '.css') enqueue(dirname(file), [...extractCssImports(text), ...extractCssUrls(text)]);
      else enqueueHtml(dirname(file), text);
      resources.set(key, createHash('sha256').update(bytes).digest('hex'));
    } else {
      resources.set(key, await timelineDigest(actual, signal));
    }
  }
  return [...resources].sort(([a], [b]) => a.localeCompare(b));
}
async function sourceHash(root: string, project: string, signal?: AbortSignal) {
  const html = await fs.readFile(join(project, 'index.html'), { signal });
  return createHash('sha256').update(JSON.stringify([
    await inputHash(root, project, signal), createHash('sha256').update(html).digest('hex'),
    await timelineDigest(join(project, 'composition-manifest.json'), signal),
    await linkedInputs(project, html.toString('utf8'), signal),
  ])).digest('hex');
}
export async function timelineStatus(p: Scope) {
  const root = await fs.realpath(resolve(p.production));
  const project = timelineContained(root, await fs.realpath(videoFolder(root, p.video_id ?? 'main')));
  const parsed = parseVideoManifest(await readTimelineJson(join(project, 'manifest.json')));
  if (!parsed.manifest) return { ok: false, issues: parsed.issues };
  const timeline = deriveVideoTimeline(parsed.manifest);
  const rendered = await readTimelineJson(join(project, '.ovs-render.json'), null) as Record<string, unknown> | null;
  return { ok: true, project, timeline, rendered, stale: !rendered || rendered.source_sha256 !== await sourceHash(root, project, p.signal) };
}
async function preparedManifest(project: string): Promise<VideoManifestV3> {
  const parsed = parseVideoManifest(await readTimelineJson(join(project, 'manifest.json')));
  if (!parsed.manifest) throw new Error('Invalid timeline manifest.');
  return parsed.manifest;
}
/** A narrated video that would go silent is fixed before an agent's check or render passes it.
 *  The canvas re-renders a user's own edit without this check (`requireSound: false`). */
function soundIssues(manifest: VideoManifestV3, requireSound: boolean | undefined) {
  return requireSound === false ? [] : silentSceneIssues(manifest).filter(issue => issue.severity === 'error');
}
/** Advisory: scenes that hold a screen-like still with no step shown on it. */
async function screenAdvice(production: string, project: string, manifest: VideoManifestV3) {
  const root = await fs.realpath(resolve(production));
  const used = new Set(manifest.scenes.flatMap(s => (s.clips ?? []).map(c => c.asset)));
  const ledger = VideoAssetLedgerSchema.parse(await readTimelineJson(join(root, 'assets.json'), { assets: [] }));
  const stills = new Map<string, string>();
  for (const row of ledger.assets) {
    if (row.kind !== 'image' || !used.has(row.id)) continue;
    const file = await fs.realpath(resolve(root, row.path)).catch(() => null);
    if (file) stills.set(row.id, timelineContained(root, file));
  }
  if (!stills.size) return [];
  const timeline = deriveVideoTimeline(manifest);
  return screenStepIssues({ html: await fs.readFile(join(project, 'index.html'), 'utf8'), scenes: timeline.scenes, fps: timeline.fps, stills });
}
export async function checkTimeline(p: Scope, options: { design?: boolean; requireSound?: boolean } = {}) {
  const prepared = await prepareTimeline(p);
  if (!prepared.ok) return prepared;
  const manifest = await preparedManifest(prepared.project);
  const silent = soundIssues(manifest, options.requireSound);
  if (silent.length) return { ...prepared, ok: false, issues: [...prepared.issues, ...silent] };
  const advice = await screenAdvice(p.production, prepared.project, manifest);
  const result = await check(prepared.project, p.signal, { design: options.design });
  return { ...prepared, ...(advice.length ? { issues: [...prepared.issues, ...advice] } : {}), ok: !qaHasBlockingFailure(result), check: result };
}
export async function snapshotTimeline(p: Scope & { output: string; scene_ids?: string[] }) {
  const prepared = await prepareTimeline(p);
  if (!prepared.ok) return prepared;
  return snapshot({ project: prepared.project, output: p.output, timeline: prepared.timeline, sceneIds: p.scene_ids, signal: p.signal });
}

/** Capture the prepared video directory, including authored local dependencies. */
async function copyRenderProject(project: string, destination: string, signal?: AbortSignal) {
  const links: Array<{ path: string; target: string; type: 'dir' | 'file' }> = [];
  await fs.cp(project, destination, {
    recursive: true,
    mode: constants.COPYFILE_FICLONE,
    filter: async (source, target) => {
      signal?.throwIfAborted();
      const local = relative(project, source);
      if (['snapshots', '.git', 'node_modules'].includes(local.split(sep)[0]) || local === '.ovs-render.json') return false;
      const info = await fs.lstat(source);
      if (info.isSymbolicLink()) {
        const resolved = await fs.realpath(source).catch((error: NodeJS.ErrnoException) => {
          if (error.code === 'ENOENT' || error.code === 'ELOOP') return null;
          throw error;
        });
        if (resolved) {
          const linkTarget = relative(project, resolved);
          if (!isAbsolute(linkTarget) && linkTarget.split(sep)[0] !== '..') {
            const type = (await fs.stat(resolved)).isDirectory() ? 'dir' : 'file';
            links.push({ path: target, target: relative(dirname(target), join(destination, linkTarget)) || '.', type });
          }
        }
        return false;
      }
      return info.isDirectory() || info.isFile();
    },
  });
  for (const link of links) {
    signal?.throwIfAborted();
    await fs.symlink(link.target, link.path, link.type);
  }
}

export async function renderTimeline(p: Scope & { output: string; quality?: 'draft' | 'high'; onProgress?: (text: string) => void; requireSound?: boolean }) {
  const initialRoot = await fs.realpath(resolve(p.production));
  const initialProject = timelineContained(initialRoot, await fs.realpath(videoFolder(initialRoot, p.video_id ?? 'main')));
  const inputs = await inputHash(initialRoot, initialProject, p.signal);
  const prepared = await prepareTimeline(p);
  if (!prepared.ok) return prepared;
  const silent = soundIssues(await preparedManifest(prepared.project), p.requireSound);
  if (silent.length) return { ...prepared, ok: false, issues: [...prepared.issues, ...silent] };
  return withTimelineLock(p.production, async root => {
    if (inputs !== await inputHash(root, prepared.project, p.signal)) throw new Error('The project changed during preparation; prepare and render it again.');
    const state = await readTimelineJson(join(prepared.project, '.ovs-timeline.json')) as { html_sha256?: string };
    if (state.html_sha256 !== await timelineDigest(join(prepared.project, 'index.html'))) throw new Error('The page changed after preparation; prepare and render it again.');
    const signature = await sourceHash(root, prepared.project, p.signal);
    // Render to a temporary path so an interrupted renderer cannot erase a previous result.
    const out = resolve(p.output), temporary = `${out}.${randomUUID()}.mp4`;
    const snapshot = await fs.mkdtemp(join(root, '.ovs-render-'));
    try {
      const captured = join(snapshot, basename(prepared.project));
      await copyRenderProject(prepared.project, captured, p.signal);
      if (state.html_sha256 !== await timelineDigest(join(captured, 'index.html'), p.signal)
        || signature !== await sourceHash(root, captured, p.signal)) {
        throw new Error('The timeline changed while capturing render inputs; render it again.');
      }
      await fs.mkdir(resolve(out, '..'), { recursive: true });
      await render({ project: captured, output: temporary, quality: p.quality, signal: p.signal, onProgress: p.onProgress });
      // The live project can advance. Status and delivery still compare it with this signature.
      const outputSha = await timelineDigest(temporary, p.signal);
      p.signal?.throwIfAborted();
      await fs.rename(temporary, out);
      const record = { source_sha256: signature, output_sha256: outputSha, output: out, rendered_at: new Date().toISOString(), visual_review: { status: 'not_checked' } };
      await writeTimelineJson(join(prepared.project, '.ovs-render.json'), record);
      return { ok: true, ...record };
    } finally {
      await Promise.all([fs.rm(temporary, { force: true }), fs.rm(snapshot, { recursive: true, force: true })]);
    }
  });
}

type Version = { id: string; video_id?: string; path: string; sha256: string; duration_sec: number | null; shipped_at: string; warnings: string[]; visual_review: { status: 'not_checked' }; product_facts?: Array<{ id: string; text: string }>; integrated_lufs?: number | null; override?: { codes: string[]; reason: string } };
type StoredVersions = { versions: Version[]; delivered_signatures?: Record<string, string>; delivered_narration?: Record<string, string[]>; delivered_products?: Record<string, { version: string; facts: Array<{ id: string; text: string }> }>; delivered_frames?: Record<string, { version: string; scenes: Record<string, string> }>; held_stills_stopped?: Record<string, string> };
async function readVersions(root: string) {
  const stored = await readTimelineJson(join(root, 'versions.json'), { versions: [], delivered_narration: {} }) as StoredVersions;
  if (!Array.isArray(stored?.versions) || stored.versions.length > 10_000) throw new Error('Repair versions.json before delivering; the existing history was left intact.');
  return stored;
}
/** Update compares against the published version, even when a newer draft has already rendered. */
export async function timelineDeliveryIsCurrent(p: Scope) {
  const root = await fs.realpath(resolve(p.production));
  const id = p.video_id ?? 'main';
  const project = timelineContained(root, await fs.realpath(videoFolder(root, id)));
  const stored = await readVersions(root);
  const latest = stored.versions.filter(version => version.video_id === id).at(-1);
  if (!latest) return false;
  let signature = stored.delivered_signatures?.[id];
  if (!signature) {
    const renderRecord = await readTimelineJson(join(project, '.ovs-render.json'), null) as { output_sha256?: string; source_sha256?: string } | null;
    if (renderRecord?.output_sha256 !== latest.sha256) return false;
    signature = renderRecord?.source_sha256;
  }
  if (!signature) return false;
  return signature === await sourceHash(root, project, p.signal).catch(error => {
    if (p.signal?.aborted) throw error;
    return null;
  });
}
const heldStoppedOf = (stored: StoredVersions): Record<string, string> => stored.held_stills_stopped && typeof stored.held_stills_stopped === 'object' && !Array.isArray(stored.held_stills_stopped) ? stored.held_stills_stopped : {};
/** A canvas review answered for a file, timeline or latest version that has since changed. */
const REVIEW_EXPIRED = { ok: false, errorCode: 'E_VIDEO_SHIP_REVIEW_EXPIRED', message: 'The video changed. Update it again.' } as const;
const TIMELINE_CHANGED = { code: 'DELIVERY_TIMELINE_CHANGED', severity: 'error', message: 'Render the current timeline before delivering this file.' } as const;
const CANVAS_REVIEW_REASON = 'User confirmed this rendered version on the video canvas.';

export type ShipTimelineInput = Scope & {
  input: string; accept_findings?: string[]; accept_reason?: string; cut_to_beat?: boolean; reference?: string;
  /** `durationSec` is the requested length: a difference is advice, with or without a timeline.
   *  `captions` is deprecated and ignored: burned captions cannot be read from the container. */
  expect?: { durationSec?: number; aspect?: string; audio?: boolean; captions?: boolean };
  /** The canvas' own update. Called, outside the production lock, only when held stills are the one
   *  finding that stops the file; resolves with a guard that must still hold when the version is
   *  recorded, or null to leave the stop. This route keeps no one-round stop record. */
  reviewHeldStills?: (finding: HeldStillsFinding) => Promise<(() => boolean) | null>;
};
export async function shipTimeline(p: ShipTimelineInput) {
  const first = await withTimelineLock(p.production, async root => {
    const input = await fs.realpath(resolve(p.input));
    const initial = await fs.stat(input);
    const sha = await timelineDigest(input, p.signal);
    const inputIsCurrent = async () => {
      const now = await fs.stat(input).catch(() => null);
      return !!now && now.dev === initial.dev && now.ino === initial.ino && now.size === initial.size
        && now.mtimeMs === initial.mtimeMs && now.ctimeMs === initial.ctimeMs;
    };
    const reference = p.reference ? await fs.realpath(resolve(p.reference)) : undefined;
    if (p.accept_findings?.length && (!p.accept_reason?.trim() || p.accept_findings.length > 32)) throw new Error('Accepting named delivery findings requires the actual user decision and its reason.');
    const accepted = new Set(p.accept_findings ?? []);
    const sceneEnds: number[] = [];
    const sceneSamples: Array<{ id: string; start: number; end: number }> = [];
    const sceneSpans: DeliveredSceneSpan[] = [];
    const keptClipAudio: KeptClipAudio[] = [];
    let stored = await readVersions(root);
    const issues: Array<{ code: string; severity: 'error' | 'warning'; message: string }> = [];
    const voiced: Array<{ sha: string; text: string }> = [];
    // The requested length is advice on every route; only a timeline's own length blocks.
    const { durationSec: requestedDurationSec, ...expected } = p.expect ?? {};
    const requested = typeof requestedDurationSec === 'number' ? { requestedDurationSec } : {};
    let plan: VideoEdl = { aspect: p.expect?.aspect ?? '', total_target_sec: 0, language: '', segments: [], tracks: {}, delivery_promise: { type: 'compose_led', source_required: false, motion_min_ratio: 0 } };
    let expectation: Parameters<typeof verifyTimelineDelivery>[4] = { ...expected, ...requested };
    let project: string | undefined;
    let renderedSignature: string | undefined;
    if (p.video_id) {
      project = timelineContained(root, await fs.realpath(videoFolder(root, p.video_id)));
      const parsed = parseVideoManifest(await readTimelineJson(join(project, 'manifest.json')));
      if (!parsed.manifest) return { kind: 'done' as const, result: { ok: false, issues: parsed.issues } };
      const manifest = parsed.manifest, timeline = deriveVideoTimeline(manifest);
      sceneEnds.push(...timeline.scenes.map(s => s.startSec + s.durationSec));
      sceneSamples.push(...timeline.scenes.map(s => ({ id: s.id, start: s.startSec, end: s.startSec + s.durationSec })));
      const ledger = VideoAssetLedgerSchema.parse(await readTimelineJson(join(root, 'assets.json'), { assets: [] }));
      const assets = new Map(ledger.assets.map(row => [row.id, row]));
      sceneSpans.push(...timeline.scenes.map(s => {
        const kinds = (manifest.scenes[s.index].clips ?? []).map(clip => assets.get(clip.asset)?.kind);
        // Footage is left out of held stills only while it plays, sequential or laid over.
        const footage = s.clips.filter(clip => assets.get(clip.assetId)?.kind === 'video')
          .map(clip => ({ startSec: (s.startFrame + clip.startFrame) / timeline.fps, endSec: (s.startFrame + clip.startFrame + clip.frameCount) / timeline.fps }));
        return { id: s.id, startSec: s.startSec, endSec: s.startSec + s.durationSec, footage, pictures: kinds.includes('image') };
      }));
      const audioTracks = timelineAudioTracks({ manifest, timeline, resolve: id => id });
      for (const track of audioTracks) {
        const row = assets.get(track.absPath);
        if (track.inSec === undefined || track.durSec === undefined || track.volume <= 0 || row?.kind !== 'video') continue;
        // A kept clip whose file is gone or outside the production gives nothing to compare.
        const source = await fs.realpath(resolve(root, row.path)).then(file => timelineContained(root, file)).catch(() => null);
        if (source) keptClipAudio.push({ source, sourceStartSec: track.inSec, startSec: track.startSec, durationSec: track.durSec });
      }
      const record = await readTimelineJson(join(project, '.ovs-render.json'), null) as { source_sha256?: string; output_sha256?: string } | null;
      renderedSignature = record?.source_sha256;
      if (!renderedSignature || record?.output_sha256 !== sha || renderedSignature !== await sourceHash(root, project, p.signal)) {
        return { kind: 'done' as const, result: { ok: false, issues: [TIMELINE_CHANGED] } };
      }
      expectation = { ...expected, ...requested, durationSec: timeline.durationSec, aspect: `${manifest.canvas.width}:${manifest.canvas.height}`, audio: audioTracks.some(t => t.volume > 0) };
      const narration = [];
      for (const scene of timeline.scenes) {
        const declared = manifest.scenes[scene.index].narration;
        if (!declared?.asset) continue;
        const asset = assets.get(declared.asset);
        if (!asset) throw new Error('A narration asset is missing.');
        const file = timelineContained(root, await fs.realpath(resolve(root, asset.path)));
        const sha = await timelineDigest(file, p.signal);
        const earlier = stored.delivered_narration?.[sha];
        if (asset.origin === 'generated' && earlier?.length && !earlier.some(text => spokenWords(text) === spokenWords(declared.text))) issues.push({ code: 'DELIVERY_NARRATION_NOT_REVOICED', severity: 'error', message: `Narration for scene ${scene.id} has changed words but unchanged audio; update the recording before delivering.` });
        if (asset.origin === 'generated') voiced.push({ sha, text: declared.text });
        narration.push({ text: declared.text, produced_path: file, start_sec: scene.startSec, target_sec: scene.durationSec });
      }
      plan = { ...plan, aspect: expectation.aspect!, total_target_sec: timeline.durationSec, tracks: { narration: { segments: narration } } };
    }
    const { checked, heard } = await verifyTimelineDelivery(plan, join(root, 'plan.json'), input, p.signal, expectation);
    issues.push(...checked.issues);
    // Stopped for held stills, a video gets one round of changes: a later file of it, even one still
    // held, is delivered with the finding as a warning; the same file is stopped again. The canvas
    // asks the user instead, so its own update keeps no such round.
    const heldStopped = heldStoppedOf(stored);
    const stoppedSha = p.video_id && typeof heldStopped[p.video_id] === 'string' && /^[0-9a-f]{64}$/.test(heldStopped[p.video_id]) ? heldStopped[p.video_id] : undefined;
    const held: { finding?: HeldStillsFinding } = {};
    if (checked.spec?.durationSec) issues.push(...await deliveredHints(input, checked.spec.durationSec, p.cut_to_beat === true, p.signal, p.video_id ? {
      sceneSpans, stoppedBefore: !p.reviewHeldStills && !!stoppedSha && stoppedSha !== sha,
      ...(p.reviewHeldStills ? { onHeldStills: (finding: HeldStillsFinding) => { held.finding = finding; } } : {}),
    } : undefined));
    const checkedLatest = stored.versions.filter(v => v.video_id === p.video_id).at(-1);
    /** Publishes the checked file. `stillReviewed` re-checks a canvas review after each slow step
     *  and just before recording; once it fails, nothing is recorded and the copy and frames go. */
    const deliver = async (reason: string | undefined, stillReviewed?: () => Promise<boolean>) => {
      // A delivery ends the round of changes a held-stills stop began.
      const { [p.video_id ?? '']: _ended, ...stillStopped } = heldStoppedOf(stored);
      const heldRecord = { held_stills_stopped: Object.keys(stillStopped).length ? stillStopped : undefined };
      // Measured only for a delivery that goes ahead: a blocked one is fixed first. A comparison that cannot run says nothing.
      const comparison = reference ? await compareWithReference({ reference, video: input, videoSec: checked.spec?.durationSec ?? null, signal: p.signal }) : null;
      if (comparison?.issue) issues.push(comparison.issue);
      let referenceSheet: string | null = null;
      if (reference && comparison) {
        const sheetDirectory = join(root, 'preview', `reference-${randomUUID()}`);
        await fs.mkdir(sheetDirectory, { recursive: true }); timelineContained(root, await fs.realpath(sheetDirectory));
        referenceSheet = await writeReferenceComparisonSheet({ reference, video: input, moments: comparison.moments, directory: sheetDirectory, signal: p.signal });
      }
      const compared = reference ? { reference_comparison: comparison?.report ?? null, reference_sheet: referenceSheet } : {};
      // Kept clip sound is looked for in the file the version keeps; a miss is advice.
      const keptSound = async (file: string) => { if (keptClipAudio.length) issues.push(...await originalClipAudioWarnings({ video: file, clips: keptClipAudio, signal: p.signal })); };
      const finalBlock = async () => {
        p.signal?.throwIfAborted();
        if (stillReviewed) return !await stillReviewed() ? REVIEW_EXPIRED : null;
        if (project && renderedSignature !== await sourceHash(root, project, p.signal).catch(error => {
          if (p.signal?.aborted) throw error;
          return null;
        })) return { ok: false, issues: [TIMELINE_CHANGED] };
        if (!await inputIsCurrent()) return { ok: false, issues: [TIMELINE_CHANGED] };
        return null;
      };
      const renderSignatures = p.video_id && renderedSignature
        ? { delivered_signatures: { ...stored.delivered_signatures, [p.video_id]: renderedSignature } } : {};
      const framesDirectory = join(root, 'preview', randomUUID());
      const dropFrames = () => fs.rm(framesDirectory, { recursive: true, force: true });
      const latest = stored.versions.filter(v => v.video_id === p.video_id).at(-1);
      const product = await readTimelineJson(join(root, 'product.json'), null) as { facts?: Array<{ id: string; text: string }> } | null;
      const products = (id: string) => p.video_id ? { ...stored.delivered_products, [p.video_id]: { version: id, facts: product?.facts ?? [] } } : stored.delivered_products;
      const frameRecord = (id: string, frames: Array<{ time_seconds: number; path: string }>) => ({ ...stored.delivered_frames, [p.video_id!]: { version: id, scenes: Object.fromEntries(sceneSamples.flatMap(scene => {
        const frame = frames.filter(frame => frame.time_seconds >= scene.start && frame.time_seconds < scene.end).sort((a, b) => Math.abs(a.time_seconds - (scene.end - .05)) - Math.abs(b.time_seconds - (scene.end - .05)))[0];
        return frame ? [[scene.id, relative(root, frame.path).replaceAll('\\', '/')]] : [];
      })) } });
      if (latest?.sha256 === sha) {
        const kept = timelineContained(root, await fs.realpath(resolve(root, latest.path)).catch(() => { throw new Error('The delivered version is missing or changed.'); }));
        if (await timelineDigest(kept) !== sha) throw new Error('The delivered version is missing or changed.');
        await keptSound(kept);
        if (stillReviewed && !await stillReviewed()) return REVIEW_EXPIRED;
        const evidence = await deliveredFrames(root, kept, checked.spec?.durationSec ?? 0, sceneEnds, p.signal, heard, framesDirectory);
        try {
          const blocked = await finalBlock();
          if (blocked) { await dropFrames(); return blocked; }
        } catch (error) { await dropFrames(); throw error; }
        if (p.video_id) await writeTimelineJson(join(root, 'versions.json'), { ...stored, ...heldRecord, ...renderSignatures, delivered_products: products(latest.id), delivered_frames: frameRecord(latest.id, evidence.frames) });
        // versions.json keeps the review on the version; the reply shows it once.
        const { visual_review: _storedReview, ...shown } = latest;
        return { ok: true, version: shown, issues, ...compared, ...evidence };
      }
      const id = `v${stored.versions.length + 1}`, directory = join(root, 'versions');
      await fs.mkdir(directory, { recursive: true }); timelineContained(root, await fs.realpath(directory));
      const output = join(directory, `${p.video_id ?? basename(input, '.mp4')}-${id}-${randomUUID().slice(0, 8)}.mp4`);
      await fs.copyFile(input, output, constants.COPYFILE_EXCL);
      try {
        if (await timelineDigest(output, p.signal) !== sha || await timelineDigest(input, p.signal) !== sha) {
          if (stillReviewed) { await fs.rm(output, { force: true }); return REVIEW_EXPIRED; }
          throw new Error('The video changed during delivery; inspect it and deliver again.');
        }
        if (stillReviewed && !await stillReviewed()) { await fs.rm(output, { force: true }); return REVIEW_EXPIRED; }
        await keptSound(output);
        if (stillReviewed && !await stillReviewed()) { await fs.rm(output, { force: true }); return REVIEW_EXPIRED; }
        const version: Version = { id, ...(p.video_id ? { video_id: p.video_id, product_facts: product?.facts ?? [] } : {}), path: relative(root, output).replaceAll('\\', '/'), sha256: sha, duration_sec: checked.spec?.durationSec ?? null, shipped_at: new Date().toISOString(), warnings: issues.filter(i => i.severity === 'warning').map(i => i.code), visual_review: { status: 'not_checked' }, integrated_lufs: checked.integrated_lufs, ...(issues.some(i => i.severity === 'error') ? { override: { codes: issues.filter(i => i.severity === 'error').map(i => i.code), reason: reason! } } : {}) };
        const words = { ...stored.delivered_narration };
        for (const line of voiced) words[line.sha] = [...(words[line.sha] ?? []).filter(text => spokenWords(text) !== spokenWords(line.text)), line.text].slice(-8);
        const evidence = await deliveredFrames(root, output, checked.spec?.durationSec ?? 0, sceneEnds, p.signal, heard, framesDirectory);
        const blocked = await finalBlock();
        if (blocked) { await fs.rm(output, { force: true }); await dropFrames(); return blocked; }
        await writeTimelineJson(join(root, 'versions.json'), { ...stored, versions: [...stored.versions, version], delivered_narration: words, ...(p.video_id ? { ...heldRecord, ...renderSignatures, delivered_products: products(version.id), delivered_frames: frameRecord(version.id, evidence.frames) } : {}) });
        const { visual_review: _storedReview, ...shown } = version;
        return { ok: true, version: shown, issues, ...compared, ...evidence };
      } catch (error) { await fs.rm(output, { force: true }); await dropFrames(); throw error; }
    };
    const unaccepted = issues.filter(i => i.severity === 'error' && !accepted.has(i.code));
    if (unaccepted.length) {
      const blocked = { ok: false, issues, checked };
      if (p.reviewHeldStills && project && held.finding && unaccepted.length === 1 && unaccepted[0].code === 'DELIVERY_HELD_STILLS' && !p.signal?.aborted) {
        // The user decides on the file that was checked: one replaced meanwhile is not offered.
        if (!await inputIsCurrent() || await timelineDigest(input, p.signal).catch(() => null) !== sha) return { kind: 'done' as const, result: REVIEW_EXPIRED };
        const rendered = project;
        /** Delivers the reviewed file once the user confirmed it, if nothing it was judged on changed. */
        const confirm = async (current: () => boolean) => {
          // The canvas still owns the update, and the render still shows the current timeline:
          // the Agent may edit it with its own file tools, which take no lock.
          const stillReviewed = async () => {
            if (p.signal?.aborted || !current()) return false;
            const record = await readTimelineJson(join(rendered, '.ovs-render.json'), null).catch(() => null) as Record<string, unknown> | null;
            return record?.output_sha256 === sha && record?.source_sha256 === await sourceHash(root, rendered, p.signal).catch(() => null)
              && !p.signal?.aborted && current();
          };
          if (!await stillReviewed()) return REVIEW_EXPIRED;
          stored = await readVersions(root);
          const latest = stored.versions.filter(v => v.video_id === p.video_id).at(-1);
          if (latest?.id !== checkedLatest?.id || latest?.sha256 !== checkedLatest?.sha256 || await timelineDigest(input).catch(() => null) !== sha) return REVIEW_EXPIRED;
          return deliver(CANVAS_REVIEW_REASON, stillReviewed);
        };
        return { kind: 'review' as const, finding: held.finding, blocked, confirm };
      }
      if (!p.reviewHeldStills && p.video_id && !stoppedSha && issues.some(i => i.code === 'DELIVERY_HELD_STILLS' && i.severity === 'error' && !accepted.has(i.code))) {
        // Unrecorded, the next file would be stopped again; failing to record never hides the finding.
        await writeTimelineJson(join(root, 'versions.json'), { ...stored, held_stills_stopped: { ...heldStopped, [p.video_id]: sha } }).catch(() => undefined);
      }
      return { kind: 'done' as const, result: blocked };
    }
    return { kind: 'done' as const, result: await deliver(p.accept_reason) };
  });
  if (first.kind === 'done') return first.result;
  // Waited for outside the lock, so other timeline work goes on while the user decides.
  const current = await p.reviewHeldStills!(first.finding);
  if (!current) return first.blocked;
  return withTimelineLock(p.production, () => first.confirm(current));
}
