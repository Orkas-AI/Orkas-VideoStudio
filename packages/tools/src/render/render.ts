import * as fs from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import {
  resolveFfmpegTools,
  resolveBinaries,
  buildHyperframesEnv,
  hyperframesNpxArgs,
  run,
  runOk,
} from '@orkas/video-studio-core';
import { loudness, normalizeLoudness, probeMedia } from '../edit/edit.js';
import { lintCompositionCraft, type CraftFinding } from './craft-lint.js';
import {
  buildDraftFrameSamplePlan,
  buildPreviewSamplePlan,
  findingsJson,
  initDraftRepairBudget,
  loadCompositionMeta,
  matchPreviewFrames,
  type PreviewSample,
  loadDesignContract,
  loadNarrationMap,
  loadSceneMap,
  loadShotlist,
  parseFindingsPayload,
  recordDraftFailure,
  recordDraftSuccess,
  runAudioTimingQa,
  runContractHtmlQa,
  runSourceAlignmentQa,
  summarizeDraftInspectDisposition,
  summarizeVideoFrameQa,
  writeFrameContactSheet,
  type CompositionMeta,
  type DraftRepairBudget,
  type FrameEvidence,
  type FrameSampleEvidence,
  type Issue,
} from './composition-qa.js';

const NPX_HINT = 'Compose/render runs `npx hyperframes`. Install Node.js (which provides npx).';

function npxOrThrow(): string {
  const { npx } = resolveBinaries();
  if (!npx) throw new Error(`npx not found. ${NPX_HINT}`);
  return npx;
}

/** Render time can be long (first run fetches HyperFrames + may download a browser). */
const RENDER_TIMEOUT_MS = 15 * 60 * 1000;
const QA_TIMEOUT_MS = 5 * 60 * 1000;
const LOUDNESS_TARGET_I = -14;
const LOUDNESS_TARGET_TP = -1;
const LOUDNESS_DRAFT_NORMALIZE_DELTA_LU = 4;
const AUDIO_DURATION_TOLERANCE_SEC = 0.5;

export type RenderQuality = 'draft' | 'high';

export interface RenderParams {
  /** Directory containing the composition (index.html). */
  project: string;
  output: string;
  quality?: RenderQuality;
  signal?: AbortSignal;
  onProgress?: (chunk: string) => void;
}

export interface RenderResult {
  output: string;
}

export interface SnapshotParams {
  project: string;
  output: string;
  signal?: AbortSignal;
}

export interface SnapshotResult {
  /** The opening frame. Kept for callers that predate multi-frame evidence. */
  path: string;
  bytes: number;
  first_frame: string;
  /** HyperFrames' grid view of every captured frame; '' when only one was taken. */
  contact_sheet: string;
  frames: Array<{ label: string; time_seconds: number; path: string }>;
}

export interface DraftParams extends RenderParams {
  reportPath?: string;
  findingsPath?: string;
  frameEvidenceDir?: string;
}

export type DraftResult =
  | {
      ok: true;
      op: 'composition.draft';
      path: string;
      bytes: number;
      report_path: string;
      findings_path: string;
      media: string;
      report: Record<string, unknown>;
    }
  | {
      ok: false;
      op: 'composition.draft';
      errorCode: string;
      message: string;
      report: Record<string, unknown>;
      repair_budget: Record<string, unknown>;
      [key: string]: unknown;
    };

/** Render a HyperFrames composition directory to a video file via `npx hyperframes render`. */
export async function render(params: RenderParams): Promise<RenderResult> {
  await assertLocalCompositionPreflight(resolve(params.project), 'composition.render');
  const npx = npxOrThrow();
  const env = buildHyperframesEnv(resolveFfmpegTools());
  const quality = params.quality ?? 'high';
  const args = hyperframesNpxArgs('render', [params.project, '-o', params.output, '-q', quality]);
  await runOk(npx, args, {
    env,
    signal: params.signal,
    timeoutMs: RENDER_TIMEOUT_MS,
    onStderr: params.onProgress,
  });
  return { output: resolve(params.output) };
}

