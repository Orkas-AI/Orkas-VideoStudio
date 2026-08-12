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
 *  share stream layout (e.g. trims of the same source); we re-encode for safety.
 *  Re-encoding does NOT fix a mixed set: the demuxer takes its canvas and time
 *  base from the FIRST input and reinterprets the rest against it, so the
 *  executor conforms mismatched inputs first (see `chooseConcatTarget`). */
export function buildConcatArgs(listFile: string, output: string): string[] {
  return ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, ...VIDEO_ENCODE, ...AUDIO_ENCODE, ...FASTSTART, output];
}

/** Width/height/frame-rate of one concat input's video stream. */
export interface ConcatInputSpec {
  width: number;
  height: number;
  fps: number;
}

/**
 * Decide the shared canvas + frame rate a concat set must be conformed onto.
 * Returns null when nothing needs conforming: the set is already uniform, or
 * any input's spec is unknown (a guard that cannot see must not rewrite a
 * legitimate join). The target is the largest canvas (rounded up to even, as
 * libx264 requires) at the highest rate — conforming upgrades a part and never
 * crops a designed frame.
 */
export function chooseConcatTarget(specs: Array<ConcatInputSpec | null>): ConcatInputSpec | null {
  if (!specs.length || specs.some((s) => s === null)) return null;
  const known = specs as ConcatInputSpec[];
  const first = known[0];
  const uniform = known.every((s) => s.width === first.width && s.height === first.height && s.fps === first.fps);
  if (uniform) return null;
  const even = (n: number) => n + (n % 2);
  return {
    width: even(Math.max(...known.map((s) => s.width))),
    height: even(Math.max(...known.map((s) => s.height))),
    fps: Math.max(...known.map((s) => s.fps)),
  };
}

/** Re-encode one input onto the shared canvas and frame rate, letterboxing
 *  rather than cropping so a designed frame keeps every pixel it composed. */
export function buildConformArgs(input: string, target: ConcatInputSpec, output: string): string[] {
  const filter = [
    `scale=${target.width}:${target.height}:force_original_aspect_ratio=decrease`,
    `pad=${target.width}:${target.height}:(ow-iw)/2:(oh-ih)/2`,
    'setsar=1',
    `fps=${target.fps}`,
  ].join(',');
  return ['-y', '-i', input, '-vf', filter, ...VIDEO_ENCODE, '-c:a', 'copy', ...FASTSTART, output];
}

/**
 * Message for a joined output whose duration does not match its parts, or null
 * when the join is sound (or either duration is unknown — fail open). A joined
 * timeline that does not match the material it was built from is corrupt
 * however it happened; saying so here costs one probe instead of a repair loop
 * discovered at the draft.
 */
export function concatDurationDriftError(expectedSec: number | null, actualSec: number): string | null {
  if (!expectedSec || !finiteNum(expectedSec) || expectedSec <= 0 || !finiteNum(actualSec) || actualSec <= 0) return null;
  const driftSec = Math.abs(actualSec - expectedSec);
  if (driftSec <= Math.max(0.5, expectedSec * 0.02)) return null;
  return (
    `concat produced a ${actualSec.toFixed(2)}s video from parts totalling ${expectedSec.toFixed(2)}s`
    + ` (off by ${driftSec.toFixed(2)}s). The output was written but does not match its material, so anything`
    + ` timed against the plan — narration, captions — will drift. Re-check the parts before using it.`
  );
}

/** Caption font family for `burnsubs`, chosen by the caption text's script.
 *
 * Left unset, libass resolves a default family per platform — on macOS that is
 * a Japanese-coverage font, which renders Simplified-only characters as tofu
 * boxes while shared-with-Japanese characters look fine, so nothing fails and
 * the video ships. libass does not fall back across families, so the ONE
 * family named here must cover the deliverable script. Kana wins over Han
 * because Japanese text contains both. Latin-only captions keep the platform
 * default. */
