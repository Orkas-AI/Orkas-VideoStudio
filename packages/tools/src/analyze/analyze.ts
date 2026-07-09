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
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import type { SceneCandidate, QualityReport, QualityThresholds } from '@orkas/video-studio-core';
import { runFfmpeg, type EditRunOptions } from '../progress.js';
import { ocrImagesText, type OcrProgressEvent } from './ocr-runtime.js';

/** Transcription can pull a multi-GB model on first run for large-v3. */
const TRANSCRIBE_TIMEOUT_MS = 45 * 60 * 1000;

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v']);

export interface TranscribeParams {
  input: string;
  /** whisper model; use `large-v3` for non-English. */
  model?: string;
  language?: string;
  /** Optional path to persist the JSON transcript for later edit ops. */
  output?: string;
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
  const transcript: unknown = m ? JSON.parse(m[0]) : { raw: r.stdout.trim() };
  if (!params.output) return transcript;
  const output = resolve(params.output);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(transcript, null, 2), 'utf8');
  return { path: output, transcript };
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

export interface OcrParams {
  input: string;
  /** Seconds between sampled video frames (default 2.5). */
  interval_sec?: number;
  /** Maximum frames to OCR from a video (default 16, max 60). */
  max_frames?: number;
  /** Optional path to persist OCR JSON. */
  output?: string;
  signal?: AbortSignal;
  onProgress?: (event: OcrProgressEvent) => void;
}

export type OcrResult =
  | {
      ok: true;
      op: 'ocr';
      summary:
        | { op: 'ocr'; engine: 'local:rapidocr-onnxruntime'; kind: 'image'; text: string; items: Array<{ text: string; score?: number }> }
        | { op: 'ocr'; engine: 'local:rapidocr-onnxruntime'; kind: 'video'; durationSec: number; sampledFrames: number; segments: Array<{ startSec: number; endSec: number; text: string }> };
      path?: string;
    }
  | { ok: false; op: 'ocr'; errorCode: string; message: string; path?: string };

function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

function ocrInputKind(input: string): 'image' | 'video' | 'unsupported' {
  const ext = extname(input).toLowerCase();
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (VIDEO_EXTS.has(ext)) return 'video';
  return 'unsupported';
}

export function sampleTimecodes(durationSec: number, intervalSec?: number, maxFrames?: number): number[] {
  const dur = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0;
  if (dur <= 0) return [0];
  const cap = Math.max(1, Math.min(Math.floor(Number.isFinite(maxFrames) && (maxFrames as number) > 0 ? maxFrames as number : 16), 60));
  const desired = Math.max(0.5, Number.isFinite(intervalSec) && (intervalSec as number) > 0 ? intervalSec as number : 2.5);
  const step = Math.max(desired, dur / cap);
  const out: number[] = [];
  for (let t = step / 2; t < dur && out.length < cap; t += step) out.push(round2(t));
  if (!out.length) out.push(round2(dur / 2));
  return out;
}

export function collapseOcrSegments(frames: Array<{ tSec: number; text: string }>, durationSec: number): Array<{ startSec: number; endSec: number; text: string }> {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  const segments: Array<{ startSec: number; endSec: number; text: string }> = [];
  for (const frame of frames) {
    const text = norm(frame.text);
    if (!text) continue;
    const prev = segments[segments.length - 1];
    if (prev && norm(prev.text) === text) prev.endSec = frame.tSec;
    else segments.push({ startSec: frame.tSec, endSec: frame.tSec, text });
  }
  for (let i = 0; i < segments.length; i += 1) {
    const next = segments[i + 1];
    segments[i].startSec = round2(i === 0 ? 0 : segments[i].startSec);
    segments[i].endSec = round2(next ? next.startSec : Math.max(segments[i].endSec, durationSec));
  }
  return segments;
}

