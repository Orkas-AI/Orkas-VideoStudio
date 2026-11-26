// Independent output measurements adapted from Orkas VideoStudio production evidence.ts and journey-evidence.ts.
import { decodePcm, probeMedia, runMedia } from './media.mjs';
export async function audibleSeconds(tools, file, thresholdDb = -45) {
    const probe = await probeMedia(tools, file);
    if (!probe.hasAudio)
        return { duration: probe.duration, audible: 0 };
    const pcm = await decodePcm(tools, file, 8000);
    const window = 400;
    const limit = 10 ** (thresholdDb / 20);
    let audible = 0;
    for (let start = 0; start + window <= pcm.samples.length; start += window) {
        let energy = 0;
        for (let index = start; index < start + window; index += 1)
            energy += pcm.samples[index] ** 2;
        if (Math.sqrt(energy / window) > limit)
            audible += window / pcm.rate;
    }
    return { duration: probe.duration, audible };
}
/** Where a pure tone at `hz` is present, from 40 ms Goertzel windows. */
export function toneIntervals(pcm, hz, threshold = 0.003, windowSeconds = 0.04) {
    const window = Math.round(windowSeconds * pcm.rate);
    const coefficient = 2 * Math.cos(2 * Math.PI * hz / pcm.rate);
    const present = [];
    for (let start = 0; start + window <= pcm.samples.length; start += window) {
        let s1 = 0;
        let s2 = 0;
        for (let index = start; index < start + window; index += 1) {
            const s0 = pcm.samples[index] + coefficient * s1 - s2;
            s2 = s1;
            s1 = s0;
        }
        const power = s1 * s1 + s2 * s2 - coefficient * s1 * s2;
        present.push(2 * Math.sqrt(Math.max(0, power)) / window > threshold);
    }
    return runsToSpans(present, windowSeconds, 0.2, 0.16);
}
function runsToSpans(flags, step, minLength, mergeGap) {
    const spans = [];
    let start = -1;
    flags.forEach((flag, index) => {
        if (flag && start < 0)
            start = index;
        if ((!flag || index === flags.length - 1) && start >= 0) {
            const end = flag ? index + 1 : index;
            spans.push({ start: start * step, end: end * step });
            start = -1;
        }
    });
    const merged = [];
    for (const span of spans) {
        const last = merged[merged.length - 1];
        if (last && span.start - last.end <= mergeGap)
            last.end = span.end;
        else
            merged.push({ ...span });
    }
    return merged.filter((span) => span.end - span.start >= minLength);
}
// Fingerprints: 16 log-spaced bands from 200 Hz to 3.8 kHz over 32 ms frames every 8 ms;
// bit b is the sign of the change in the energy difference between bands b and b+1.
const FP_RATE = 8000;
const FP_FRAME = 256;
const FP_HOP = 64;
const FP_BANDS = 16;
const HOP_SECONDS = FP_HOP / FP_RATE;
const POPCOUNT = (() => {
    const table = new Uint8Array(1 << 15);
    for (let value = 1; value < table.length; value += 1)
        table[value] = (value & 1) + table[value >> 1];
    return table;
})();
function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i += 1) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1)
            j ^= bit;
        j ^= bit;
        if (i < j) {
            [re[i], re[j]] = [re[j], re[i]];
            [im[i], im[j]] = [im[j], im[i]];
        }
    }
    for (let size = 2; size <= n; size <<= 1) {
        const angle = -2 * Math.PI / size;
        for (let start = 0; start < n; start += size) {
            for (let k = 0; k < size / 2; k += 1) {
                const wr = Math.cos(angle * k);
                const wi = Math.sin(angle * k);
                const a = start + k;
                const b = a + size / 2;
                const tr = re[b] * wr - im[b] * wi;
                const ti = re[b] * wi + im[b] * wr;
                re[b] = re[a] - tr;
                im[b] = im[a] - ti;
                re[a] += tr;
                im[a] += ti;
            }
        }
    }
}
function fingerprint(pcm) {
    if (pcm.rate !== FP_RATE)
        throw new Error('fingerprint expects 8 kHz');
    const frames = Math.max(0, Math.floor((pcm.samples.length - FP_FRAME) / FP_HOP) + 1);
    const edges = Array.from({ length: FP_BANDS + 1 }, (_v, index) => 200 * (3800 / 200) ** (index / FP_BANDS));
    const binOf = (hz) => Math.round(hz * FP_FRAME / FP_RATE);
    const window = Float64Array.from({ length: FP_FRAME }, (_v, index) => 0.5 - 0.5 * Math.cos(2 * Math.PI * index / FP_FRAME));
    const bands = new Float64Array(frames * FP_BANDS);
    const energyDb = new Float32Array(frames);
    const re = new Float64Array(FP_FRAME);
    const im = new Float64Array(FP_FRAME);
    for (let frame = 0; frame < frames; frame += 1) {
        let total = 0;
        for (let index = 0; index < FP_FRAME; index += 1) {
            const sample = pcm.samples[frame * FP_HOP + index];
            re[index] = sample * window[index];
            im[index] = 0;
            total += sample * sample;
        }
        energyDb[frame] = 10 * Math.log10(total / FP_FRAME + 1e-12);
        fft(re, im);
        for (let band = 0; band < FP_BANDS; band += 1) {
            let energy = 0;
            for (let bin = binOf(edges[band]); bin < Math.max(binOf(edges[band]) + 1, binOf(edges[band + 1])); bin += 1)
                energy += re[bin] ** 2 + im[bin] ** 2;
            bands[frame * FP_BANDS + band] = Math.log(energy + 1e-12);
        }
    }
    const bits = new Uint16Array(frames);
    for (let frame = 1; frame < frames; frame += 1) {
        let value = 0;
        for (let band = 0; band < FP_BANDS - 1; band += 1) {
            const now = bands[frame * FP_BANDS + band] - bands[frame * FP_BANDS + band + 1];
            const before = bands[(frame - 1) * FP_BANDS + band] - bands[(frame - 1) * FP_BANDS + band + 1];
            if (now - before > 0)
                value |= 1 << band;
        }
        bits[frame] = value;
    }
    return { bits, energyDb };
}
const BLOCK = 48;
const BLOCK_HOP = 8;
const WINDOW_SECONDS = 0.01;
/**
 * Which parts of `source` play in `output`, by sound alone. Coarse matches of 384 ms
 * fingerprint blocks give each stretch's offset; each stretch is then checked at
 * 10 ms with waveform correlation, so a clipped syllable shows as a missing window.
 */
