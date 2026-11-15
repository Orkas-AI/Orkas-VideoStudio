/** Each beat's loudness, RMS over ±50 ms, as a share of the loudest beat's. Pure. */
export function beatStrengths(samples: Float32Array, rate: number, times: number[]): number[] {
  const half = Math.round(0.05 * rate);
  const rms = times.map((t) => {
    const centre = Math.round(t * rate);
    let sum = 0;
    let n = 0;
    for (let i = Math.max(0, centre - half); i < Math.min(samples.length, centre + half); i += 1) { sum += samples[i] * samples[i]; n += 1; }
    return n ? Math.sqrt(sum / n) : 0;
  });
  const loudest = Math.max(0, ...rms);
  return rms.map((v) => (loudest > 0 ? Math.round((v / loudest) * 100) / 100 : 0));
}

/** Each cut's distance to the nearest beat, in seconds and in frames (cut minus beat). Pure. */
export function cutsAgainstBeats(cuts: number[], beats: number[], fps: number): Array<{ t: number; beat: number; offsetSec: number; offsetFrames: number }> {
  return cuts.map((t) => {
    let beat = beats[0];
    for (const b of beats) if (Math.abs(b - t) < Math.abs(beat - t)) beat = b;
    const offsetSec = Math.round((t - beat) * 1000) / 1000;
    return { t, beat, offsetSec, offsetFrames: Math.round(offsetSec * fps) };
  });
}

