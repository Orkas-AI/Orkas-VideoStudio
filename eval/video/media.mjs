// Portable FFmpeg and synthetic speech fixtures adapted from Orkas VideoStudio production media.ts.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { resolveFfmpegTools } from '../../packages/core/dist/index.js';
const exec = promisify(execFile);
export const mediaTools = resolveFfmpegTools;
export async function runMedia(bin, args, _input, timeoutMs = 180_000) {
    const { stdout, stderr } = await exec(bin, args, { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024, timeout: timeoutMs, windowsHide: true });
    if (stderr.length)
        throw new Error(path.basename(bin) + ' produced ' + stderr.length + ' diagnostic bytes');
    return stdout;
}
export async function probeMedia(tools, file) {
    const raw = await runMedia(tools.ffprobe, ['-v', 'error', '-show_entries',
        'format=duration:stream=codec_type,width,height,avg_frame_rate,duration', '-of', 'json', file], undefined, 30_000);
    const parsed = JSON.parse(raw.toString('utf8'));
    const streams = parsed.streams ?? [];
    const video = streams.find((stream) => stream.codec_type === 'video');
    const audio = streams.find((stream) => stream.codec_type === 'audio');
    const [num, den] = String(video?.avg_frame_rate ?? '0/1').split('/').map(Number);
    return {
        duration: Number(parsed.format?.duration),
        ...(Number(video?.duration) > 0 && Number.isFinite(Number(video.duration)) ? { videoDuration: Number(video.duration) } : {}),
        ...(Number.isFinite(Number(audio?.duration)) ? { audioDuration: Number(audio.duration) } : {}),
        ...(video ? { width: Number(video.width), height: Number(video.height) } : {}),
        ...(num && den ? { fps: num / den } : {}),
        hasAudio: !!audio,
        hasVideo: !!video,
    };
}
/** The first audio stream as mono PCM; a file with no audio stream reads as silence of length 0.
 *  Raw PCM has no timestamps: derive them from consumed samples so overlapping packet
 *  timestamps at concat seams do not reach the output muxer. Decode errors stay strict;
 *  an apparently complete duration does not qualify an unknown diagnostic. */