export async function alignAudio(tools, outputFile, sourceFile) {
    const [output, source] = await Promise.all([decodePcm(tools, outputFile, FP_RATE), decodePcm(tools, sourceFile, FP_RATE)]);
    return alignPcm(output, source);
}
/** Fingerprint matches for each loud output block: up to four distinct source positions. */
function blockCandidates(out, src) {
    const total = BLOCK * (FP_BANDS - 1);
    const blocks = [];
    const errors = new Uint16Array(Math.max(0, src.bits.length - BLOCK));
    for (let start = 1; start + BLOCK <= out.bits.length; start += BLOCK_HOP) {
        let loud = 0;
        for (let index = start; index < start + BLOCK; index += 1)
            if (out.energyDb[index] > -45)
                loud += 1;
        if (loud < BLOCK / 3)
            continue;
        for (let candidate = 1; candidate + BLOCK <= src.bits.length; candidate += 1) {
            let count = 0;
            for (let index = 0; index < BLOCK; index += 1)
                count += POPCOUNT[out.bits[start + index] ^ src.bits[candidate + index]];
            errors[candidate] = count;
        }
        const options = [];
        const taken = [];
        for (let pick = 0; pick < 4; pick += 1) {
            let best = Infinity;
            let bestAt = -1;
            for (let candidate = 1; candidate + BLOCK <= src.bits.length; candidate += 1) {
                if (errors[candidate] < best && taken.every((at) => Math.abs(at - candidate) > BLOCK / 2)) {
                    best = errors[candidate];
                    bestAt = candidate;
                }
            }
            if (bestAt < 0 || best / total >= 0.3)
                break;
            taken.push(bestAt);
            options.push({ offsetFrames: bestAt - start, ber: best / total });
        }
        if (options.length)
            blocks.push({ frame: start, options });
    }
    return blocks;
}
/**
 * One offset per block, preferring continuity: a phrase spoken twice (a retake) matches
 * two places equally well, and its neighbours decide which one is playing.
 */
