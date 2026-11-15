import { VIDEO_RESOLUTION_HEIGHTS, type VideoParameterInput } from './video-parameters.js';
const OUTPUT_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];
export function videoOutputConversion(wanted: VideoParameterInput, native: VideoParameterInput): {
  filters: string[]; audioFilters: string[]; duration?: number; mute: boolean; ratio?: string; resolution?: string;
} {
  const duration = typeof wanted.duration === 'number' && Number.isFinite(wanted.duration)
    && wanted.duration > 0 && (native.duration === undefined || native.duration === -1 || wanted.duration < native.duration)
    ? wanted.duration : undefined;
  const mute = wanted.generateAudio === false && native.generateAudio !== false;
  const resize = !!wanted.resolution && !!VIDEO_RESOLUTION_HEIGHTS[wanted.resolution.toLowerCase()]
    && wanted.resolution.toLowerCase() !== native.resolution;
  const reshape = !!wanted.ratio && OUTPUT_RATIOS.includes(wanted.ratio) && wanted.ratio !== native.ratio;
  const filters: string[] = [];
  const audioFilters: string[] = [];
  if (duration && native.duration && native.duration > duration && (wanted.lastFrameUrl || wanted.lastFramePath)) {
    // A tail frame is an explicit visual requirement. Preserve both ends rather
    // than trimming the requested ending out of a minimum-duration generation.
    filters.push(`setpts=${duration / native.duration}*(PTS-STARTPTS)`);
    if (!mute) {
      let speed = native.duration / Math.max(duration, 1 / 60);
      for (let part = 0; part < 16 && speed > 2; part++, speed /= 2) audioFilters.push('atempo=2');
      audioFilters.push(`atempo=${speed}`);
    }
  }
  if (resize || reshape) {
    const ratio = OUTPUT_RATIOS.includes(wanted.ratio || '') ? wanted.ratio!
      : OUTPUT_RATIOS.includes(native.ratio || '') ? native.ratio! : undefined;
    const short = VIDEO_RESOLUTION_HEIGHTS[(wanted.resolution || native.resolution || '').toLowerCase()];
    if (ratio && short) {
      const [x, y] = ratio.split(':').map(Number);
      const even = (value: number) => Math.max(2, Math.round(value / 2) * 2);
      const width = even(x >= y ? short * x / y : short);
      const height = even(x >= y ? short : short * y / x);
      // Fit and pad rather than crop: product details and reference compositions survive.
      filters.push(`scale=${width}:${height}:force_original_aspect_ratio=decrease:force_divisible_by=2`,
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`, 'setsar=1');
    } else if (short) {
      // Adaptive input keeps its measured shape; resize only its shorter side.
      filters.push(`scale=w='if(gte(iw,ih),-2,${short})':h='if(gte(iw,ih),${short},-2)'`, 'setsar=1');
    }
  }
  return { filters, audioFilters, mute, ...(duration ? { duration } : {}),
    ...(reshape ? { ratio: wanted.ratio } : {}), ...(resize ? { resolution: wanted.resolution!.toLowerCase() } : {}) };
}