async function extractOcrFrame(input: string, atSec: number, output: string, signal?: AbortSignal): Promise<void> {
  const { ffmpeg } = resolveFfmpegTools();
  const r = await runFfmpeg(ffmpeg, ['-y', '-ss', String(Math.max(0, atSec)), '-i', input, '-frames:v', '1', '-update', '1', output], {
    op: 'ocr_extract_frame',
    phase: 'analyze',
    durationSec: null,
    ...(signal ? { signal } : {}),
  });
  if (r.code !== 0) {
    const tail = r.stderr.trim().split('\n').slice(-8).join('\n');
    throw new Error(`ocr frame extraction failed at ${round2(atSec)}s: ${tail || `exit ${r.code}`}`);
  }
}

async function writeOcrIfRequested(result: OcrResult, output?: string): Promise<OcrResult> {
  if (!output) return result;
  const abs = resolve(output);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, JSON.stringify(result, null, 2), 'utf8');
  return { ...result, path: abs };
}

/** Read on-screen text from an image or sampled video frames with local RapidOCR. */
export async function ocr(params: OcrParams): Promise<OcrResult> {
  const input = resolve(params.input);
  const st = await stat(input).catch(() => null);
  if (!st?.isFile()) {
    return writeOcrIfRequested({ ok: false, op: 'ocr', errorCode: 'E_ANALYZE_NO_INPUT', message: `input is not a file: ${input}` }, params.output);
  }
  const kind = ocrInputKind(input);
  if (kind === 'unsupported') {
    return writeOcrIfRequested({ ok: false, op: 'ocr', errorCode: 'E_ANALYZE_ARG', message: `ocr input must be an image or video: ${input}` }, params.output);
  }

  if (kind === 'image') {
    const batch = await ocrImagesText({ absPaths: [input], signal: params.signal, onProgress: params.onProgress });
    if (!batch.ok) return writeOcrIfRequested({ ok: false, op: 'ocr', errorCode: batch.errorCode, message: batch.message }, params.output);
    const first = batch.results[0] || { text: '', items: [] };
    return writeOcrIfRequested({
      ok: true,
      op: 'ocr',
      summary: {
        op: 'ocr',
        engine: 'local:rapidocr-onnxruntime',
        kind: 'image',
        text: first.text,
        items: first.items,
      },
    }, params.output);
  }

  const durationSec = await probeDuration(input);
  if (durationSec <= 0) {
    return writeOcrIfRequested({ ok: false, op: 'ocr', errorCode: 'E_ANALYZE_FAILED', message: 'could not probe video duration for frame sampling.' }, params.output);
  }
  const times = sampleTimecodes(durationSec, params.interval_sec, params.max_frames);
  const tmp = await mkdtemp(join(tmpdir(), 'ovs-ocr-'));
  try {
    const extracted: Array<{ tSec: number; framePath: string }> = [];
    for (const t of times) {
      if (params.signal?.aborted) {
        return writeOcrIfRequested({ ok: false, op: 'ocr', errorCode: 'E_ANALYZE_ABORTED', message: 'ocr aborted.' }, params.output);
      }
      const framePath = join(tmp, `f-${Math.round(t * 1000)}.png`);
      await extractOcrFrame(input, t, framePath, params.signal);
      extracted.push({ tSec: t, framePath });
    }
    const batch = await ocrImagesText({
      absPaths: extracted.map((frame) => frame.framePath),
      signal: params.signal,
      onProgress: params.onProgress,
    });
    if (!batch.ok) return writeOcrIfRequested({ ok: false, op: 'ocr', errorCode: batch.errorCode, message: batch.message }, params.output);
    const frames = extracted
      .map((frame, index) => ({ tSec: frame.tSec, text: batch.results[index]?.text || '', error: batch.results[index]?.error }))
      .filter((frame) => !frame.error);
    const segments = collapseOcrSegments(frames, durationSec);
    return writeOcrIfRequested({
      ok: true,
      op: 'ocr',
      summary: {
        op: 'ocr',
        engine: 'local:rapidocr-onnxruntime',
        kind: 'video',
        durationSec: round2(durationSec),
        sampledFrames: frames.length,
        segments,
      },
    }, params.output);
  } catch (err) {
    return writeOcrIfRequested({ ok: false, op: 'ocr', errorCode: 'E_ANALYZE_FAILED', message: (err as Error).message }, params.output);
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}