function chooseOffsets(blocks) {
    if (!blocks.length)
        return [];
    const SWITCH = 0.08;
    const costs = blocks.map((block) => block.options.map((option) => option.ber));
    const back = blocks.map((block) => block.options.map(() => -1));
    for (let index = 1; index < blocks.length; index += 1) {
        const contiguous = blocks[index].frame - blocks[index - 1].frame <= BLOCK_HOP * 3;
        blocks[index].options.forEach((option, current) => {
            let best = Infinity;
            let from = -1;
            blocks[index - 1].options.forEach((previous, prior) => {
                const same = contiguous && Math.abs(previous.offsetFrames - option.offsetFrames) <= 2;
                const cost = costs[index - 1][prior] + (same ? 0 : SWITCH);
                if (cost < best) {
                    best = cost;
                    from = prior;
                }
            });
            costs[index][current] = best + option.ber;
            back[index][current] = from;
        });
    }
    const chosen = [];
    let state = costs[blocks.length - 1].indexOf(Math.min(...costs[blocks.length - 1]));
    for (let index = blocks.length - 1; index >= 0; index -= 1) {
        chosen.unshift({ frame: blocks[index].frame, offsetFrames: blocks[index].options[state].offsetFrames });
        state = back[index][state];
    }
    return chosen;
}
/**
 * Fingerprints read the output at fixed 8 ms steps, so a stretch whose offset falls between
 * two steps barely matches: a track started on its first beat at 0.605 s aligned for 2.8 of
 * 14.4 s (2026-11-14). The output is read from four starting points a quarter step apart, and
 * the reading that hears the most is kept; one that already lands on a step is read first.
 */
