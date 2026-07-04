/**
 * Streaming progress for the ffmpeg-backed edit/analyze ops. ffmpeg can run for
 * many seconds (a jump-cut of long footage, a loudness scan); without feedback a
 * driving agent can't tell a slow pass from a hung one. We ask ffmpeg for its
 * machine-readable `-progress` stream and turn it into structured events.
 *
 * The tool layer stays free of process IO: ops take an `onProgress` callback and
 * this module calls it — the CLI/MCP shell decides where events go (typically a
 * JSON line per event on stderr, never stdout). No callback => zero overhead,
 * just a plain `run`.
 */

import { run, type RunResult } from '@orkas/video-studio-core';

/** A structured progress event emitted while an ffmpeg-backed op runs. */
export interface EditProgressEvent {
  type: 'progress';
  source: 'video_edit';
  /** The op that is running (e.g. 'trim', 'concat', 'silence_detect'). */
  op: string;
  phase: 'analyze' | 'edit' | 'validate';
  status: 'heartbeat' | 'running' | 'completed' | 'failed' | 'aborted';
  /** Wall-clock seconds since the op started. */
  elapsed_sec: number;
  /** ffmpeg's processed input position in seconds, when parseable. */
  processed_sec?: number;
  /** 0..100 when a total duration is known. */
  percent?: number;
  /** Process exit code on a terminal non-success status. */
  code?: number | null;
}

export type OnEditProgress = (event: EditProgressEvent) => void;

/** Optional per-call controls shared by the ffmpeg-backed edit/analyze ops. */
export interface EditRunOptions {
  signal?: AbortSignal;
  onProgress?: OnEditProgress;
}

/** Descriptor the executor passes so emitted events are self-identifying. */
export interface FfmpegProgressSpec extends EditRunOptions {
  op: string;
  phase?: EditProgressEvent['phase'];
  /** Total seconds of work, for percent. Null/undefined => percent omitted. */
  durationSec?: number | null;
  /** Override the quiet-period heartbeat interval (mainly for tests). */
  heartbeatMs?: number;
}

const HEARTBEAT_MS = 15_000;
const MIN_EMIT_MS = 2_000;

const round2 = (n: number): number => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** Parse an ffmpeg `HH:MM:SS.ms` clock into seconds (used for `out_time`). */
export function parseProgressClock(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const sec = Number(m[3]);
  if (![h, min, sec].every(Number.isFinite)) return null;
  return h * 3600 + min * 60 + sec;
}

/** Read ffmpeg's processed input position (seconds) from `-progress` key=values.
 *  Prefers the microsecond/millisecond counters, falls back to the clock. */
export function parseFfmpegProgressTimeSec(fields: Record<string, string>): number | null {
  for (const key of ['out_time_us', 'out_time_ms']) {
    const raw = fields[key];
    if (!raw) continue;
    const micros = Number(raw);
    if (Number.isFinite(micros) && micros >= 0) return micros / 1_000_000;
  }
  return parseProgressClock(fields.out_time);
}

/** Prepend `-progress pipe:2` so ffmpeg streams key=value progress to stderr
 *  (additive — it does not suppress the summaries the op parsers rely on). */
export function withFfmpegProgress(args: string[]): string[] {
  return args.includes('-progress') ? args : ['-progress', 'pipe:2', ...args];
}

/** Bounded-concurrency map — caps how many ffprobe children we spawn at once
 *  when a multi-input op needs each input's duration for percent. */
export async function mapWithConcurrencyLimit<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const width = Math.max(1, Math.min(items.length, Math.floor(limit) || 1));
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: width }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await worker(items[index], index);
      }
    }),
  );
  return results;
}

/**
 * Run an ffmpeg command via the core `run`, emitting structured progress to
 * `spec.onProgress`: a heartbeat while ffmpeg is quiet, throttled `running`
 * updates parsed from `-progress`, and a terminal `completed`/`failed`. When no
 * callback is supplied this is a plain `run` with no added overhead. Always
 * resolves with the RunResult (never rejects on a non-zero exit) so callers own
 * failure and can still read stderr (loudness/silence parse it).
 */
export async function runFfmpeg(bin: string, rawArgs: string[], spec: FfmpegProgressSpec): Promise<RunResult> {
  const { onProgress, signal } = spec;
  const runOpts = signal ? { signal } : {};
  if (!onProgress) return run(bin, rawArgs, runOpts);

  const phase = spec.phase ?? 'edit';
  const durationSec =
    typeof spec.durationSec === 'number' && Number.isFinite(spec.durationSec) && spec.durationSec > 0
      ? spec.durationSec
      : null;
  const startedAtMs = Date.now();
  const emit = (event: Omit<EditProgressEvent, 'type' | 'source' | 'op' | 'phase'>): void => {
    onProgress({ type: 'progress', source: 'video_edit', op: spec.op, phase, ...event });
  };

  let lastEmitMs = 0;
  let completedEmitted = false;
  let fields: Record<string, string> = {};
  let lineBuffer = '';

  const heartbeat = setInterval(() => {
    emit({ status: 'heartbeat', elapsed_sec: round2((Date.now() - startedAtMs) / 1000) });
  }, spec.heartbeatMs ?? HEARTBEAT_MS);
  (heartbeat as { unref?: () => void }).unref?.();

  const emitRunning = (isEnd: boolean): void => {
    const now = Date.now();
    if (!isEnd && now - lastEmitMs < MIN_EMIT_MS) return;
    lastEmitMs = now;
    if (isEnd) completedEmitted = true;
    const processedSec = parseFfmpegProgressTimeSec(fields);
    emit({
      status: isEnd ? 'completed' : 'running',
      elapsed_sec: round2((now - startedAtMs) / 1000),
      ...(processedSec !== null ? { processed_sec: round2(processedSec) } : {}),
      ...(processedSec !== null && durationSec
        ? { percent: round2(clamp((processedSec / durationSec) * 100, 0, 100)) }
        : {}),
    });
  };

  const onStderr = (chunk: string): void => {
    lineBuffer += chunk.replace(/\r/g, '\n');
    const lines = lineBuffer.split('\n');
    lineBuffer = lines.pop() ?? '';
    for (const line of lines) {
      const m = line.trim().match(/^([A-Za-z0-9_]+)=(.*)$/);
      if (!m) continue;
      fields[m[1]] = m[2];
      if (m[1] === 'progress') {
        const isEnd = m[2] === 'end';
        emitRunning(isEnd);
        if (isEnd) fields = {};
      }
    }
  };

  try {
    const result = await run(bin, withFfmpegProgress(rawArgs), { ...runOpts, onStderr });
    const elapsed = round2((Date.now() - startedAtMs) / 1000);
    if (result.code === 0) {
      if (!completedEmitted) emit({ status: 'completed', elapsed_sec: elapsed });
    } else {
      emit({ status: signal?.aborted ? 'aborted' : 'failed', elapsed_sec: elapsed, code: result.code });
    }
    return result;
  } finally {
    clearInterval(heartbeat);
  }
}
