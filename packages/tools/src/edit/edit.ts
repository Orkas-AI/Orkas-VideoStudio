import { writeFileSync, rmSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  resolveFfmpegTools,
  runOk,
  ensureParentDir,
  keepIntervalsFromRemovals,
  complementIntervals,
  fillerSpansFromWords,
  normalizeTranscriptWords,
  buildKeepFilterComplex,
  decisionEvidence,
  DEFAULT_FILLERS,
} from '@orkas/video-studio-core';
import type { Span, DecisionEvidence } from '@orkas/video-studio-core';
import { silence } from '../analyze/analyze.js';
import {
  runFfmpeg,
  mapWithConcurrencyLimit,
  type EditRunOptions,
  type FfmpegProgressSpec,
} from '../progress.js';
import {
  buildProbeArgs,
  buildTrimArgs,
  buildConcatArgs,
  buildConformArgs,
  buildBurnsubsArgs,
  buildOverlayArgs,
  buildExtractFrameArgs,
  buildLoudnessArgs,
  buildNormalizeLoudnessArgs,
  buildMixArgs,
  captionFontForText,
  chooseConcatTarget,
  concatDurationDriftError,
  finiteNum,
  overlayWouldEraseBase,
  pixFmtHasAlpha,
  type ConcatInputSpec,
  type TrimParams,
  type AudioSegment,
  type OnExistingAudio,
} from './args.js';

/** Trim results (requested window or produced file) shorter than this are unusable. */
const MIN_TRIM_OUTPUT_SEC = 0.1;
/** Cap concurrent ffprobe children when probing multiple inputs for progress. */
const PROBE_CONCURRENCY = 4;
/** Cap concurrent audio probes when assessing narration coverage. */
const COVERAGE_CONCURRENCY = 4;
/** Coverage thresholds for voiceover laid onto a video. */
const COVERAGE_TRAILING_GAP_SEC = 2;
const COVERAGE_OVERSHOOT_SEC = 0.3;
const COVERAGE_LEAD_GAP_SEC = 3;
/** An interior hole this long between narration lines reads as dead air on a
 *  voiceover with no music bed. The old ratio only measured how FAR the
 *  narration reached, so a 60s cut with 29.7s of interior silence still
 *  scored 95%. */
const COVERAGE_INTERIOR_GAP_SEC = 2.5;
const COVERAGE_MAX_REPORTED_GAPS = 12;

const round2 = (n: number): number => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const totalSpanSeconds = (spans: Span[]): number =>
  spans.reduce((sum, s) => sum + Math.max(0, s.endSec - s.startSec), 0);

const wantsProgress = (opts?: EditRunOptions): boolean => Boolean(opts?.onProgress);

function progressSpec(
  op: string,
  phase: FfmpegProgressSpec['phase'],
  durationSec: number | null | undefined,
  opts?: EditRunOptions,
): FfmpegProgressSpec {
  return { op, phase, durationSec: durationSec ?? null, ...opts };
}

/** Probe a single input's duration, swallowing errors (progress percent is
 *  best-effort — a probe miss must never fail the edit). */
async function safeDuration(input: string): Promise<number | null> {
  try {
    const d = (await probeMedia(input)).duration;
    return d > 0 ? d : null;
  } catch {
    return null;
  }
}

export interface ProbeResult {
  duration: number;
  video_duration?: number;
  audio_duration?: number;
  width: number;
  height: number;
  fps: number;
  pix_fmt: string | null;
  has_audio: boolean;
  v_codec: string | null;
  a_codec: string | null;
}

function parseRate(r: unknown): number {
  if (typeof r !== 'string' || !r.includes('/')) return 0;
  const [num, den] = r.split('/').map(Number);
  if (!num || !den) return 0;
  return Math.round((num / den) * 1000) / 1000;
}

/** Probe a media file for duration / resolution / fps / audio presence. */
export async function probeMedia(input: string): Promise<ProbeResult> {
  const { ffprobe } = resolveFfmpegTools();
  const r = await runOk(ffprobe, buildProbeArgs(input));
  const json = JSON.parse(r.stdout) as {
    format?: { duration?: string };
    streams?: Array<Record<string, unknown>>;
  };
  const streams = json.streams ?? [];
  const v = streams.find((s) => s.codec_type === 'video');
  const a = streams.find((s) => s.codec_type === 'audio');
  const duration = Number(json.format?.duration ?? (v?.duration as string) ?? 0) || 0;
  const videoDuration = Number(v?.duration ?? 0) || 0;
  const audioDuration = Number(a?.duration ?? 0) || 0;
  return {
    duration,
    ...(videoDuration > 0 ? { video_duration: videoDuration } : {}),
    ...(audioDuration > 0 ? { audio_duration: audioDuration } : {}),
    width: Number(v?.width ?? 0) || 0,
    height: Number(v?.height ?? 0) || 0,
    fps: parseRate(v?.avg_frame_rate ?? v?.r_frame_rate),
    pix_fmt: typeof v?.pix_fmt === 'string' ? v.pix_fmt : null,
    has_audio: Boolean(a),
    v_codec: (v?.codec_name as string) ?? null,
    a_codec: (a?.codec_name as string) ?? null,
  };
}