/** Capture the first frame of a composition through HyperFrames' real runtime. */
export async function snapshot(params: SnapshotParams): Promise<SnapshotResult> {
  const project = resolve(params.project);
  const output = resolve(params.output);
  await assertLocalCompositionPreflight(project, 'composition.snapshot');
  const npx = npxOrThrow();
  const env = buildHyperframesEnv(resolveFfmpegTools());
  const snapshotsDir = join(project, 'snapshots');

  // Plan the semantic frames worth reviewing. If the composition metadata or
  // scene map can't be read we can still capture the opening frame, so a preview
  // degrades to the old single-frame behaviour instead of failing.
  const loaded = await loadCompositionMeta(project).catch(() => ({ meta: null }));
  const sceneMapLoad = await loadSceneMap(project).catch(() => null);
  const plan: PreviewSample[] = loaded.meta
    ? buildPreviewSamplePlan(loaded.meta, sceneMapLoad?.value ?? null)
    : [{ label: 'hook-frame', timeSec: 0 }];

  // hyperframes reuses `frame-<NN>-...` names, so a shorter run would otherwise
  // inherit stale frames from a longer one.
  await clearGeneratedSnapshots(snapshotsDir);
  await runOk(
    npx,
    hyperframesNpxArgs('snapshot', [project, '--at', plan.map((sample) => sample.timeSec.toFixed(1)).join(','), '--describe', 'false']),
    { env, signal: params.signal, timeoutMs: QA_TIMEOUT_MS },
  );

  const entries = await fs.readdir(snapshotsDir).catch(() => []);
  const matched = matchPreviewFrames(plan, entries);
  if (!matched.length) throw new Error(`HyperFrames snapshot produced no PNG in ${snapshotsDir}`);

  // Index 0 is the requested hook time; never trust mtime here, the payoff frame
  // is written last.
  await fs.mkdir(dirname(output), { recursive: true });
  await fs.copyFile(join(snapshotsDir, matched[0].file), output);
  const st = await fs.stat(output);
  const contactSheet = join(snapshotsDir, 'contact-sheet.jpg');
  const hasSheet = matched.length > 1 && Boolean(await fs.stat(contactSheet).catch(() => null));
  return {
    path: output,
    bytes: st.size,
    first_frame: output,
    contact_sheet: hasSheet ? contactSheet : '',
    frames: matched.map((entry) => ({
      label: entry.label,
      time_seconds: entry.time_seconds,
      path: join(snapshotsDir, entry.file),
    })),
  };
}

/** Remove only the files a previous snapshot run generated in its own directory. */
async function clearGeneratedSnapshots(snapshotsDirAbs: string): Promise<void> {
  const entries = await fs.readdir(snapshotsDirAbs).catch(() => []);
  await Promise.all(
    entries
      .filter((entry) => /^frame-\d+-at-[\d.]+s\.png$/i.test(entry) || entry === 'contact-sheet.jpg')
      .map((entry) => fs.rm(join(snapshotsDirAbs, entry), { force: true })),
  );
}

async function qa(op: 'lint' | 'inspect', project: string, signal?: AbortSignal): Promise<unknown> {
  const preflight = await localCompositionPreflight(project);
  if (preflight.errorCount > 0) return preflight.payload;
  const npx = npxOrThrow();
  const env = buildHyperframesEnv(resolveFfmpegTools());
  const r = await run(npx, hyperframesNpxArgs(op, [project, '--json']), { env, signal, timeoutMs: QA_TIMEOUT_MS });
  let result: unknown = { ok: r.code === 0, raw: r.stdout.trim() || r.stderr.trim() };
  const m = r.stdout.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (m) {
    try {
      result = JSON.parse(m[0]);
    } catch {
      /* keep the raw fallback */
    }
  }
  const withCraft = await attachCraftFindings(result, project);
  return mergePreflightQa(preflight, withCraft);
}

async function localCompositionPreflight(project: string): Promise<{ errorCount: number; warningCount: number; issues: Issue[]; payload: Record<string, unknown> }> {
  const loaded = await loadCompositionMeta(resolve(project));
  const issues = loaded.issues;
  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  const payload = JSON.parse(findingsJson(issues, {
    engine: 'ovs-native-preflight',
    profile: 'orkas-html-composition',
    canvas: loaded.meta ? { width: loaded.meta.width, height: loaded.meta.height, durationSec: loaded.meta.durationSec } : null,
  })) as Record<string, unknown>;
  return { errorCount, warningCount, issues, payload };
}