export async function decodePcm(tools, file, rate) {
    const probe = await probeMedia(tools, file);
    if (!probe.hasAudio)
        return { rate, samples: new Float32Array(0) };
    const raw = await runMedia(tools.ffmpeg, ['-v', 'error', '-nostdin', '-i', file, '-map', '0:a:0', '-ac', '1',
        '-ar', String(rate), '-af', 'asetpts=N/SR/TB', '-f', 's16le', 'pipe:1']);
    const samples = new Float32Array(raw.length >> 1);
    for (let index = 0; index < samples.length; index += 1)
        samples[index] = raw.readInt16LE(index * 2) / 32768;
    return { rate, samples };
}
export function wavBytes(pcm) {
    const data = Buffer.alloc(pcm.samples.length * 2);
    for (let index = 0; index < pcm.samples.length; index += 1) {
        const value = Math.max(-1, Math.min(1, pcm.samples[index]));
        data.writeInt16LE(Math.round(value * 32767), index * 2);
    }
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + data.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(pcm.rate, 24);
    header.writeUInt32LE(pcm.rate * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(data.length, 40);
    return Buffer.concat([header, data]);
}
/** 16-bit PCM WAV, mono or the first channel of several. */
export function readWav(bytes) {
    if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE')
        throw new Error('Not a WAV file');
    let offset = 12;
    let rate = 0;
    let channels = 1;
    let bits = 16;
    while (offset + 8 <= bytes.length) {
        const id = bytes.toString('ascii', offset, offset + 4);
        const size = bytes.readUInt32LE(offset + 4);
        const body = offset + 8;
        if (id === 'fmt ') {
            channels = bytes.readUInt16LE(body + 2);
            rate = bytes.readUInt32LE(body + 4);
            bits = bytes.readUInt16LE(body + 14);
        }
        else if (id === 'data') {
            if (bits !== 16 || !rate)
                throw new Error('Only 16-bit PCM WAV is supported');
            const frames = Math.floor(Math.min(size, bytes.length - body) / (2 * channels));
            const samples = new Float32Array(frames);
            for (let frame = 0; frame < frames; frame += 1)
                samples[frame] = bytes.readInt16LE(body + frame * 2 * channels) / 32768;
            return { rate, samples };
        }
        offset = body + size + (size & 1);
    }
    throw new Error('WAV has no data');
}
/** Deterministic noise, so a fixture is the same every time it is made. */
export function prng(seed) {
    let state = seed >>> 0 || 1;
    return () => {
        state ^= state << 13;
        state >>>= 0;
        state ^= state >>> 17;
        state ^= state << 5;
        state >>>= 0;
        return state / 0x100000000;
    };
}
export function speechAvailable() {
    return process.platform === 'darwin' && fs.existsSync('/usr/bin/say');
}
/** One line spoken by a macOS voice, with the silence `say` leaves at either end removed.
 *  `wordsPerMinute` changes the delivery, as a person's second take sounds different. */
export async function speak(text, voice, rate = 22050, wordsPerMinute) {
    if (!speechAvailable())
        throw new Error('macOS speech is not available on this host');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orkas-vs-say-'));
    try {
        const out = path.join(dir, 'line.wav');
        await new Promise((resolve, reject) => {
            execFile('/usr/bin/say', ['-v', voice, ...(wordsPerMinute ? ['-r', String(wordsPerMinute)] : []), '--file-format=WAVE', `--data-format=LEI16@${rate}`, '-o', out, text], { timeout: 60_000 }, (error) => (error ? reject(new Error(`say failed for voice ${voice}`)) : resolve()));
        });
        return trimSilence(readWav(fs.readFileSync(out)));
    }
    finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}
/** Remove leading and trailing stretches quieter than about -42 dBFS. */
export function trimSilence(pcm, threshold = 0.008) {
    let start = 0;
    let end = pcm.samples.length;
    while (start < end && Math.abs(pcm.samples[start]) < threshold)
        start += 1;
    while (end > start && Math.abs(pcm.samples[end - 1]) < threshold)
        end -= 1;
    return { rate: pcm.rate, samples: pcm.samples.slice(start, end) };
}
/** Lay pieces end to end over a quiet room tone, returning where each spoken piece sits. */
export function assemble(rate, pieces, seed = 7, floor = 0.0025) {
    const lengths = pieces.map((piece) => ('pause' in piece ? Math.round(piece.pause * rate) : piece.pcm.samples.length));
    const samples = new Float32Array(lengths.reduce((sum, value) => sum + value, 0));
    const random = prng(seed);
    for (let index = 0; index < samples.length; index += 1)
        samples[index] = (random() * 2 - 1) * floor;
    const spans = [];
    let cursor = 0;
    pieces.forEach((piece, index) => {
        if ('pcm' in piece) {
            if (piece.pcm.rate !== rate)
                throw new Error('assemble expects one sample rate');
            for (let sample = 0; sample < piece.pcm.samples.length; sample += 1)
                samples[cursor + sample] += piece.pcm.samples[sample];
            spans.push({ start: cursor / rate, end: (cursor + piece.pcm.samples.length) / rate });
        }
        cursor += lengths[index];
    });
    return { pcm: { rate, samples }, spans };
}
export function resample(pcm, rate) {
    if (pcm.rate === rate)
        return pcm;
    const length = Math.round(pcm.samples.length * rate / pcm.rate);
    const samples = new Float32Array(length);
    for (let index = 0; index < length; index += 1) {
        const position = index * pcm.rate / rate;
        const left = Math.floor(position);
        const right = Math.min(left + 1, pcm.samples.length - 1);
        const weight = position - left;
        samples[index] = pcm.samples[left] * (1 - weight) + pcm.samples[right] * weight;
    }
    return { rate, samples };
}
export const round3 = value => Math.round(value * 1000) / 1000;