export interface OutputResult {
  output: string;
}

export interface SilenceInterval {
  startSec: number;
  endSec: number;
}

export interface SilenceTiming {
  durationSec: number;
  voicedStartSec: number;
  voicedEndSec: number;
  voicedDurationSec: number;
  leadingSilenceSec: number;
  trailingSilenceSec: number;
  silences: SilenceInterval[];
}

export interface CoverageReport {
  referenceDurationSec: number;
  voicedStartSec: number;
  voicedEndSec: number;
  leadingGapSec: number;
  trailingGapSec: number;
  overshootSec: number;
  /** How far into the clip the narration REACHES (0..1). Blind to interior
   *  silence: a half-silent track can still score 0.95 on it. */
  coverageRatio: number;
  /** Share of the clip that actually carries voice (0..1). This and
   *  `coverageRatio` disagreeing is exactly the half-silent-draft defect. */
  voicedRatio: number;
  /** Interior silent holes between voiced spans (clip timeline, ≥0.5s),
   *  largest first, capped at COVERAGE_MAX_REPORTED_GAPS. */
  interiorGaps: Array<{ startSec: number; endSec: number; durationSec: number }>;
  maxInteriorGapSec: number;
  /** Seconds two lines speak at once, and how many line pairs collide. A line
   *  whose audio runs past the next line's start mixes as double narration. */
  maxOverlapSec: number;
  overlapCount: number;
  status: 'ok' | 'under' | 'over' | 'silent' | 'gapped' | 'overlapped';
  warnings: string[];
}

export interface MixResult extends OutputResult {
  coverage?: CoverageReport;
  /** Present when the written file's audio outlives its video by more than
   *  0.3s — sound over a frozen or absent picture is not a deliverable. */
  av_mismatch?: {
    video_duration_sec: number;
    audio_duration_sec: number;
    audio_overrun_sec: number;
  };
}

export interface NormalizeLoudnessResult extends OutputResult {
  loudness: LoudnessResult;
}

async function ffmpeg(args: string[], spec?: FfmpegProgressSpec, outputOnFailure?: string): Promise<void> {
  const { ffmpeg: bin } = resolveFfmpegTools();
  try {
    if (!spec?.onProgress) {
      await runOk(bin, args, spec?.signal ? { signal: spec.signal } : {});
      return;
    }
    // Progress path: use `run` (via runFfmpeg) so we can stream, then reproduce
    // runOk's throw-on-failure contract with the same message shape.
    const r = await runFfmpeg(bin, args, spec);
    if (r.code !== 0) {
      const tail = r.stderr.trim().split('\n').slice(-12).join('\n');
      throw new Error(`'${bin}' exited with code ${r.code}\n${tail}`);
    }
  } catch (e) {
    // ffmpeg creates its output before the filter graph initializes, so a
    // failed run must not leave the partial file behind: a caller that stats
    // the path after a caught error sees a plausible, unusable delivery.
    if (outputOnFailure) {
      try {
        rmSync(resolve(outputOnFailure), { force: true });
      } catch {
        /* absent or busy — best effort */
      }
    }
    throw e;
  }
}

/**
 * Pure pre-flight check for a trim window against the input's real duration.
 * Returns an error message, or null when the requested cut is usable. Catches
 * the common mistakes that otherwise yield a 0-byte / near-empty output: a
 * sub-frame duration, or a start at/after the end of the clip.
 */
export function validateTrimRequest(inputDurationSec: number, startSec: number, durationSec: number): string | null {
  if (!(durationSec >= MIN_TRIM_OUTPUT_SEC)) {
    return `trim duration must be at least ${MIN_TRIM_OUTPUT_SEC}s; got ${round2(durationSec)}s.`;
  }
  if (Number.isFinite(inputDurationSec) && inputDurationSec > 0) {
    const remaining = inputDurationSec - startSec;
    if (remaining < MIN_TRIM_OUTPUT_SEC) {
      return (
        `trim start ${round2(startSec)}s is outside or too close to the end of the ${round2(inputDurationSec)}s input; `
        + `choose a start at least ${MIN_TRIM_OUTPUT_SEC}s before the end.`
      );
    }
  }
  return null;
}