async function assertLocalCompositionPreflight(project: string, op: string): Promise<void> {
  const preflight = await localCompositionPreflight(project);
  if (preflight.errorCount === 0) return;
  const first = preflight.issues.find((issue) => issue.severity === 'error');
  throw new Error(`${op} blocked by local composition preflight: ${first?.code || 'COMPOSITION_INVALID'} ${first?.message || ''}`.trim());
}

function mergePreflightQa(preflight: Awaited<ReturnType<typeof localCompositionPreflight>>, result: unknown): unknown {
  if (!preflight.issues.length) return result;
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    const obj = result as Record<string, unknown>;
    const resultIssues = Array.isArray(obj.issues) ? obj.issues : [];
    return {
      ...obj,
      ok: obj.ok === false || preflight.errorCount > 0 ? false : (obj.ok ?? true),
      issues: [...preflight.issues, ...resultIssues],
      ovs_preflight: preflight.payload,
    };
  }
  return { qa: result, ovs_preflight: preflight.payload };
}

/** Append advisory craft-threshold findings (a pure static scan of index.html)
 *  to the QA result so they ride alongside the structural/visual QA. Best-effort:
 *  a read/parse failure must never fail the QA pass. Nothing is added when the
 *  composition trips none of the thresholds, so the result shape is unchanged. */
async function attachCraftFindings(result: unknown, project: string): Promise<unknown> {
  let craft: CraftFinding[] = [];
  try {
    const html = await fs.readFile(resolve(project, 'index.html'), 'utf8');
    craft = lintCompositionCraft(html);
  } catch {
    /* advisory only; ignore */
  }
  if (!craft.length) return result;
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    return { ...(result as Record<string, unknown>), craft };
  }
  return { qa: result, craft };
}

/** Structural QA of a composition (`npx hyperframes lint --json`). */
export function lint(project: string, signal?: AbortSignal): Promise<unknown> {
  return qa('lint', project, signal);
}

/** Visual/layout QA of a composition in headless Chrome (`npx hyperframes inspect --json`). */
export function inspect(project: string, signal?: AbortSignal): Promise<unknown> {
  return qa('inspect', project, signal);
}

function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

function qualityFps(quality: RenderQuality | undefined): number {
  return quality === 'draft' ? 15 : 30;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function issuesFromQa(value: unknown): Issue[] {
  if (!isRecord(value)) return [];
  const direct = Array.isArray(value.issues) ? value.issues : (Array.isArray(value.findings) ? value.findings : []);
  const issues: Issue[] = direct
    .filter(isRecord)
    .map((issue) => ({
      code: String(issue.code || 'QA_FINDING'),
      severity: issue.severity === 'error' || issue.severity === 'info' ? issue.severity : 'warning',
      selector: typeof issue.selector === 'string' ? issue.selector : undefined,
      message: String(issue.message || issue.text || issue.code || 'QA finding'),
      source: typeof issue.source === 'string' ? issue.source : 'hyperframes',
    }));
  const craft = Array.isArray(value.craft) ? value.craft : [];
  for (const finding of craft.filter(isRecord)) {
    issues.push({
      code: String(finding.code || 'CRAFT_FINDING'),
      severity: 'warning',
      selector: typeof finding.selector === 'string' ? finding.selector : undefined,
      message: String(finding.message || finding.code || 'Craft advisory'),
      source: 'ovs-craft-lint',
    });
  }
  return issues;
}

function qaHasBlockingFailure(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.ok === false) return true;
  const errorCount = Number(value.errorCount ?? value.error_count);
  if (Number.isFinite(errorCount) && errorCount > 0) return true;
  return issuesFromQa(value).some((issue) => issue.severity === 'error');
}

function inspectFindingsJson(value: unknown): string {
  return findingsJson(issuesFromQa(value), {
    engine: 'hyperframes',
    raw: value,
  });
}

async function writeReportIfRequested(reportPath: string | undefined, report: Record<string, unknown>): Promise<void> {
  if (!reportPath) return;
  const abs = resolve(reportPath);
  await fs.mkdir(dirname(abs), { recursive: true });
  report.report_path = abs;
  await fs.writeFile(abs, JSON.stringify(report, null, 2), 'utf8');
}

