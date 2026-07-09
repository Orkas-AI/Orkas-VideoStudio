/**
 * Pure ffmpeg/ffprobe argument builders for the edit operations. Kept free of IO
 * and of any process spawning so they can be unit-tested directly. The executor
 * layer (`edit.ts`) resolves binaries and runs these.
 *
 * Encoding defaults: re-encode to H.264 + AAC at 48 kHz so heterogeneous inputs
 * concatenate/mix cleanly and outputs are broadly playable. `+faststart` moves
 * the moov atom for web playback. Loudness target is −14 LUFS / −1 dBTP, the
 * common social/web delivery floor.
 */

export const MIX_OUTPUT_SR = 48_000;
export const LOUDNORM = { I: -14, TP: -1, LRA: 11 } as const;

const VIDEO_ENCODE = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p'];
const AUDIO_ENCODE = ['-c:a', 'aac', '-ar', String(MIX_OUTPUT_SR)];
const FASTSTART = ['-movflags', '+faststart'];

/** A finite, non-NaN number guard — rejects NaN/Infinity that would poison ffmpeg args. */
export function finiteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Format seconds for an ffmpeg time arg (plain seconds, clamped to >= 0). */
export function secArg(sec: number): string {
  const n = finiteNum(sec) ? Math.max(0, sec) : 0;
  return n.toFixed(3);
}

export function buildProbeArgs(input: string): string[] {
  return ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', input];
}

export interface TrimParams {
  input: string;
  start_sec: number;
  /** Either duration_sec or end_sec; duration wins if both are given. */
  duration_sec?: number;
  end_sec?: number;
  output: string;
}

export function buildTrimArgs(p: TrimParams): string[] {
  if (!finiteNum(p.start_sec) || p.start_sec < 0) throw new Error('trim: start_sec must be a finite number >= 0');
  let dur = p.duration_sec;
  if (!finiteNum(dur)) {
    if (finiteNum(p.end_sec)) dur = p.end_sec - p.start_sec;
  }
  if (!finiteNum(dur) || dur <= 0) throw new Error('trim: need a positive duration_sec or an end_sec greater than start_sec');
  // -ss/-t as OUTPUT options (after -i) for frame-accurate seeking with re-encode.
  return ['-y', '-i', p.input, '-ss', secArg(p.start_sec), '-t', secArg(dur), ...VIDEO_ENCODE, ...AUDIO_ENCODE, ...FASTSTART, p.output];
}

/** Concat via the demuxer + a list file (built by the executor). Inputs should
 *  share stream layout (e.g. trims of the same source); we re-encode for safety. */
export function buildConcatArgs(listFile: string, output: string): string[] {
  return ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, ...VIDEO_ENCODE, ...AUDIO_ENCODE, ...FASTSTART, output];
}

export function buildBurnsubsArgs(input: string, srtPath: string, output: string): string[] {
  // The subtitles filter takes a path; escape backslashes, colons and single quotes.
  const escaped = srtPath.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
  return ['-y', '-i', input, '-vf', `subtitles='${escaped}'`, ...VIDEO_ENCODE, '-c:a', 'copy', ...FASTSTART, output];
}

export function buildOverlayArgs(base: string, overlay: string, x: number, y: number, output: string): string[] {
  const ix = finiteNum(x) ? Math.round(x) : 0;
  const iy = finiteNum(y) ? Math.round(y) : 0;
  return ['-y', '-i', base, '-i', overlay, '-filter_complex', `overlay=${ix}:${iy}`, ...VIDEO_ENCODE, '-c:a', 'copy', ...FASTSTART, output];
}

export function buildExtractFrameArgs(input: string, atSec: number, output: string): string[] {
  return ['-y', '-i', input, '-ss', secArg(atSec), '-frames:v', '1', '-q:v', '2', output];
}

export function buildLoudnessArgs(input: string): string[] {
  // First-pass measurement: loudnorm prints a JSON block on stderr; -f null discards video.
  return ['-i', input, '-af', `loudnorm=I=${LOUDNORM.I}:TP=${LOUDNORM.TP}:LRA=${LOUDNORM.LRA}:print_format=json`, '-f', 'null', '-'];
}

export function buildNormalizeLoudnessArgs(input: string, output: string): string[] {
  return [
    '-y', '-i', input,
    '-map', '0:v?', '-map', '0:a:0',
    '-c:v', 'copy',
    '-filter:a:0', `loudnorm=I=${LOUDNORM.I}:TP=${LOUDNORM.TP}:LRA=${LOUDNORM.LRA},aresample=${MIX_OUTPUT_SR}`,
    '-c:a', 'aac', '-ar', String(MIX_OUTPUT_SR),
    ...FASTSTART,
    output,
  ];
}

export type OnExistingAudio = 'reject' | 'mix' | 'replace';

export interface AudioSegment {
  path: string;
  start_sec: number;
  volume?: number;
}

export interface MixPlan {
  base: string;
  baseHasAudio: boolean;
  segments: AudioSegment[];
  on_existing_audio: OnExistingAudio;
  output: string;
}

/**
 * Build the filter_complex string + map args for a mix. Each audio segment is
 * delayed to its start, volume-adjusted, then amix'd (optionally with the base
 * audio when policy is `mix`), and the result is loudness-normalized. Pure: the
 * executor probes the base for `baseHasAudio` and enforces the `reject` policy.
 */
export function buildMixFilter(plan: MixPlan): { filter: string; maps: string[] } {
  if (plan.on_existing_audio === 'reject' && plan.baseHasAudio) {
    throw new Error('mix: base already has audio and on_existing_audio="reject"; choose "mix" (keep under) or "replace" (drop it)');
  }
  if (!plan.segments.length) throw new Error('mix: at least one audio segment is required');

  const parts: string[] = [];
  const labels: string[] = [];
  plan.segments.forEach((seg, i) => {
    if (!finiteNum(seg.start_sec) || seg.start_sec < 0) throw new Error(`mix: segment[${i}].start_sec must be a finite number >= 0`);
    const ms = Math.round(seg.start_sec * 1000);
    const vol = finiteNum(seg.volume) ? seg.volume : 1;
    // input index is i+1 because input 0 is the base video.
    parts.push(`[${i + 1}:a]adelay=${ms}:all=1,volume=${vol}[a${i}]`);
    labels.push(`[a${i}]`);
  });

  const keepBase = plan.on_existing_audio === 'mix' && plan.baseHasAudio;
  if (keepBase) labels.unshift('[0:a]');

  const amixInputs = labels.length;
  parts.push(`${labels.join('')}amix=inputs=${amixInputs}:normalize=0[amixed]`);
  parts.push(`[amixed]loudnorm=I=${LOUDNORM.I}:TP=${LOUDNORM.TP}:LRA=${LOUDNORM.LRA}[outa]`);

  return { filter: parts.join(';'), maps: ['-map', '0:v', '-map', '[outa]'] };
}

export function buildMixArgs(plan: MixPlan): string[] {
  const { filter, maps } = buildMixFilter(plan);
  const inputs: string[] = ['-i', plan.base];
  for (const seg of plan.segments) inputs.push('-i', seg.path);
  return ['-y', ...inputs, '-filter_complex', filter, ...maps, '-c:v', 'copy', ...AUDIO_ENCODE, ...FASTSTART, plan.output];
}