/** Post-flight check: reject a trim that produced an empty or unusably short file. */
async function validateTrimOutput(output: string): Promise<string | null> {
  const abs = resolve(output);
  let bytes = 0;
  try {
    bytes = statSync(abs).size;
  } catch {
    bytes = 0;
  }
  if (bytes <= 0) return 'trim produced an empty output file; check the requested start/duration.';
  let durationSec = 0;
  try {
    durationSec = (await probeMedia(abs)).duration;
  } catch {
    durationSec = 0;
  }
  if (!(durationSec >= MIN_TRIM_OUTPUT_SEC)) {
    return `trim produced a ${round2(durationSec)}s output, which is too short to use; check the requested start/duration.`;
  }
  return null;
}

export async function trim(params: TrimParams, opts?: EditRunOptions): Promise<OutputResult> {
  ensureParentDir(params.output);
  // buildTrimArgs validates the start/duration SHAPE (throws on NaN / no window);
  // after it passes we have a finite, positive effective duration.
  const args = buildTrimArgs(params);
  const effectiveDur = finiteNum(params.duration_sec)
    ? params.duration_sec
    : (params.end_sec as number) - params.start_sec;
  const inputDurationSec = (await probeMedia(params.input)).duration;
  const rangeError = validateTrimRequest(inputDurationSec, params.start_sec, effectiveDur);
  if (rangeError) throw new Error(rangeError);
  await ffmpeg(args, progressSpec('trim', 'edit', effectiveDur, opts), params.output);
  const outputError = await validateTrimOutput(params.output);
  if (outputError) throw new Error(outputError);
  return { output: resolve(params.output) };
}

/** One input's probe, degraded to nulls when the probe fails: concat's conform
 *  and drift checks must fail open, never fail the join over a probe miss. */
async function safeConcatProbe(input: string): Promise<{ durationSec: number | null; spec: ConcatInputSpec | null }> {
  try {
    const p = await probeMedia(input);
    return {
      durationSec: p.duration > 0 ? p.duration : null,
      spec: p.width > 0 && p.height > 0 && p.fps > 0 ? { width: p.width, height: p.height, fps: p.fps } : null,
    };
  } catch {
    return { durationSec: null, spec: null };
  }
}

/** What a join had to change about its inputs before they could be joined. */
export interface ConcatConformReport {
  applied: true;
  target: string;
  conformed_inputs: Array<{ input: string; from: string; to: string }>;
  note: string;
}

export interface ConcatResult extends OutputResult {
  conform?: ConcatConformReport;
}

const specLabel = (s: ConcatInputSpec): string => `${s.width}x${s.height}@${s.fps}`;

export async function concat(inputs: string[], output: string, opts?: EditRunOptions): Promise<ConcatResult> {
  if (inputs.length < 1) throw new Error('concat: at least one input is required');
  ensureParentDir(output);
  const list = join(tmpdir(), `ovs-concat-${randomUUID()}.txt`);
  const scratch: string[] = [];
  try {
    const probes = await mapWithConcurrencyLimit(inputs, PROBE_CONCURRENCY, (p) => safeConcatProbe(p));
    const durations = probes.map((p) => p.durationSec);
    const expectedSec = durations.every((d): d is number => typeof d === 'number' && d > 0)
      ? durations.reduce((a, b) => a + b, 0)
      : null;

    // The concat demuxer takes its canvas and time base from the FIRST input
    // and reinterprets the rest against it, so joining a mixed set silently
    // corrupts the timeline (e.g. 15fps parts after a 24fps first input come
    // out 24/15 longer) — conform mismatched inputs onto the largest canvas at
    // the highest rate before joining.
    const target = chooseConcatTarget(probes.map((p) => p.spec));
    let joinInputs = inputs;
    let conform: ConcatConformReport | undefined;
    if (target) {
      const conformedInputs: ConcatConformReport['conformed_inputs'] = [];
      joinInputs = [];
      for (let i = 0; i < inputs.length; i += 1) {
        const spec = probes[i].spec as ConcatInputSpec;
        if (spec.width === target.width && spec.height === target.height && spec.fps === target.fps) {
          joinInputs.push(inputs[i]);
          continue;
        }
        const conformed = join(tmpdir(), `ovs-conform-${randomUUID()}.mp4`);
        scratch.push(conformed);
        // No progress spec: streaming each conform as its own 0-100% cycle
        // would make one concat report several restarting bars. Keep the abort
        // signal so a cancelled concat stops mid-conform.
        await ffmpeg(
          buildConformArgs(inputs[i], target, conformed),
          opts?.signal ? { op: 'concat', phase: 'edit', durationSec: null, signal: opts.signal } : undefined,
          conformed,
        );
        conformedInputs.push({ input: inputs[i], from: specLabel(spec), to: specLabel(target) });
        joinInputs.push(conformed);
      }
      // Re-encoding the caller's material to a canvas and frame rate it did not
      // ask for is a change to the delivery, not an implementation detail —
      // report it so the caller can weigh re-rendering the parts instead.
      conform = {
        applied: true,
        target: specLabel(target),
        conformed_inputs: conformedInputs,
        note: 'Inputs did not share one canvas and frame rate, so the mismatched ones were re-encoded onto the'
          + ' largest canvas at the highest rate before joining. An upscaled part carries the detail of its'
          + ' original render, not of the target — re-render it at delivery quality if that matters.',
      };
    }

    const body = joinInputs.map((p) => `file '${resolve(p).replace(/'/g, "'\\''")}'`).join('\n');
    writeFileSync(list, body + '\n', 'utf8');
    await ffmpeg(buildConcatArgs(list, output), progressSpec('concat', 'edit', expectedSec, opts), output);

    const actualSec = (await safeDuration(output)) ?? 0;
    const driftError = concatDurationDriftError(expectedSec, actualSec);
    if (driftError) throw new Error(driftError);

    return { output: resolve(output), ...(conform ? { conform } : {}) };
  } finally {
    rmSync(list, { force: true });
    for (const tmp of scratch) rmSync(tmp, { force: true });
  }
}