async function failDraft(
  report: Record<string, unknown>,
  params: DraftParams,
  code: string,
  message: string,
  extra: Record<string, unknown>,
  repairBudget: DraftRepairBudget,
): Promise<DraftResult> {
  report.error = {
    code,
    message,
    ...(extra.repair_target ? { repair_target: extra.repair_target } : {}),
  };
  const reportPath = params.reportPath ? resolve(params.reportPath) : undefined;
  const budgetSummary = await recordDraftFailure(repairBudget, reportPath, code, message, extra);
  const steps = report.steps as Record<string, unknown>;
  steps.repair_budget = budgetSummary;
  report.repair_budget = budgetSummary;
  await writeReportIfRequested(reportPath, report);
  return {
    ok: false,
    op: 'composition.draft',
    errorCode: code,
    message,
    report,
    repair_budget: budgetSummary,
    ...extra,
  };
}

async function buildMediaQa(meta: CompositionMeta, probe: Awaited<ReturnType<typeof probeMedia>> | null): Promise<Record<string, unknown>> {
  const issues: Issue[] = [];
  const sourceAudioTracks: Array<{
    path: string;
    start_seconds: number;
    volume: number;
    declared_duration_seconds?: number;
    source_duration_seconds?: number;
    expected_duration_seconds?: number;
    expected_end_seconds?: number;
  }> = [];
  if (!probe) {
    issues.push({
      code: 'MEDIA_PROBE_FAILED',
      severity: 'error',
      message: 'Could not probe the rendered draft media.',
      source: 'ovs-media-qa',
    });
  } else {
    if (!(probe.duration > 0)) {
      issues.push({
        code: 'MEDIA_DURATION_MISSING',
        severity: 'error',
        message: 'Rendered draft has no positive duration.',
        source: 'ovs-media-qa',
      });
    }
    if (Math.abs(probe.duration - meta.durationSec) > 0.75) {
      issues.push({
        code: 'MEDIA_DURATION_MISMATCH',
        severity: 'error',
        message: `Rendered draft duration ${round2(probe.duration)}s does not match composition duration ${round2(meta.durationSec)}s.`,
        source: 'ovs-media-qa',
      });
    }
    if (!probe.width || !probe.height) {
      issues.push({
        code: 'VIDEO_STREAM_MISSING',
        severity: 'error',
        message: 'Rendered draft has no usable video stream.',
        source: 'ovs-media-qa',
      });
    }
    if (probe.width && Math.abs(probe.width - meta.width) > 2) {
      issues.push({
        code: 'VIDEO_WIDTH_MISMATCH',
        severity: 'error',
        message: `Rendered draft width ${probe.width}px does not match composition width ${meta.width}px.`,
        source: 'ovs-media-qa',
      });
    }
    if (probe.height && Math.abs(probe.height - meta.height) > 2) {
      issues.push({
        code: 'VIDEO_HEIGHT_MISMATCH',
        severity: 'error',
        message: `Rendered draft height ${probe.height}px does not match composition height ${meta.height}px.`,
        source: 'ovs-media-qa',
      });
    }
    if (meta.audioTracks.length > 0 && !probe.has_audio) {
      issues.push({
        code: 'AUDIO_STREAM_MISSING',
        severity: 'error',
        message: 'Composition declares audio tracks, but the rendered draft has no audio stream.',
        source: 'ovs-media-qa',
      });
    }
  }
  let expectedAudioEndSec = 0;
  for (const track of meta.audioTracks) {
    const sourceProbe = await probeMedia(track.absPath).catch(() => null);
    const sourceDurationSec = sourceProbe?.audio_duration ?? sourceProbe?.duration;
    const expectedCandidates = [
      track.declaredDurationSec,
      sourceDurationSec,
    ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
    const expectedDurationSec = expectedCandidates.length ? Math.min(...expectedCandidates) : undefined;
    const expectedEndSec = expectedDurationSec !== undefined
      ? Math.min(meta.durationSec, track.startSec + expectedDurationSec)
      : undefined;
    if (expectedEndSec !== undefined) expectedAudioEndSec = Math.max(expectedAudioEndSec, expectedEndSec);
    sourceAudioTracks.push({
      path: track.absPath,
      start_seconds: round2(track.startSec),
      volume: round2(track.volume),
      ...(track.declaredDurationSec !== undefined ? { declared_duration_seconds: round2(track.declaredDurationSec) } : {}),
      ...(sourceDurationSec !== undefined ? { source_duration_seconds: round2(sourceDurationSec) } : {}),
      ...(expectedDurationSec !== undefined ? { expected_duration_seconds: round2(expectedDurationSec) } : {}),
      ...(expectedEndSec !== undefined ? { expected_end_seconds: round2(expectedEndSec) } : {}),
    });
  }
  const renderedAudioDurationSec = probe?.audio_duration ?? probe?.duration ?? 0;
  if (meta.audioTracks.length > 0 && probe?.has_audio && expectedAudioEndSec > 0 && renderedAudioDurationSec + AUDIO_DURATION_TOLERANCE_SEC < expectedAudioEndSec) {
    issues.push({
      code: 'AUDIO_STREAM_TOO_SHORT',
      severity: 'error',
      message: `Rendered draft audio duration ${round2(renderedAudioDurationSec)}s is shorter than expected narration coverage ${round2(expectedAudioEndSec)}s.`,
      source: 'ovs-media-qa',
    });
  }
  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  return {
    ok: errorCount === 0,
    issue_count: issues.length,
    error_count: errorCount,
    warning_count: issues.filter((issue) => issue.severity === 'warning').length,
    media_duration_seconds: probe ? round2(probe.duration) : null,
    video: probe ? { width: probe.width, height: probe.height, fps: probe.fps, codec: probe.v_codec } : null,
    audio: probe?.has_audio ? { codec: probe.a_codec, duration_seconds: probe.audio_duration ? round2(probe.audio_duration) : null } : null,
    expected_audio_end_seconds: expectedAudioEndSec > 0 ? round2(expectedAudioEndSec) : null,
    source_audio_tracks: sourceAudioTracks,
    issues,
  };
}

function shouldNormalizeDraftLoudness(report: Awaited<ReturnType<typeof loudness>> | null, quality: RenderQuality | undefined): { normalize: boolean; reason: string } {
  if (!report) return { normalize: false, reason: 'loudness analysis unavailable' };
  if (quality === 'high') return { normalize: true, reason: 'high quality export' };
  if (Number.isFinite(report.input_i) && Math.abs(report.input_i - LOUDNESS_TARGET_I) >= LOUDNESS_DRAFT_NORMALIZE_DELTA_LU) {
    return { normalize: true, reason: `integrated loudness ${round2(report.input_i)} LUFS is far from target ${LOUDNESS_TARGET_I} LUFS` };
  }
  if (Number.isFinite(report.input_tp) && report.input_tp > LOUDNESS_TARGET_TP + 0.5) {
    return { normalize: true, reason: `true peak ${round2(report.input_tp)} dBTP exceeds target ${LOUDNESS_TARGET_TP} dBTP` };
  }
  return { normalize: false, reason: 'within draft loudness tolerance' };
}

async function normalizeDraftAudioIfNeeded(output: string, quality: RenderQuality | undefined, probe: Awaited<ReturnType<typeof probeMedia>> | null): Promise<Record<string, unknown>> {
  if (!probe?.has_audio) return { skipped: true, reason: 'no audio stream' };
  let before: Awaited<ReturnType<typeof loudness>> | null = null;
  try {
    before = await loudness(output);
  } catch (err) {
    return { skipped: true, reason: 'loudness analysis failed', error: (err as Error).message };
  }
  const decision = shouldNormalizeDraftLoudness(before, quality);
  if (!decision.normalize) return { skipped: true, reason: decision.reason, loudness_before: before, decision };
  const tmp = join(dirname(output), `.${Date.now()}-${Math.random().toString(16).slice(2)}.normalized.mp4`);
  try {
    const normalized = await normalizeLoudness(output, tmp);
    await fs.rename(tmp, output);
    const after = await loudness(output).catch(() => normalized.loudness);
    return {
      skipped: false,
      reason: decision.reason,
      loudness_before: before,
      loudness_after: after,
      decision,
    };
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    return {
      skipped: true,
      reason: 'normalization failed',
      error: (err as Error).message,
      loudness_before: before,
      decision,
    };
  }
}

function parseFrameMd5(output: string): string {
  const line = output.split('\n').find((item) => item.trim() && !item.startsWith('#'));
  const hash = line?.split(',').pop()?.trim();
  return hash || '';
}

function parseSignalStats(output: string): { brightness: number; contrast: number } {
  const lookup = (key: string): number | null => {
    const m = new RegExp(`${key}=(-?\\d+(?:\\.\\d+)?)`).exec(output);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  };
  const avg = lookup('lavfi\\.signalstats\\.YAVG') ?? 128;
  const min = lookup('lavfi\\.signalstats\\.YMIN') ?? 0;
  const max = lookup('lavfi\\.signalstats\\.YMAX') ?? 255;
  return { brightness: round2(avg), contrast: round2(Math.max(0, max - min)) };
}

async function sampleRenderedFrames(
  mediaPath: string,
  meta: CompositionMeta,
  sceneMap: unknown,
  evidenceDir: string,
  quality: RenderQuality | undefined,
  signal?: AbortSignal,
): Promise<FrameEvidence> {
  const { ffmpeg } = resolveFfmpegTools();
  await fs.mkdir(evidenceDir, { recursive: true });
  const samples: FrameSampleEvidence[] = [];
  for (const sample of buildDraftFrameSamplePlan(meta, sceneMap, qualityFps(quality))) {
    const framePath = join(evidenceDir, `${sample.label}.png`);
    const at = String(sample.timeSec);
    await runOk(ffmpeg, ['-y', '-ss', at, '-i', mediaPath, '-frames:v', '1', '-update', '1', framePath], { signal, timeoutMs: QA_TIMEOUT_MS });
    const md5 = await runOk(ffmpeg, ['-hide_banner', '-nostats', '-ss', at, '-i', mediaPath, '-frames:v', '1', '-f', 'framemd5', '-'], { signal, timeoutMs: QA_TIMEOUT_MS });
    const stats = await run(ffmpeg, ['-hide_banner', '-nostats', '-ss', at, '-i', mediaPath, '-frames:v', '1', '-vf', 'signalstats,metadata=print', '-f', 'null', '-'], { signal, timeoutMs: QA_TIMEOUT_MS });
    const signalStats = parseSignalStats(`${stats.stdout}\n${stats.stderr}`);
    samples.push({
      label: sample.label,
      time_seconds: sample.timeSec,
      frame_index: sample.frameIndex,
      path: framePath,
      hash: parseFrameMd5(md5.stdout),
      brightness: signalStats.brightness,
      contrast: signalStats.contrast,
      width: meta.width,
      height: meta.height,
    });
  }
  const contactSheet = await writeFrameContactSheet(evidenceDir, samples);
  return {
    evidence_dir: evidenceDir,
    contact_sheet: contactSheet,
    frame_paths: samples.map((sample) => sample.path),
    samples,
  };
}

/** Orkas VideoStudio-style draft gate, using HyperFrames as the render backend. */
export async function draft(params: DraftParams): Promise<DraftResult> {
  const project = resolve(params.project);
  const output = resolve(params.output);
  const reportPath = params.reportPath ? resolve(params.reportPath) : undefined;
  const findingsPath = params.findingsPath ? resolve(params.findingsPath) : undefined;
  const report: Record<string, unknown> = {
    ok: false,
    op: 'composition.draft',
    engine: 'ovs-hyperframes-bridge',
    composition_dir: project,
    path: output,
    steps: {},
  };
  const steps = report.steps as Record<string, unknown>;
  const repairBudget = await initDraftRepairBudget(project);
  steps.repair_budget = repairBudget.summary;
  report.repair_budget = repairBudget.summary;
  if (repairBudget.blocked) {
    report.error = {
      code: 'E_REPAIR_BUDGET_EXCEEDED',
      message: 'Draft repair budget exceeded: the initial draft plus 2 repair pass(es) still failed. Stop and report the blocker instead of continuing to patch.',
    };
    await writeReportIfRequested(reportPath, report);
    return {
      ok: false,
      op: 'composition.draft',
      errorCode: 'E_REPAIR_BUDGET_EXCEEDED',
      message: String((report.error as Record<string, unknown>).message),
      report,
      repair_budget: repairBudget.summary,
      last_error: repairBudget.summary.last_error,
    };
  }

  const loaded = await loadCompositionMeta(project);
  const lintFindings = findingsJson(loaded.issues, {
    engine: 'ovs-native-preflight',
    profile: 'orkas-html-composition',
    canvas: loaded.meta ? { width: loaded.meta.width, height: loaded.meta.height, durationSec: loaded.meta.durationSec } : null,
  });
  steps.lint = { ok: true, op: 'composition.lint', findings: lintFindings };
  const parsedLint = parseFindingsPayload(lintFindings);
  if (parsedLint.errorCount > 0) {
    return failDraft(report, params, 'E_LINT_BLOCKED', 'composition lint failed.', {
      repair_target: parsedLint.issues[0]?.selector || 'index.html',
      lint_summary: {
        error_count: parsedLint.errorCount,
        warning_count: parsedLint.warningCount,
        issues: parsedLint.issues.slice(0, 12),
      },
    }, repairBudget);
  }

  if (!loaded.meta) {
    return failDraft(report, params, 'E_COMPOSITION_INVALID', 'composition metadata could not be loaded.', {}, repairBudget);
  }

  const contractLoad = await loadDesignContract(project);
  const sceneMapLoad = await loadSceneMap(project);
  const narrationMapLoad = await loadNarrationMap(project);
  const shotlistLoad = await loadShotlist(project);
  steps.authoring = {
    ok: true,
    mode: 'model_authored_html',
    path: loaded.meta.htmlPath,
    design_contract_path: contractLoad.path,
    scene_map_path: sceneMapLoad.exists ? sceneMapLoad.path : '',
    shotlist_path: shotlistLoad.exists ? shotlistLoad.path : '',
  };

  const contractHtml = await runContractHtmlQa(loaded.meta, loaded.issues, contractLoad, sceneMapLoad, project);
  steps.contract_html = contractHtml;
  if (contractHtml.ok === false) {
    const firstError = ((contractHtml.issues as Issue[] | undefined) || []).find((issue) => issue.severity === 'error');
    return failDraft(report, params, 'E_CONTRACT_HTML_BLOCKED', 'design-contract/scene-map/index.html consistency failed draft QA.', {
      repair_target: firstError?.selector || 'index.html',
      contract_html: contractHtml,
    }, repairBudget);
  }

  const sourceAlignment = await runSourceAlignmentQa(sceneMapLoad, shotlistLoad);
  steps.source_alignment = sourceAlignment;
  if (sourceAlignment.ok === false) {
    return failDraft(report, params, 'E_SOURCE_ALIGNMENT_BLOCKED', 'script/shotlist/scene-map alignment failed draft QA.', {
      repair_target: 'scene-map.json',
      source_alignment: sourceAlignment,
    }, repairBudget);
  }

  const audioTiming = await runAudioTimingQa(loaded.meta, contractLoad, sceneMapLoad, narrationMapLoad, project);
  steps.audio_timing = audioTiming;
  if (audioTiming.ok === false) {
    const firstError = ((audioTiming.issues as Issue[] | undefined) || []).find((issue) => issue.severity === 'error');
    return failDraft(report, params, 'E_AUDIO_TIMING_BLOCKED', 'audio timing or narration mapping failed draft QA.', {
      repair_target: firstError?.selector || 'scene-map.json',
      audio_timing: audioTiming,
    }, repairBudget);
  }

  let hyperframesLint: unknown;
  try {
    hyperframesLint = await lint(project, params.signal);
  } catch (err) {
    return failDraft(report, params, 'E_LINT_BLOCKED', 'HyperFrames lint failed.', {
      lint_error: (err as Error).message,
    }, repairBudget);
  }
  steps.hyperframes_lint = hyperframesLint;
  if (qaHasBlockingFailure(hyperframesLint)) {
    return failDraft(report, params, 'E_LINT_BLOCKED', 'HyperFrames lint reported blocking errors.', {
      lint_summary: hyperframesLint,
    }, repairBudget);
  }

  let inspectResult: unknown;
  try {
    inspectResult = await inspect(project, params.signal);
  } catch (err) {
    return failDraft(report, params, 'E_INSPECT_BLOCKED', 'HyperFrames inspect failed.', {
      inspect_error: (err as Error).message,
    }, repairBudget);
  }
  const inspectFindings = inspectFindingsJson(inspectResult);
  const inspectDisposition = summarizeDraftInspectDisposition(inspectFindings);
  steps.inspect = {
    ok: !qaHasBlockingFailure(inspectResult),
    op: 'composition.inspect',
    findings: inspectFindings,
    raw: inspectResult,
    draft_disposition: inspectDisposition,
  };
  if (findingsPath) await fs.writeFile(findingsPath, inspectFindings, 'utf8').catch(async () => {
    await fs.mkdir(dirname(findingsPath), { recursive: true });
    await fs.writeFile(findingsPath, inspectFindings, 'utf8');
  });
  if (Number(inspectDisposition.blocking_error_count || 0) > 0) {
    return failDraft(report, params, 'E_INSPECT_BLOCKED', 'inspect found non-visual blockers; repair design-contract/scene-map/HTML before rendering.', {
      inspect_summary: parseFindingsPayload(inspectFindings),
      draft_disposition: inspectDisposition,
    }, repairBudget);
  }

  let renderResult: RenderResult;
  try {
    renderResult = await render({
      project,
      output,
      quality: params.quality ?? 'draft',
      signal: params.signal,
      onProgress: params.onProgress,
    });
  } catch (err) {
    return failDraft(report, params, 'E_RENDER_FAILED', 'HyperFrames render failed.', {
      render_error: (err as Error).message,
    }, repairBudget);
  }
  steps.render = renderResult;

  let outputStat = await fs.stat(output).catch(() => null);
  let mediaProbe = outputStat?.isFile() ? await probeMedia(output).catch(() => null) : null;
  steps.media_probe = mediaProbe;
  const audioNormalize = await normalizeDraftAudioIfNeeded(output, params.quality ?? 'draft', mediaProbe);
  steps.audio_normalize = audioNormalize;
  if (isRecord(audioNormalize) && 'loudness_before' in audioNormalize) steps.loudness_before = audioNormalize.loudness_before;
  if (audioNormalize.skipped === false) {
    outputStat = await fs.stat(output).catch(() => null);
    mediaProbe = outputStat?.isFile() ? await probeMedia(output).catch(() => null) : mediaProbe;
    steps.media_probe = mediaProbe;
    if (isRecord(audioNormalize) && 'loudness_after' in audioNormalize) steps.loudness_after = audioNormalize.loudness_after;
  }
  const mediaQa = await buildMediaQa(loaded.meta, mediaProbe);
  steps.media_qa = mediaQa;
  if (mediaQa.ok === false) {
    return failDraft(report, params, 'E_MEDIA_QA_BLOCKED', 'draft media QA failed.', {
      media_qa: mediaQa,
    }, repairBudget);
  }

  const evidenceDir = resolve(params.frameEvidenceDir || join(dirname(output), 'draft-evidence'));
  let frameEvidence: FrameEvidence | null = null;
  try {
    frameEvidence = await sampleRenderedFrames(output, loaded.meta, sceneMapLoad.value, evidenceDir, params.quality, params.signal);
  } catch (err) {
    steps.frame_evidence_error = (err as Error).message;
  }
  const videoQa = summarizeVideoFrameQa(frameEvidence, loaded.meta.durationSec);
  steps.video_qa = videoQa;
  if (videoQa.ok === false) {
    return failDraft(report, params, 'E_VIDEO_QA_BLOCKED', 'video-level QA failed; repair design-contract/scene-map/HTML before Gate D.', {
      video_qa: videoQa,
    }, repairBudget);
  }

  const successBudget = await recordDraftSuccess(repairBudget, reportPath, output);
  steps.repair_budget = successBudget;
  report.repair_budget = successBudget;
  report.ok = true;
  report.media = { path: output, bytes: outputStat?.size ?? 0 };
  report.video_qa = videoQa;
  report.next_action = 'open_gate_d';
  report.advisory_policy = 'visual inspect warnings are advisory after ok:true; open Gate D instead of self-repairing.';
  await writeReportIfRequested(reportPath, report);
  return {
    ok: true,
    op: 'composition.draft',
    path: output,
    bytes: outputStat?.size ?? 0,
    report_path: reportPath || '',
    findings_path: findingsPath || '',
    media: `chat-media://local/${output}`,
    report,
  };
}
