import {
  resolveFfmpegTools,
  resolveBinaries,
  buildHyperframesEnv,
  hyperframesNpxArgs,
  parseSceneChanges,
  parseQualityFrames,
  parseLabeledIntervals,
  summarizeQuality,
  run,
  runOk,
} from '@orkas/video-studio-core';
import type { SceneCandidate, QualityReport, QualityThresholds } from '@orkas/video-studio-core';
import { runFfmpeg, type EditRunOptions } from '../progress.js';

/** Transcription can pull a multi-GB model on first run for large-v3. */
const TRANSCRIBE_TIMEOUT_MS = 45 * 60 * 1000;

export interface TranscribeParams {
  input: string;
  /** whisper model; use `large-v3` for non-English. */
  model?: string;
  language?: string;
  signal?: AbortSignal;
}

/**
 * Transcribe speech to timed segments via `npx hyperframes transcribe` (whisper.cpp).
 * Returns whatever JSON the HyperFrames transcribe command emits.
 */
export async function transcribe(params: TranscribeParams): Promise<unknown> {
  const { npx } = resolveBinaries();
  if (!npx) throw new Error('Transcription runs `npx hyperframes transcribe`. Install Node.js (which provides npx).');
  const env = buildHyperframesEnv(resolveFfmpegTools());
  const extra = ['--json'];
  if (params.model) extra.push('--model', params.model);
  if (params.language) extra.push('--language', params.language);
  const r = await runOk(npx, hyperframesNpxArgs('transcribe', [params.input, ...extra]), {
    env,
    signal: params.signal,
    timeoutMs: TRANSCRIBE_TIMEOUT_MS,
  });
  const m = r.stdout.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!m) return { raw: r.stdout.trim() };
  return JSON.parse(m[0]);
}

export interface SilenceSpan {
  start: number;
  end: number;
}

export interface SilenceParams {
  input: string;
  /** Silence threshold in dB (default -40). */
  noise_db?: number;
  /** Minimum silence length in seconds (default 0.5). */
  min_sec?: number;
}

/**
 * Detect silent spans via ffmpeg's silencedetect filter. Pure-ish: parses the
 * `silence_start` / `silence_end` markers ffmpeg writes to stderr.
 */
export async function silence(params: SilenceParams, opts?: EditRunOptions): Promise<{ spans: SilenceSpan[] }> {
  const { ffmpeg } = resolveFfmpegTools();
  const noise = Number.isFinite(params.noise_db) ? params.noise_db : -40;
  const dur = Number.isFinite(params.min_sec) ? params.min_sec : 0.5;
  const durationSec = opts?.onProgress ? (await probeDuration(params.input)) || null : null;
  const r = await runFfmpeg(ffmpeg, ['-i', params.input, '-af', `silencedetect=noise=${noise}dB:d=${dur}`, '-f', 'null', '-'], {
    op: 'silence_detect',
    phase: 'analyze',
    durationSec,
    ...opts,
  });
  return { spans: parseSilence(r.stderr) };
}

/** Parse ffmpeg silencedetect stderr into start/end spans. Exported for tests. */
export function parseSilence(stderr: string): SilenceSpan[] {
  const spans: SilenceSpan[] = [];
  let pendingStart: number | null = null;
  for (const line of stderr.split('\n')) {
    const start = line.match(/silence_start:\s*(-?[\d.]+)/);
    if (start) {
      pendingStart = Number(start[1]);
      continue;
    }
    const end = line.match(/silence_end:\s*(-?[\d.]+)/);
    if (end && pendingStart !== null) {
      spans.push({ start: pendingStart, end: Number(end[1]) });
      pendingStart = null;
    }
  }
  return spans;
}

/** Lightweight duration probe (avoids importing edit's probeMedia → no cycle). */
async function probeDuration(input: string): Promise<number> {
  const { ffprobe } = resolveFfmpegTools();
  const r = await run(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nokey=1:noprint_wrappers=1', input]);
  const v = Number(r.stdout.trim());
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export interface ScenesResult {
  durationSec: number;
  threshold: number;
  candidates: SceneCandidate[];
}

/**
 * Detect shot/scene boundaries via ffmpeg's `select=scene` + metadata print →
 * candidate cut points (timecode + score) for the decision layer to pick from.
 */
export async function scenes(params: { input: string; threshold?: number }, opts?: EditRunOptions): Promise<ScenesResult> {
  const { ffmpeg } = resolveFfmpegTools();
  const t = params.threshold;
  const threshold = Number.isFinite(t) && (t as number) >= 0 && (t as number) <= 1 ? (t as number) : 0.4;
  const dur = await probeDuration(params.input);
  // `select='gt(scene,TH)'` keeps only scene-change frames; `metadata=print`
  // prints each kept frame's pts_time + lavfi.scene_score. Parse stdout+stderr.
  const r = await runFfmpeg(ffmpeg, ['-hide_banner', '-nostats', '-i', params.input, '-vf', `select='gt(scene,${threshold})',metadata=print`, '-an', '-f', 'null', '-'], {
    op: 'scene_detect',
    phase: 'analyze',
    durationSec: dur || null,
    ...opts,
  });
  return { durationSec: dur, threshold, candidates: parseSceneChanges(`${r.stdout}\n${r.stderr}`) };
}

/**
 * Score footage quality (blur / exposure / black / freeze) in one ffmpeg pass —
 * `fps=3,blackdetect,freezedetect,blurdetect,signalstats,metadata=print`. Zero
 * new deps (all in ffmpeg). Returns flags + a 0..1 score + offending spans.
 */
export async function quality(params: { input: string; thresholds?: QualityThresholds; fps?: number }, opts?: EditRunOptions): Promise<QualityReport> {
  const { ffmpeg } = resolveFfmpegTools();
  const f = params.fps;
  const fps = Number.isFinite(f) && (f as number) > 0 && (f as number) <= 30 ? (f as number) : 3;
  const dur = await probeDuration(params.input);
  const vf = `fps=${fps},blackdetect=d=0.1:pix_th=0.10,freezedetect=n=0.003:d=0.5,blurdetect,signalstats,metadata=print`;
  const r = await runFfmpeg(ffmpeg, ['-hide_banner', '-nostats', '-i', params.input, '-vf', vf, '-an', '-f', 'null', '-'], {
    op: 'quality_scan',
    phase: 'analyze',
    durationSec: dur || null,
    ...opts,
  });
  const log = `${r.stdout}\n${r.stderr}`;
  return summarizeQuality({
    durationSec: dur,
    frames: parseQualityFrames(log),
    blackSpans: parseLabeledIntervals(log, 'black'),
    freezeSpans: parseLabeledIntervals(log, 'freeze'),
    ...(params.thresholds ? { thresholds: params.thresholds } : {}),
  });
}

/** OCR over on-screen text is a P2 capability (needs an OCR runtime dependency). */
export function ocr(): Promise<never> {
  return Promise.reject(
    new Error('ocr is not available in this build yet (planned for the generate/BYO milestone). For now, extract frames with `ovs edit extract-frame` and read them.'),
  );
}