export async function burnsubs(input: string, srtPath: string, output: string, opts?: EditRunOptions): Promise<OutputResult> {
  ensureParentDir(output);
  // Pick a caption font that covers the subtitle text's script; the platform
  // default family can render Simplified-only characters as tofu boxes.
  let subtitleText = '';
  try {
    subtitleText = readFileSync(resolve(srtPath), 'utf8');
  } catch {
    /* unreadable subtitles fail in ffmpeg with its own message */
  }
  const fontName = captionFontForText(subtitleText, process.platform);
  const durationSec = wantsProgress(opts) ? await safeDuration(input) : null;
  await ffmpeg(buildBurnsubsArgs(input, resolve(srtPath), output, fontName || undefined), progressSpec('burnsubs', 'edit', durationSec, opts), output);
  return { output: resolve(output) };
}

export async function overlay(base: string, ov: string, x: number, y: number, output: string, opts?: EditRunOptions): Promise<OutputResult> {
  ensureParentDir(output);
  const probeOrNull = async (p: string): Promise<ProbeResult | null> => {
    try {
      return await probeMedia(p);
    } catch {
      return null;
    }
  };
  const [baseInfo, overlayInfo] = await Promise.all([probeOrNull(base), probeOrNull(ov)]);
  // A full-frame overlay with no alpha channel does not composite — it
  // REPLACES every pixel of the base footage. Fail closed with the real
  // options instead of shipping the loss; sub-frame opaque overlays (logo
  // boxes, lower thirds) keep working.
  if (
    overlayWouldEraseBase(
      baseInfo,
      overlayInfo ? { width: overlayInfo.width, height: overlayInfo.height, hasAlpha: pixFmtHasAlpha(overlayInfo.pix_fmt) } : null,
    )
  ) {
    throw new Error(
      `overlay covers the full ${baseInfo?.width}x${baseInfo?.height} base with an opaque `
      + `${overlayInfo?.width}x${overlayInfo?.height} layer (pix_fmt ${overlayInfo?.pix_fmt || 'unknown'} has no alpha), `
      + 'which would completely replace the base footage instead of compositing over it. Use edge elements smaller '
      + 'than the frame (logo box, lower third), or plan this beat as a composed primary segment without footage '
      + 'underneath; a full-frame brand layer over footage needs an alpha-capable overlay (e.g. a transparent PNG/WebM).',
    );
  }
  const durationSec = baseInfo && baseInfo.duration > 0 ? baseInfo.duration : null;
  await ffmpeg(buildOverlayArgs(base, ov, x, y, output), progressSpec('overlay', 'edit', durationSec, opts), output);
  return { output: resolve(output) };
}

export async function extractFrame(input: string, atSec: number, output: string): Promise<OutputResult> {
  ensureParentDir(output);
  await ffmpeg(buildExtractFrameArgs(input, atSec, output), undefined, output);
  return { output: resolve(output) };
}

export interface LoudnessResult {
  input_i: number;
  input_tp: number;
  input_lra: number;
  target_i: number;
  target_tp: number;
}

/** Measure integrated loudness / true peak via ffmpeg's loudnorm analysis pass. */
export async function loudness(input: string, opts?: EditRunOptions): Promise<LoudnessResult> {
  const { ffmpeg: bin } = resolveFfmpegTools();
  const durationSec = wantsProgress(opts) ? await safeDuration(input) : null;
  const r = await runFfmpeg(bin, buildLoudnessArgs(input), progressSpec('loudness', 'analyze', durationSec, opts));
  // loudnorm prints its JSON block to stderr; grab the last {...}.
  const m = r.stderr.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('loudness: could not parse loudnorm output');
  const j = JSON.parse(m[0]) as Record<string, string>;
  const num = (k: string) => Number(j[k]);
  return {
    input_i: num('input_i'),
    input_tp: num('input_tp'),
    input_lra: num('input_lra'),
    target_i: -14,
    target_tp: -1,
  };
}