export function alignPcm(output, source) {
    let best = null;
    let bestHeard = -1;
    for (const phase of [0, FP_HOP / 4, FP_HOP / 2, (3 * FP_HOP) / 4]) {
        const aligned = alignAtPhase({ rate: output.rate, samples: output.samples.subarray(phase) }, source);
        const shift = phase / FP_RATE;
        const segments = aligned.segments.map((segment) => ({ outStart: segment.outStart + shift, outEnd: segment.outEnd + shift, offset: segment.offset - shift }));
        const heard = segments.reduce((sum, segment) => sum + segment.outEnd - segment.outStart, 0);
        if (heard > bestHeard + 0.05) {
            best = { ...aligned, segments };
            bestHeard = heard;
        }
    }
    return best;
}
function alignAtPhase(output, source) {
    const out = fingerprint(output);
    const src = fingerprint(source);
    const matches = chooseOffsets(blockCandidates(out, src));
    // Consecutive blocks at one offset form a stretch.
    const coarse = [];
    for (const match of matches) {
        const last = coarse[coarse.length - 1];
        if (last && Math.abs(match.offsetFrames - last.offsetFrames) <= 2 && match.frame - last.last <= BLOCK_HOP * 3) {
            last.last = match.frame;
        }
        else {
            coarse.push({ first: match.frame, last: match.frame, offsetFrames: match.offsetFrames });
        }
    }
    const segments = [];
    const windowSamples = Math.round(WINDOW_SECONDS * FP_RATE);
    const sourceWindows = Math.floor(source.samples.length / windowSamples);
    const heard = new Uint8Array(sourceWindows);
    const sourceSpeech = new Uint8Array(sourceWindows);
    for (let window = 0; window < sourceWindows; window += 1) {
        let energy = 0;
        for (let index = window * windowSamples; index < (window + 1) * windowSamples; index += 1)
            energy += source.samples[index] ** 2;
        sourceSpeech[window] = Math.sqrt(energy / windowSamples) > 0.02 ? 1 : 0;
    }
    // A stretch needs three agreeing blocks: one or two can land on a phrase the source says twice.
    for (const stretch of coarse.filter((item) => item.last - item.first >= 2 * BLOCK_HOP)) {
        // Refine the offset to the sample, then test every 10 ms window around the stretch.
        const outFrom = Math.max(0, (stretch.first - BLOCK) * FP_HOP);
        const outTo = Math.min(output.samples.length, (stretch.last + 2 * BLOCK) * FP_HOP);
        const coarseOffset = stretch.offsetFrames * FP_HOP;
        let bestOffset = coarseOffset;
        let bestScore = -Infinity;
        for (let delta = -FP_HOP; delta <= FP_HOP; delta += 1) {
            const score = correlation(output.samples, source.samples, (stretch.first + BLOCK / 2) * FP_HOP, BLOCK * FP_HOP, coarseOffset + delta);
            if (score > bestScore) {
                bestScore = score;
                bestOffset = coarseOffset + delta;
            }
        }
        let runStart = -1;
        const flush = (endSample) => {
            if (runStart >= 0 && endSample - runStart >= windowSamples * 5) {
                segments.push({ outStart: runStart / FP_RATE, outEnd: endSample / FP_RATE, offset: bestOffset / FP_RATE });
            }
            runStart = -1;
        };
        for (let at = outFrom; at + windowSamples <= outTo; at += windowSamples) {
            const sourceAt = at + bestOffset;
            if (sourceAt < 0 || sourceAt + windowSamples > source.samples.length) {
                flush(at);
                continue;
            }
            const sourceWindow = Math.floor(sourceAt / windowSamples);
            const quiet = rms(source.samples, sourceAt, windowSamples) < 0.02;
            const matched = !quiet && correlation(output.samples, source.samples, at, windowSamples, bestOffset) > 0.5;
            if (matched) {
                heard[sourceWindow] = 1;
                if (runStart < 0)
                    runStart = at;
            }
            else if (!quiet) {
                flush(at);
            }
        }
        flush(outTo);
    }
    return { segments: mergeSegments(segments), heard, sourceSpeech };
}
function mergeSegments(segments) {
    const sorted = [...segments].sort((a, b) => a.outStart - b.outStart);
    const merged = [];
    for (const segment of sorted) {
        const last = merged[merged.length - 1];
        if (last && Math.abs(last.offset - segment.offset) < 0.004 && segment.outStart - last.outEnd < 0.6)
            last.outEnd = Math.max(last.outEnd, segment.outEnd);
        else
            merged.push({ ...segment });
    }
    return merged;
}
function rms(samples, start, length) {
    let energy = 0;
    for (let index = start; index < start + length; index += 1)
        energy += samples[index] ** 2;
    return Math.sqrt(energy / length);
}
function correlation(output, source, start, length, offset) {
    let dot = 0;
    let outEnergy = 0;
    let srcEnergy = 0;
    for (let index = start; index < start + length; index += 1) {
        const sourceIndex = index + offset;
        if (index < 0 || index >= output.length || sourceIndex < 0 || sourceIndex >= source.length)
            return 0;
        dot += output[index] * source[sourceIndex];
        outEnergy += output[index] ** 2;
        srcEnergy += source[sourceIndex] ** 2;
    }
    return outEnergy && srcEnergy ? dot / Math.sqrt(outEnergy * srcEnergy) : 0;
}
/** Share of a source span's spoken 10 ms windows that the output plays. */
export function coverage(alignment, span) {
    const first = Math.floor(span.start / WINDOW_SECONDS);
    const last = Math.min(alignment.heard.length, Math.ceil(span.end / WINDOW_SECONDS));
    let speech = 0;
    let heard = 0;
    for (let window = first; window < last; window += 1) {
        if (!alignment.sourceSpeech[window])
            continue;
        speech += 1;
        if (alignment.heard[window])
            heard += 1;
    }
    return speech ? heard / speech : 0;
}
/** Source time ranges the output plays, in output order. */
export function sourceRanges(alignment) {
    return alignment.segments.map((segment) => ({
        outStart: segment.outStart, outEnd: segment.outEnd,
        start: segment.outStart + segment.offset, end: segment.outEnd + segment.offset,
    }));
}
export const HOP = HOP_SECONDS;
async function grayFrames(tools, file, width, sampledFps) {
    const probe = await probeMedia(tools, file);
    if (!probe.width || !probe.height)
        throw new Error('No video stream');
    const height = Math.max(2, Math.round(probe.height / probe.width * width / 2) * 2);
    // Auto sync invents frames across timestamp gaps, inflating the scan's duration
    // and pushing endpoint samples beyond the final picture. Keep native frames.
    const raw = await runMedia(tools.ffmpeg, ['-v', 'error', '-nostdin', '-i', file, '-map', '0:v:0', '-vf',
        `${sampledFps ? `fps=${sampledFps},` : ''}scale=${width}:${height}:flags=area,format=gray`,
        ...(sampledFps ? ['-t', '31'] : []), '-vsync', '0', '-f', 'rawvideo', 'pipe:1'], undefined, 600_000);
    const size = width * height;
    const frames = [];
    for (let offset = 0; offset + size <= raw.length; offset += size)
        frames.push(new Uint8Array(raw.subarray(offset, offset + size)));
    return { width, height, fps: sampledFps ?? probe.fps ?? 25, frames };
}
export async function detectCuts(tools, file) {
    const { width, height, fps, frames } = await grayFrames(tools, file, 64);
    const size = width * height;
    const diffs = frames.map((frame, index) => {
        if (!index)
            return 0;
        const previous = frames[index - 1];
        let total = 0;
        for (let pixel = 0; pixel < size; pixel += 1)
            total += Math.abs(frame[pixel] - previous[pixel]);
        return total / size;
    });
    return { fps, cuts: cutsFromDiffs(diffs, fps), frames: frames.length };
}
export async function shotMotion(tools, file, cuts) {
    const { fps, frames, width, height } = await grayFrames(tools, file, 96);
    const size = width * height;
    const duration = frames.length / fps;
    const bounds = [0, ...cuts, duration];
    const shots = [];
    for (let index = 0; index + 1 < bounds.length; index += 1) {
        const first = Math.ceil(bounds[index] * fps) + 2;
        const last = Math.floor(bounds[index + 1] * fps) - 2;
        if (last - first < 4) continue;
        let total = 0;
        for (let frame = first + 1; frame <= last; frame += 1) {
            let diff = 0;
            for (let pixel = 0; pixel < size; pixel += 1) diff += Math.abs(frames[frame][pixel] - frames[frame - 1][pixel]);
            total += diff / size;
        }
        shots.push({ start: bounds[index], end: bounds[index + 1], motion: Number((total / (last - first)).toFixed(3)) });
    }
    return shots;
}
function cutsFromDiffs(diffs, fps) {
    const cuts = [];
    for (let index = 1; index < diffs.length; index += 1) {
        const neighbours = [diffs[index - 2] ?? 0, diffs[index - 1] ?? 0, diffs[index + 1] ?? 0, diffs[index + 2] ?? 0];
        if (diffs[index] > 18 && diffs[index] > 3 * Math.max(...neighbours, 2))
            cuts.push(index / fps);
    }
    return cuts;
}
/** Compare unchanged picture intervals at 4 fps. Timing/shape are checked separately;
 * small codec noise is tolerated, while a reordered/replaced scene produces a large error. */