export function captionFontForText(text: string, platform: NodeJS.Platform): string {
  const hasKana = /[\u3040-\u30ff]/u.test(text);
  const hasHan = /[\u4e00-\u9fff]/u.test(text);
  if (hasKana) {
    if (platform === 'darwin') return 'Hiragino Sans';
    if (platform === 'win32') return 'Yu Gothic UI';
    return 'Noto Sans CJK JP';
  }
  if (hasHan) {
    if (platform === 'darwin') return 'PingFang SC';
    if (platform === 'win32') return 'Microsoft YaHei';
    return 'Noto Sans CJK SC';
  }
  return '';
}

export function buildBurnsubsArgs(input: string, srtPath: string, output: string, fontName?: string): string[] {
  // The subtitles filter takes a path; escape backslashes, colons and single quotes.
  const escaped = srtPath.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
  const style = fontName ? `:force_style='FontName=${fontName}'` : '';
  return ['-y', '-i', input, '-vf', `subtitles='${escaped}'${style}`, ...VIDEO_ENCODE, '-c:a', 'copy', ...FASTSTART, output];
}

/** Pixel formats that can carry transparency — the only overlays that can sit
 *  on a full frame without erasing it. */
const ALPHA_PIX_FMT_RE = /(yuva|argb|abgr|rgba|bgra|ya8|ya16|gbrap)/i;

export function pixFmtHasAlpha(pixFmt: string | null | undefined): boolean {
  return ALPHA_PIX_FMT_RE.test(String(pixFmt ?? ''));
}

/** Would `overlay` erase the base instead of compositing over it?
 *
 * True exactly when the overlay covers the whole base frame and its pixel
 * format carries no alpha — an opaque full-frame layer replaces every pixel.
 * Fail-open on missing probe data: a guard that cannot see must not block a
 * legitimate edit. Sub-frame opaque overlays (logo boxes, lower thirds) keep
 * working: they cover only the region they occupy, which is the intent. */
export function overlayWouldEraseBase(
  base: { width: number; height: number } | null,
  overlay: { width: number; height: number; hasAlpha: boolean } | null,
): boolean {
  if (!base || !overlay) return false;
  if (!(base.width > 0 && base.height > 0 && overlay.width > 0 && overlay.height > 0)) return false;
  return overlay.width >= base.width && overlay.height >= base.height && !overlay.hasAlpha;
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

/** The publish-loudness audio chain. The trailing aformat pins a KNOWN stereo
 *  layout: a mono input (every TTS-only mix is mono) otherwise dies in layout
 *  negotiation between aresample and the aac encoder — "Cannot select channel
 *  layout for the link between Parsed_aresample_1 and format_out_0_1". Stereo
 *  is the delivery standard and a mono→stereo upmix is lossless channel
 *  duplication. */
export function normalizeLoudnessAudioFilter(): string {
  return `loudnorm=I=${LOUDNORM.I}:TP=${LOUDNORM.TP}:LRA=${LOUDNORM.LRA},aresample=${MIX_OUTPUT_SR},aformat=channel_layouts=stereo`;
}

export function buildNormalizeLoudnessArgs(input: string, output: string): string[] {
  return [
    '-y', '-i', input,
    '-map', '0:v?', '-map', '0:a:0',
    '-c:v', 'copy',
    '-filter:a:0', normalizeLoudnessAudioFilter(),
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
  // loudnorm upsamples to 192 kHz internally, so resample back before the
  // encoder; the trailing aformat pins stereo — see normalizeLoudnessAudioFilter.
  parts.push(`[amixed]loudnorm=I=${LOUDNORM.I}:TP=${LOUDNORM.TP}:LRA=${LOUDNORM.LRA},aresample=${MIX_OUTPUT_SR},aformat=channel_layouts=stereo[outa]`);

  return { filter: parts.join(';'), maps: ['-map', '0:v', '-map', '[outa]'] };
}

export function buildMixArgs(plan: MixPlan): string[] {
  const { filter, maps } = buildMixFilter(plan);
  const inputs: string[] = ['-i', plan.base];
  for (const seg of plan.segments) inputs.push('-i', seg.path);
  return ['-y', ...inputs, '-filter_complex', filter, ...maps, '-c:v', 'copy', ...AUDIO_ENCODE, ...FASTSTART, plan.output];
}