/** Normalize a media file to the publish loudness target and write a new output. */
export async function normalizeLoudness(input: string, output: string, opts?: EditRunOptions): Promise<NormalizeLoudnessResult> {
  ensureParentDir(output);
  const probe = await probeMedia(input);
  if (!probe.has_audio) throw new Error('normalize-loudness: input has no audio stream');
  await ffmpeg(buildNormalizeLoudnessArgs(input, output), progressSpec('normalize_loudness', 'edit', probe.duration, opts), output);
  return { output: resolve(output), loudness: await loudness(output, opts) };
}

/** Parse ffmpeg silencedetect stderr into voiced/silence timing. */
export function parseSilenceDetect(stderr: string, durationSec: number): SilenceTiming {
  const epsLead = 0.05;
  const epsTail = 0.3;
  const tokens: Array<{ kind: 'start' | 'end'; t: number }> = [];
  const re = /silence_(start|end):\s*(-?[\d.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stderr)) !== null) {
    const t = Number(m[2]);
    if (Number.isFinite(t)) tokens.push({ kind: m[1] as 'start' | 'end', t });
  }

  const dur = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0;
  const silences: SilenceInterval[] = [];
  let openStart: number | null = null;
  for (const token of tokens) {
    if (token.kind === 'start') {
      openStart = token.t;
      continue;
    }
    if (openStart !== null) {
      silences.push({ startSec: Math.max(0, openStart), endSec: Math.min(Math.max(0, token.t), dur || token.t) });
      openStart = null;
    }
  }
  if (openStart !== null && dur > 0) silences.push({ startSec: Math.max(0, openStart), endSec: dur });

  const first = silences[0];
  const last = silences.at(-1);
  const leadingSilenceSec = first && first.startSec <= epsLead ? Math.min(first.endSec, dur) : 0;
  const trailingSilenceSec = last && dur > 0 && last.endSec >= dur - epsTail ? Math.max(0, dur - last.startSec) : 0;
  const totalSilence = silences.reduce((sum, iv) => sum + Math.max(0, Math.min(iv.endSec, dur) - iv.startSec), 0);
  const voicedDurationSec = Math.max(0, dur - totalSilence);
  const voicedStartSec = leadingSilenceSec;
  const voicedEndSec = Math.max(voicedStartSec, dur - trailingSilenceSec);
  return { durationSec: dur, voicedStartSec, voicedEndSec, voicedDurationSec, leadingSilenceSec, trailingSilenceSec, silences };
}

