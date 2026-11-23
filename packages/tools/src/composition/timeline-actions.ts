import { deliveredFrames, deliveredHints, type DeliveredSceneSpan } from './timeline-evidence.js';
import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { deriveVideoTimeline, parseVideoManifest, silentSceneIssues, spokenWords, timelineAudioTracks, VideoAssetLedgerSchema, type VideoEdl, type VideoManifestV3 } from '@orkas/video-studio-core';
import { screenStepIssues } from './screens.js';
import { render, check, snapshot, qaHasBlockingFailure } from '../render/render.js';
import { verifyTimelineDelivery } from '../render/delivery.js';
import { compareWithReference, writeReferenceComparisonSheet } from '../render/reference-compare.js';
import { prepareTimeline, readTimelineJson, timelineContained, timelineDigest, withTimelineLock, writeTimelineJson } from './timeline.js';

type Scope = { production: string; video_id?: string; signal?: AbortSignal };
const videoFolder = (root: string, id: string) => {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) throw new Error('Invalid video id.');
  return join(root, 'videos', id);
};
async function inputHash(root: string, project: string) {
  const hashes: string[] = [];
  hashes.push(await timelineDigest(join(project, 'manifest.json')));
  for (const file of ['product.json', 'assets.json']) hashes.push(await timelineDigest(join(root, file)).catch((e: NodeJS.ErrnoException) => { if (e.code === 'ENOENT') return ''; throw e; }));
  // Include actual referenced bytes: replacing an audio or image in place invalidates a render.
  const ledger = VideoAssetLedgerSchema.parse(await readTimelineJson(join(root, 'assets.json'), { assets: [] }));
  if (ledger.assets.length > 1000 || new Set(ledger.assets.map(a => a.id)).size !== ledger.assets.length) throw new Error('Asset ids must be unique, with at most 1000 records.');
  const parsed = parseVideoManifest(await readTimelineJson(join(project, 'manifest.json')));
  if (!parsed.manifest) throw new Error('Invalid timeline manifest.');
  const used = new Set(parsed.manifest.scenes.flatMap(s => [...(s.clips ?? []).map(c => c.asset), ...(s.narration?.asset ? [s.narration.asset] : [])]).concat((parsed.manifest.tracks ?? []).map(t => t.asset)));
  for (const row of ledger.assets.filter(a => used.has(a.id))) hashes.push(await timelineDigest(timelineContained(root, await fs.realpath(resolve(root, row.path)))));
  return createHash('sha256').update(JSON.stringify(hashes)).digest('hex');
}
async function sourceHash(root: string, project: string) {
  return createHash('sha256').update(JSON.stringify([
    await inputHash(root, project), await timelineDigest(join(project, 'index.html')),
    await timelineDigest(join(project, 'composition-manifest.json')),
  ])).digest('hex');
}
export async function timelineStatus(p: Scope) {
  const root = await fs.realpath(resolve(p.production));
  const project = timelineContained(root, await fs.realpath(videoFolder(root, p.video_id ?? 'main')));
  const parsed = parseVideoManifest(await readTimelineJson(join(project, 'manifest.json')));
  if (!parsed.manifest) return { ok: false, issues: parsed.issues };
  const timeline = deriveVideoTimeline(parsed.manifest);
  const rendered = await readTimelineJson(join(project, '.ovs-render.json'), null) as Record<string, unknown> | null;
  return { ok: true, project, timeline, rendered, stale: !rendered || rendered.source_sha256 !== await sourceHash(root, project) };
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
  return snapshot({ project: prepared.project, output: p.output, sceneIds: p.scene_ids, signal: p.signal });
}
export async function renderTimeline(p: Scope & { output: string; quality?: 'draft' | 'high'; onProgress?: (text: string) => void; requireSound?: boolean }) {
  const initialRoot = await fs.realpath(resolve(p.production));
  const initialProject = timelineContained(initialRoot, await fs.realpath(videoFolder(initialRoot, p.video_id ?? 'main')));
  const inputs = await inputHash(initialRoot, initialProject);
  const prepared = await prepareTimeline(p);
  if (!prepared.ok) return prepared;
  const silent = soundIssues(await preparedManifest(prepared.project), p.requireSound);
  if (silent.length) return { ...prepared, ok: false, issues: [...prepared.issues, ...silent] };
  return withTimelineLock(p.production, async root => {
    if (inputs !== await inputHash(root, prepared.project)) throw new Error('The project changed during preparation; prepare and render it again.');
    const state = await readTimelineJson(join(prepared.project, '.ovs-timeline.json')) as { html_sha256?: string };
    if (state.html_sha256 !== await timelineDigest(join(prepared.project, 'index.html'))) throw new Error('The page changed after preparation; prepare and render it again.');
    const signature = await sourceHash(root, prepared.project);
    // Render to a temporary path so an interrupted renderer cannot erase a previous result.
    const out = resolve(p.output), temporary = `${out}.${randomUUID()}.mp4`;
    await fs.mkdir(resolve(out, '..'), { recursive: true });
    try {
      await render({ project: prepared.project, output: temporary, quality: p.quality, signal: p.signal, onProgress: p.onProgress });
      if (signature !== await sourceHash(root, prepared.project)) throw new Error('The timeline changed during rendering; render it again.');
      await fs.rename(temporary, out);
      const record = { source_sha256: signature, output_sha256: await timelineDigest(out), output: out, rendered_at: new Date().toISOString(), visual_review: { status: 'not_checked' } };
      await writeTimelineJson(join(prepared.project, '.ovs-render.json'), record);
      return { ok: true, ...record };
    } finally { await fs.rm(temporary, { force: true }); }
  });
}