export async function pictureDifference(tools, first, second, start, end) {
    if (start < 0 || end <= start || end > 180)
        throw new Error('Invalid bounded comparison interval');
    const read = (file) => runMedia(tools.ffmpeg, ['-v', 'error', '-nostdin', '-ss', String(start), '-i', file,
        '-t', String(end - start), '-vf', 'fps=4,scale=96:96', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1']);
    const [a, b] = await Promise.all([read(first), read(second)]);
    if (!a.length || a.length !== b.length || a.length / (96 * 96 * 3) < Math.floor((end - start) * 4) - 1)
        return null;
    let sum = 0;
    let frameSum = 0;
    let max = 0;
    for (let i = 0; i < a.length; i += 1) {
        const delta = Math.abs(a[i] - b[i]);
        sum += delta;
        frameSum += delta;
        if ((i + 1) % (96 * 96 * 3) === 0) {
            max = Math.max(max, frameSum / (96 * 96 * 3));
            frameSum = 0;
        }
    }
    return { mean: sum / a.length, max };
}
export async function unchangedAudio(tools, first, second, start, end) {
    const alignment = await alignAudio(tools, second, first);
    const displaced = alignment.segments.filter(s => s.outEnd > start && s.outStart < end && Math.abs(s.offset) > 0.03);
    return displaced.length === 0 && coverage(alignment, { start, end }) >= 0.9;
}