export function assessVoiceoverCoverage(input: {
  referenceDurationSec: number;
  voicedStartSec: number;
  voicedEndSec: number;
  audioEndSec: number;
  /** Voiced spans on the clip timeline (already offset-shifted). When
   *  provided, interior holes and line collisions between them are measured;
   *  without them the report can only see the head and tail. */
  voicedSpans?: Array<{ startSec: number; endSec: number }>;
}): CoverageReport {
  const ref = Math.max(0, input.referenceDurationSec);
  const voicedStart = Math.max(0, input.voicedStartSec);
  const voicedEnd = Math.max(voicedStart, input.voicedEndSec);
  const audioEnd = Math.max(0, input.audioEndSec);
  const hasVoice = voicedEnd - voicedStart > 0.05 && audioEnd > 0.05;
  const leadingGapSec = round2(voicedStart);
  const trailingGapSec = round2(ref - voicedEnd);
  const overshootSec = round2(audioEnd - ref);
  const coverageRatio = ref > 0 ? round2(clamp(voicedEnd / ref, 0, 1)) : 0;

  // Merge the spans and measure what sits between them. Only holes ≥0.5s
  // count — natural inter-phrase pauses are not dead air.
  const spans = (input.voicedSpans ?? [])
    .map((sp) => ({ startSec: Math.max(0, sp.startSec), endSec: Math.min(ref, sp.endSec) }))
    .filter((sp) => sp.endSec - sp.startSec > 0.05)
    .sort((a, z) => a.startSec - z.startSec);
  const merged: Array<{ startSec: number; endSec: number }> = [];
  for (const sp of spans) {
    const last = merged[merged.length - 1];
    if (last && sp.startSec <= last.endSec + 0.05) last.endSec = Math.max(last.endSec, sp.endSec);
    else merged.push({ ...sp });
  }
  // Overlaps are measured on the RAW spans, before merging: merging is what
  // hides a collision, and a collision is exactly what must be reported.
  let maxOverlapSec = 0;
  let overlapCount = 0;
  for (let i = 1; i < spans.length; i += 1) {
    const collide = spans[i - 1].endSec - spans[i].startSec;
    if (collide > 0.05) {
      overlapCount += 1;
      maxOverlapSec = Math.max(maxOverlapSec, collide);
    }
  }
  maxOverlapSec = round2(maxOverlapSec);
  const interiorGaps: CoverageReport['interiorGaps'] = [];
  for (let i = 1; i < merged.length; i += 1) {
    const gap = merged[i].startSec - merged[i - 1].endSec;
    if (gap >= 0.5) {
      interiorGaps.push({
        startSec: round2(merged[i - 1].endSec),
        endSec: round2(merged[i].startSec),
        durationSec: round2(gap),
      });
    }
  }
  interiorGaps.sort((a, z) => z.durationSec - a.durationSec);
  interiorGaps.length = Math.min(interiorGaps.length, COVERAGE_MAX_REPORTED_GAPS);
  const maxInteriorGapSec = interiorGaps.length ? interiorGaps[0].durationSec : 0;
  const voicedTotal = merged.reduce((sum, sp) => sum + (sp.endSec - sp.startSec), 0);
  const voicedRatio = ref > 0
    ? round2(clamp((merged.length ? voicedTotal : Math.max(0, voicedEnd - voicedStart)) / ref, 0, 1))
    : 0;

  const warnings: string[] = [];
  let status: CoverageReport['status'] = 'ok';
  if (!hasVoice) {
    status = 'silent';
    warnings.push('No speech or non-silent audio was detected in the added audio.');
  } else {
    if (overshootSec > COVERAGE_OVERSHOOT_SEC) {
      status = 'over';
      // Nothing truncates the mix here (no -shortest; amix runs to the longest
      // input), so the honest description is an overrun, not a cut.
      warnings.push(`Added audio runs ${overshootSec}s past the ${round2(ref)}s base — the mix carries sound past the video's end. Shorten the script so it ends before the clip does (trim the words; do not just raise speed).`);
    }
    if (trailingGapSec > COVERAGE_TRAILING_GAP_SEC) {
      if (status === 'ok') status = 'under';
      const pct = ref > 0 ? Math.round((trailingGapSec / ref) * 100) : 0;
      warnings.push(`Added audio ends at ${round2(voicedEnd)}s, leaving ${trailingGapSec}s of silent tail on a ${round2(ref)}s clip (~${pct}% uncovered) — lengthen the script, add a closing line, or trim the clip to match.`);
    }
    if (leadingGapSec > COVERAGE_LEAD_GAP_SEC) {
      warnings.push(`Added audio starts at ${leadingGapSec}s; check whether the long lead-in is intentional.`);
    }
    if (overlapCount > 0 && maxOverlapSec > 0.3) {
      // Double narration outranks everything except truncation: two voices at
      // once is broken audio, not a style choice.
      if (status !== 'over') status = 'overlapped';
      warnings.push(`${overlapCount} narration line pair(s) overlap by up to ${maxOverlapSec}s — two lines speak at once. A line's audio must end before the next line's start_sec; shorten the colliding lines or move their windows, and check that target_sec is each line's DURATION, not its end time.`);
    }
    if (maxInteriorGapSec > COVERAGE_INTERIOR_GAP_SEC) {
      // Interior dead air outranks a short tail: 'under' describes a missing
      // ending, 'gapped' a broken middle, and the middle is what listeners
      // hear first. Truncation ('over') and double voice keep priority.
      if (status === 'ok' || status === 'under') status = 'gapped';
      const silentTotal = round2(interiorGaps.reduce((sum, g) => sum + g.durationSec, 0));
      warnings.push(`Narration has ${interiorGaps.length} interior silent hole(s) totalling ${silentTotal}s (largest ${maxInteriorGapSec}s) — on a track with no music bed this is dead air. Re-time the lines inside their scenes, add the planned music bed, or shorten the over-long scenes; do not pad the script with filler words.`);
    }
  }

  return {
    referenceDurationSec: round2(ref),
    voicedStartSec: round2(voicedStart),
    voicedEndSec: round2(voicedEnd),
    leadingGapSec,
    trailingGapSec,
    overshootSec,
    coverageRatio,
    voicedRatio,
    interiorGaps,
    maxInteriorGapSec,
    maxOverlapSec,
    overlapCount,
    status,
    warnings,
  };
}

async function measureSilenceCoverage(input: string, opts?: EditRunOptions): Promise<SilenceTiming> {
  const { ffmpeg: bin } = resolveFfmpegTools();
  const durationSec = (await probeMedia(input)).duration;
  const r = await runFfmpeg(bin, ['-i', input, '-af', 'silencedetect=noise=-40dB:d=0.5', '-f', 'null', '-'], {
    op: 'silence_detect',
    phase: 'analyze',
    durationSec,
    ...opts,
  });
  if (r.code !== 0) {
    const tail = r.stderr.trim().split('\n').slice(-12).join('\n');
    throw new Error(`silence detect failed with code ${r.code}\n${tail}`);
  }
  return parseSilenceDetect(r.stderr, durationSec);
}

