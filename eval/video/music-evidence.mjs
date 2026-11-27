import { decodePcm } from './media.mjs';

const rate = 8000;
const windowSamples = rate * 2;
const maxWindows = 150;

const wrap = (index, length) => (index % length + length) % length;
const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const texture = samples => samples.map((sample, i) => sample - 2 * (samples[i - 1] ?? 0) + (samples[i - 2] ?? 0));

function leveledTexture(samples) {
    const detail = texture(samples);
    const block = rate / 50;
    for (let start = 0; start < detail.length; start += block) {
        const end = Math.min(start + block, detail.length);
        let energy = 0;
        for (let i = start; i < end; i += 1) energy += detail[i] ** 2;
        // Limit the influence of loud consonants without boosting near-silence.
        const scale = Math.max(0.0015, Math.sqrt(energy / (end - start)));
        for (let i = start; i < end; i += 1) detail[i] /= scale;
    }
    return detail;
}

function correlation(output, source, start, lag, stride) {
    let index = wrap(start + lag, source.length);
    let dot = 0, aa = 0, bb = 0;
    for (let i = 0; i < windowSamples; i += stride) {
        const a = output[start + i], b = source[index];
        dot += a * b;
        aa += a * a;
        bb += b * b;
        index += stride;
        if (index >= source.length) index -= source.length;
    }
    return aa > 0 && bb > 0 ? dot / Math.sqrt(aa * bb) : 0;
}

/** A bed mixed from the start can be masked by speech. Require coherent waveform
 *  and high-frequency texture at the same timing; tempo/chords alone are common
 *  to multiple fixtures. The normal audio alignment still handles arbitrary edits. */
export function mixedMusicSeconds(output, source) {
    const count = Math.min(maxWindows, Math.floor(output.length / windowSamples));
    if (count < 3 || source.length < windowSamples) return 0;
    const windows = Array.from({ length: count }, (_, index) => index * windowSamples);
    const pilot = Array.from({ length: Math.min(8, count) }, (_, i) =>
        windows[Math.round(i * (count - 1) / (Math.min(8, count) - 1))]);
    const findLag = (from, to, step, measure) => {
        let best = { lag: from, match: -Infinity };
        for (let lag = from; lag <= to; lag += step) {
            const match = measure(lag);
            if (match > best.match) best = { lag, match };
        }
        return best;
    };
    // Allow encoder delay and seek jitter without searching the entire song.
    const coarse = findLag(-400, 400, 2, lag => average(pilot.map(at => correlation(output, source, at, lag, 4))));
    if (coarse.match < 0.035) return 0;
    const mixedTexture = leveledTexture(output), suppliedTexture = texture(source);
    const measure = (at, lag) => correlation(mixedTexture, suppliedTexture, at, lag, 2);
    const detail = findLag(coarse.lag - 6, coarse.lag + 6, 1, lag => average(windows.map(at => measure(at, lag))));
    const controls = [-113, -61, -27, 31, 71, 127]
        .map(shift => average(windows.map(at => measure(at, detail.lag + shift))))
        .sort((a, b) => b - a);
    // One accidental off-time match can occur in speech. Compare against
    // the remaining strongest control and require several supporting windows.
    if (detail.match < 0.025 || detail.match < Math.max(0, controls[1]) + 0.01) return 0;
    const heard = windows.filter(at => correlation(output, source, at, coarse.lag, 2) >= 0.03
        && measure(at, detail.lag) >= 0.02);
    return heard.length >= 3 ? heard.length * windowSamples / rate : 0;
}

export async function measureMixedMusic(tools, file, supplied) {
    const [output, source] = await Promise.all([decodePcm(tools, file, rate), decodePcm(tools, supplied, rate)]);
    return mixedMusicSeconds(output.samples, source.samples);
}