type Version = { id: string; video_id?: string; path: string; sha256: string; duration_sec: number | null; shipped_at: string; warnings: string[]; visual_review: { status: 'not_checked' }; product_facts?: Array<{ id: string; text: string }>; integrated_lufs?: number | null; override?: { codes: string[]; reason: string } };
/** `captions` is deprecated and ignored: burned captions cannot be read from the container. */
export async function shipTimeline(p: Scope & { input: string; accept_findings?: string[]; accept_reason?: string; cut_to_beat?: boolean; reference?: string; expect?: { durationSec?: number; aspect?: string; audio?: boolean; captions?: boolean } }) {
  return withTimelineLock(p.production, async root => {
    const input = await fs.realpath(resolve(p.input));
    const reference = p.reference ? await fs.realpath(resolve(p.reference)) : undefined;
    if (p.accept_findings?.length && (!p.accept_reason?.trim() || p.accept_findings.length > 32)) throw new Error('Accepting named delivery findings requires the actual user decision and its reason.');
    const accepted = new Set(p.accept_findings ?? []);
    const sceneEnds: number[] = [];
    const sceneSamples: Array<{ id: string; start: number; end: number }> = [];
    const sceneSpans: DeliveredSceneSpan[] = [];
    const stored = await readTimelineJson(join(root, 'versions.json'), { versions: [], delivered_narration: {} }) as { versions: Version[]; delivered_narration?: Record<string, string[]>; delivered_products?: Record<string, { version: string; facts: Array<{ id: string; text: string }> }>; delivered_frames?: Record<string, { version: string; scenes: Record<string, string> }>; held_stills_stopped?: Record<string, string> };
    if (!Array.isArray(stored?.versions) || stored.versions.length > 10_000) throw new Error('Repair versions.json before delivering; the existing history was left intact.');
    const issues: Array<{ code: string; severity: 'error' | 'warning'; message: string }> = [];
    const voiced: Array<{ sha: string; text: string }> = [];
    let plan: VideoEdl = { aspect: p.expect?.aspect ?? '', total_target_sec: p.expect?.durationSec ?? 0, language: '', segments: [], tracks: {}, delivery_promise: { type: 'compose_led', source_required: false, motion_min_ratio: 0 } };
    let expectation = p.expect;
    if (p.video_id) {
      const project = timelineContained(root, await fs.realpath(videoFolder(root, p.video_id)));
      const parsed = parseVideoManifest(await readTimelineJson(join(project, 'manifest.json')));
      if (!parsed.manifest) return { ok: false, issues: parsed.issues };
      const manifest = parsed.manifest, timeline = deriveVideoTimeline(manifest);
      sceneEnds.push(...timeline.scenes.map(s => s.startSec + s.durationSec));
      sceneSamples.push(...timeline.scenes.map(s => ({ id: s.id, start: s.startSec, end: s.startSec + s.durationSec })));
      const ledger = VideoAssetLedgerSchema.parse(await readTimelineJson(join(root, 'assets.json'), { assets: [] }));
      const assets = new Map(ledger.assets.map(row => [row.id, row]));
      sceneSpans.push(...timeline.scenes.map(s => {
        const kinds = (manifest.scenes[s.index].clips ?? []).map(clip => assets.get(clip.asset)?.kind);
        return { id: s.id, startSec: s.startSec, endSec: s.startSec + s.durationSec, footage: kinds.includes('video'), pictures: kinds.includes('image') };
      }));
      const record = await readTimelineJson(join(project, '.ovs-render.json'), null) as Record<string, unknown> | null;
      if (!record || record.output_sha256 !== await timelineDigest(input) || record.source_sha256 !== await sourceHash(root, project)) issues.push({ code: 'DELIVERY_TIMELINE_CHANGED', severity: 'error', message: 'Render the current timeline before delivering this file.' });
      expectation = { ...p.expect, durationSec: timeline.durationSec, aspect: `${manifest.canvas.width}:${manifest.canvas.height}`, audio: timelineAudioTracks({ manifest, timeline, resolve: id => id }).some(t => t.volume > 0) };
      const narration = [];
      for (const scene of timeline.scenes) {
        const declared = manifest.scenes[scene.index].narration;
        if (!declared?.asset) continue;
        const asset = assets.get(declared.asset);
        if (!asset) throw new Error('A narration asset is missing.');
        const file = timelineContained(root, await fs.realpath(resolve(root, asset.path)));
        const sha = await timelineDigest(file);
        const earlier = stored.delivered_narration?.[sha];
        if (asset.origin === 'generated' && earlier?.length && !earlier.some(text => spokenWords(text) === spokenWords(declared.text))) issues.push({ code: 'DELIVERY_NARRATION_NOT_REVOICED', severity: 'error', message: `Narration for scene ${scene.id} has changed words but unchanged audio; update the recording before delivering.` });
        if (asset.origin === 'generated') voiced.push({ sha, text: declared.text });
        narration.push({ text: declared.text, produced_path: file, start_sec: scene.startSec, target_sec: scene.durationSec });
      }
      plan = { ...plan, aspect: expectation.aspect!, total_target_sec: timeline.durationSec, tracks: { narration: { segments: narration } } };
    }
    const { checked, heard } = await verifyTimelineDelivery(plan, join(root, 'plan.json'), input, p.signal, expectation);
    issues.push(...checked.issues);
    const sha = await timelineDigest(input);
    // Stopped for held stills, a video gets one round of changes: a later file of it, even one still
    // held, is delivered with the finding as a warning; the same file is stopped again.
    const heldStopped = stored.held_stills_stopped && typeof stored.held_stills_stopped === 'object' && !Array.isArray(stored.held_stills_stopped) ? stored.held_stills_stopped : {};
    const stoppedSha = p.video_id && typeof heldStopped[p.video_id] === 'string' && /^[0-9a-f]{64}$/.test(heldStopped[p.video_id]) ? heldStopped[p.video_id] : undefined;
    if (checked.spec?.durationSec) issues.push(...await deliveredHints(input, checked.spec.durationSec, p.cut_to_beat === true, p.signal, p.video_id ? { sceneSpans, stoppedBefore: !!stoppedSha && stoppedSha !== sha } : undefined));
    if (issues.some(i => i.severity === 'error' && !accepted.has(i.code))) {
      if (p.video_id && !stoppedSha && issues.some(i => i.code === 'DELIVERY_HELD_STILLS' && i.severity === 'error' && !accepted.has(i.code))) {
        // Unrecorded, the next file would be stopped again; failing to record never hides the finding.
        await writeTimelineJson(join(root, 'versions.json'), { ...stored, held_stills_stopped: { ...heldStopped, [p.video_id]: sha } }).catch(() => undefined);
      }
      return { ok: false, issues, checked };
    }
    // A delivery ends the round of changes a held-stills stop began.
    const { [p.video_id ?? '']: _ended, ...stillStopped } = heldStopped;
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
      const evidence = await deliveredFrames(root, kept, checked.spec?.durationSec ?? 0, sceneEnds, p.signal, heard);
      if (p.video_id) await writeTimelineJson(join(root, 'versions.json'), { ...stored, ...heldRecord, delivered_products: products(latest.id), delivered_frames: frameRecord(latest.id, evidence.frames) });
      // versions.json keeps the review on the version; the reply shows it once.
      const { visual_review: _storedReview, ...shown } = latest;
      return { ok: true, version: shown, issues, ...compared, ...evidence };
    }
    const id = `v${stored.versions.length + 1}`, directory = join(root, 'versions');
    await fs.mkdir(directory, { recursive: true }); timelineContained(root, await fs.realpath(directory));
    const output = join(directory, `${p.video_id ?? basename(input, '.mp4')}-${id}-${randomUUID().slice(0, 8)}.mp4`);
    await fs.copyFile(input, output, constants.COPYFILE_EXCL);
    try {
      if (await timelineDigest(output) !== sha || await timelineDigest(input) !== sha) throw new Error('The video changed during delivery; inspect it and deliver again.');
      const version: Version = { id, ...(p.video_id ? { video_id: p.video_id, product_facts: product?.facts ?? [] } : {}), path: relative(root, output).replaceAll('\\', '/'), sha256: sha, duration_sec: checked.spec?.durationSec ?? null, shipped_at: new Date().toISOString(), warnings: issues.filter(i => i.severity === 'warning').map(i => i.code), visual_review: { status: 'not_checked' }, integrated_lufs: checked.integrated_lufs, ...(issues.some(i => i.severity === 'error') ? { override: { codes: issues.filter(i => i.severity === 'error').map(i => i.code), reason: p.accept_reason! } } : {}) };
      const words = { ...stored.delivered_narration };
      for (const line of voiced) words[line.sha] = [...(words[line.sha] ?? []).filter(text => spokenWords(text) !== spokenWords(line.text)), line.text].slice(-8);
      const evidence = await deliveredFrames(root, output, checked.spec?.durationSec ?? 0, sceneEnds, p.signal, heard);
      await writeTimelineJson(join(root, 'versions.json'), { ...stored, versions: [...stored.versions, version], delivered_narration: words, ...(p.video_id ? { ...heldRecord, delivered_products: products(version.id), delivered_frames: frameRecord(version.id, evidence.frames) } : {}) });
      const { visual_review: _storedReview, ...shown } = version;
      return { ok: true, version: shown, issues, ...compared, ...evidence };
    } catch (error) { await fs.rm(output, { force: true }); throw error; }
  });
}