async function coverageForSegments(referenceDurationSec: number, segments: AudioSegment[], opts?: EditRunOptions): Promise<CoverageReport | undefined> {
  if (!segments.length || referenceDurationSec <= 0) return undefined;
  const timings = await mapWithConcurrencyLimit(segments, COVERAGE_CONCURRENCY, (seg) => measureSilenceCoverage(seg.path, opts));
  const starts: number[] = [];
  const ends: number[] = [];
  const audioEnds: number[] = [];
  const voicedSpans: Array<{ startSec: number; endSec: number }> = [];
  for (let i = 0; i < segments.length; i += 1) {
    const start = Math.max(0, finiteNum(segments[i].start_sec) ? segments[i].start_sec : 0);
    const timing = timings[i];
    starts.push(start + timing.voicedStartSec);
    ends.push(start + timing.voicedEndSec);
    audioEnds.push(start + timing.durationSec);
    // Keep the per-segment structure: min/max alone is what let a half-silent
    // track report high coverage and hid line collisions entirely.
    voicedSpans.push({ startSec: start + timing.voicedStartSec, endSec: start + timing.voicedEndSec });
  }
  if (!ends.length) return undefined;
  return assessVoiceoverCoverage({
    referenceDurationSec,
    voicedStartSec: Math.min(...starts),
    voicedEndSec: Math.max(...ends),
    audioEndSec: Math.max(...audioEnds),
    voicedSpans,
  });
}

export interface MixParams {
  base: string;
  segments: AudioSegment[];
  on_existing_audio?: OnExistingAudio;
  output: string;
}

/** Lay one or more timed audio segments onto a base video, then loudness-normalize. */
export async function mix(params: MixParams, opts?: EditRunOptions): Promise<MixResult> {
  ensureParentDir(params.output);
  const probe = await probeMedia(params.base);
  const args = buildMixArgs({
    base: params.base,
    baseHasAudio: probe.has_audio,
    segments: params.segments,
    on_existing_audio: params.on_existing_audio ?? 'reject',
    output: params.output,
  });
  await ffmpeg(args, progressSpec('mix', 'edit', probe.duration, opts), params.output);
  const coverage = await coverageForSegments(probe.duration, params.segments, opts);
  // The mix has no -shortest and amix runs to the longest input, so audio that
  // overruns the base is written into the file rather than cut. Measure the
  // OUTPUT: sound past the video's end plays over a frozen or absent picture.
  let avMismatch: MixResult['av_mismatch'];
  const outProbe = await probeMedia(resolve(params.output)).catch(() => null);
  if (outProbe?.video_duration && outProbe.audio_duration) {
    const overrun = round2(outProbe.audio_duration - outProbe.video_duration);
    if (overrun > 0.3) {
      avMismatch = {
        video_duration_sec: round2(outProbe.video_duration),
        audio_duration_sec: round2(outProbe.audio_duration),
        audio_overrun_sec: overrun,
      };
      coverage?.warnings.push(`The written file's audio outlives its video by ${overrun}s — retime or shorten the narration before delivering; sound over a frozen picture is not a deliverable.`);
    }
  }
  return { output: resolve(params.output), coverage, ...(avMismatch ? { av_mismatch: avMismatch } : {}) };
}

export interface DecisionResult {
  output: string;
  decision: DecisionEvidence;
}

/** Single-pass select/aselect jump-cut that keeps only `kept` from input. */
async function runJumpCut(input: string, kept: Span[], output: string, spec?: FfmpegProgressSpec): Promise<void> {
  const { filter, maps } = buildKeepFilterComplex(kept);
  await ffmpeg([
    '-y', '-i', input, '-filter_complex', filter, ...maps,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-ar', '48000', '-movflags', '+faststart', output,
  ], spec, output);
}

export interface TrimSilenceParams {
  input: string;
  output: string;
  noise_db?: number;
  min_silence_sec?: number;
  pad_sec?: number;
  min_keep_sec?: number;
}

/** Deterministic auto-cut: drop silent gaps (a tightened jump-cut) + return evidence. */
export async function trimSilence(p: TrimSilenceParams, opts?: EditRunOptions): Promise<DecisionResult> {
  ensureParentDir(p.output);
  const dur = (await probeMedia(p.input)).duration;
  const { spans } = await silence({
    input: p.input,
    ...(finiteNum(p.noise_db) ? { noise_db: p.noise_db } : {}),
    ...(finiteNum(p.min_silence_sec) ? { min_sec: p.min_silence_sec } : {}),
  });
  const removeSpans: Span[] = spans.map((s) => ({ startSec: s.start, endSec: s.end }));
  const kept = keepIntervalsFromRemovals(dur, removeSpans, {
    ...(finiteNum(p.pad_sec) ? { padSec: p.pad_sec } : {}),
    ...(finiteNum(p.min_silence_sec) ? { minRemoveSec: p.min_silence_sec } : {}),
    ...(finiteNum(p.min_keep_sec) ? { minKeepSec: p.min_keep_sec } : {}),
  });
  const removed = complementIntervals(kept, dur);
  if (!removed.length || !kept.length) {
    throw new Error(`no silence ≥ ${p.min_silence_sec ?? 0.5}s found — nothing to trim; use the original clip.`);
  }
  await runJumpCut(p.input, kept, p.output, progressSpec('trim_silence', 'edit', totalSpanSeconds(kept), opts));
  return { output: resolve(p.output), decision: decisionEvidence(removed, kept, `removed ${removed.length} silent span(s)`) };
}

export interface RemoveFillersParams {
  input: string;
  /** A transcript JSON with word timings (from `ovs transcribe`). */
  transcript: string;
  output: string;
  fillers?: string[];
  pad_sec?: number;
  min_keep_sec?: number;
}

/** Deterministic auto-cut: drop filler words ("um", "uh", …) using a word-level transcript. */
export async function removeFillers(p: RemoveFillersParams, opts?: EditRunOptions): Promise<DecisionResult> {
  ensureParentDir(p.output);
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(p.transcript, 'utf8'));
  } catch (e) {
    throw new Error(`could not read/parse transcript "${p.transcript}": ${(e as Error).message}`);
  }
  const words = normalizeTranscriptWords(json);
  if (!words.length) throw new Error('transcript had no word-level timings — run `ovs transcribe` (it emits a transcript.json).');
  const removeSpans = fillerSpansFromWords(
    words,
    p.fillers && p.fillers.length ? p.fillers : DEFAULT_FILLERS,
    finiteNum(p.pad_sec) ? { padSec: p.pad_sec } : {},
  );
  if (!removeSpans.length) throw new Error('no filler words found — nothing to remove; use the original clip.');
  const dur = (await probeMedia(p.input)).duration;
  if (dur <= 0) throw new Error('could not probe duration for filler removal.');
  // Filler spans are already padded; keep computation must not shrink or drop them.
  const kept = keepIntervalsFromRemovals(dur, removeSpans, {
    padSec: 0,
    minRemoveSec: 0,
    ...(finiteNum(p.min_keep_sec) ? { minKeepSec: p.min_keep_sec } : {}),
  });
  if (!kept.length) throw new Error('filler removal left nothing to keep.');
  await runJumpCut(p.input, kept, p.output, progressSpec('remove_fillers', 'edit', totalSpanSeconds(kept), opts));
  return { output: resolve(p.output), decision: decisionEvidence(removeSpans, kept, `removed ${removeSpans.length} filler word(s)`) };
}

export type EditOp =
  | 'probe'
  | 'trim'
  | 'concat'
  | 'burnsubs'
  | 'overlay'
  | 'extract-frame'
  | 'loudness'
  | 'normalize-loudness'
  | 'mix'
  | 'trim-silence'
  | 'remove-fillers';

/**
 * One multi-op entry point mirrored 1:1 by the CLI (`ovs edit <op>`) and the MCP
 * tool. Returns the op's result object.
 */
export async function editVideo(op: EditOp, params: Record<string, unknown>, opts?: EditRunOptions): Promise<unknown> {
  switch (op) {
    case 'probe':
      return probeMedia(String(params.input));
    case 'trim':
      return trim(params as unknown as TrimParams, opts);
    case 'concat':
      return concat((params.inputs as string[]) ?? [], String(params.output), opts);
    case 'burnsubs':
      return burnsubs(String(params.input), String(params.srt), String(params.output), opts);
    case 'overlay':
      return overlay(
        String(params.base),
        String(params.overlay),
        finiteNum(params.x) ? (params.x as number) : 0,
        finiteNum(params.y) ? (params.y as number) : 0,
        String(params.output),
        opts,
      );
    case 'extract-frame':
      return extractFrame(String(params.input), finiteNum(params.at_sec) ? (params.at_sec as number) : 0, String(params.output));
    case 'loudness':
      return loudness(String(params.input), opts);
    case 'normalize-loudness':
      return normalizeLoudness(String(params.input), String(params.output), opts);
    case 'mix':
      return mix(params as unknown as MixParams, opts);
    case 'trim-silence':
      return trimSilence(params as unknown as TrimSilenceParams, opts);
    case 'remove-fillers':
      return removeFillers(params as unknown as RemoveFillersParams, opts);
    default:
      throw new Error(`edit: unknown op "${String(op)}"`);
  }
}
