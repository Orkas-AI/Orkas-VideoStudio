// Baseline synthetic fixtures adapted from Orkas VideoStudio production fixtures.ts.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { prng, round3, runMedia, wavBytes } from './media.mjs';
export const sharp = createRequire(new URL('../../packages/tools/package.json', import.meta.url))('sharp');
export const VOICE_FEMALE = 'Tingting';
export const SPEECH_RATE = 22050;
export const FONT = 'PingFang SC, Hiragino Sans GB, Heiti SC, sans-serif';
export const roundSpan = ({ start, end }) => ({ start: round3(start), end: round3(end) });
export const svg = (width, height, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`);
export const escapeXml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export async function png(file, image) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await sharp(image).png().toFile(file);
    return file;
}
export function writeWav(file, pcm) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, wavBytes(pcm));
    return file;
}
export function figure(cx, top, size, shirt, hair) {
    return `
    <rect x="${cx - size * 0.55}" y="${top + size * 1.05}" width="${size * 1.1}" height="${size * 1.6}" rx="${size * 0.3}" fill="${shirt}"/>
    <circle cx="${cx}" cy="${top + size * 0.55}" r="${size * 0.5}" fill="#f1c7a3"/>
    <path d="M ${cx - size * 0.52} ${top + size * 0.5} Q ${cx} ${top - size * 0.15} ${cx + size * 0.52} ${top + size * 0.5} L ${cx + size * 0.5} ${top + size * 0.32} Q ${cx} ${top + size * 0.05} ${cx - size * 0.5} ${top + size * 0.32} Z" fill="${hair}"/>
    <circle cx="${cx - size * 0.17}" cy="${top + size * 0.5}" r="${size * 0.05}" fill="#2a2a2a"/>
    <circle cx="${cx + size * 0.17}" cy="${top + size * 0.5}" r="${size * 0.05}" fill="#2a2a2a"/>`;
}
/** Where `figure` draws the mouth, for the speaking overlay. */
export function mouthRect(cx, top, size) {
    const w = Math.round(size * 0.36 / 2) * 2;
    const h = Math.round(size * 0.12 / 2) * 2;
    return { x: Math.round(cx - w / 2), y: Math.round(top + size * 0.72), w, h };
}
const between = (spans) => spans.map((span) => `between(t,${round3(span.start)},${round3(span.end)})`).join('+') || '0';
export const TIMECODE_BLOCKS = 16;
export async function buildVideo(tools, spec, out) {
    const args = ['-v', 'error', '-nostdin', '-y'];
    const filters = [];
    let index = 0;
    for (const background of spec.backgrounds) {
        args.push('-loop', '1', '-framerate', String(spec.fps), '-t', String(round3(background.seconds)), '-i', background.file);
        filters.push(`[${index}:v]scale=${spec.width}:${spec.height},setsar=1,format=yuv420p[bg${index}]`);
        index += 1;
    }
    filters.push(`${spec.backgrounds.map((_item, i) => `[bg${i}]`).join('')}concat=n=${spec.backgrounds.length}:v=1:a=0[base0]`);
    let current = 'base0';
    let step = 0;
    for (const overlay of spec.overlays ?? []) {
        args.push('-loop', '1', '-framerate', String(spec.fps), '-t', String(spec.duration), '-i', overlay.file);
        const next = `ov${step}`;
        filters.push(`[${current}][${index}:v]overlay=${overlay.x}:${overlay.y}:enable='${between(overlay.spans)}'[${next}]`);
        current = next;
        index += 1;
        step += 1;
    }
    for (const [mouthIndex, mouth] of (spec.mouths ?? []).entries()) {
        args.push('-f', 'lavfi', '-i', `nullsrc=s=${mouth.rect.w}x${mouth.rect.h}:r=${spec.fps}:d=${spec.duration},geq=lum='random(1)*200':cb=128:cr=128,format=yuv420p`);
        const next = `mouth${mouthIndex}`;
        filters.push(`[${current}][${index}:v]overlay=${mouth.rect.x}:${mouth.rect.y}:enable='${between(mouth.spans)}'[${next}]`);
        current = next;
        index += 1;
    }
    if (spec.timecode) {
        const block = `floor(X/${Math.floor(spec.width / TIMECODE_BLOCKS)})`;
        const bit = `if(mod(floor((N+${spec.timecode.offset})/pow(2,${block}-2)),2),235,16)`;
        const lum = `if(gte(${block},16),16,if(eq(${block},0)+eq(${block},15),235,if(eq(${block},1)+eq(${block},14),16,${bit})))`;
        args.push('-f', 'lavfi', '-i', `color=c=black:s=${spec.width}x${spec.timecode.height}:r=${spec.fps}:d=${spec.duration},format=gray,geq=lum='${lum}',format=yuv420p`);
        filters.push(`[${current}][${index}:v]overlay=0:0[strip]`);
        current = 'strip';
        index += 1;
    }
    args.push('-i', spec.audio);
    const audioIndex = index;
    args.push('-filter_complex', filters.join(';'), '-map', `[${current}]`, '-map', `${audioIndex}:a`, '-t', String(round3(spec.duration)), '-r', String(spec.fps), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-g', String(spec.fps), '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-movflags', '+faststart', out);
    await runMedia(tools.ffmpeg, args, undefined, 600_000);
    return out;
}

export function synthMusic(seconds, bpm, seed) {
    const rate = 44100;
    const beatSeconds = 60 / bpm;
    const samples = new Float32Array(Math.round(rate * seconds));
    const random = prng(seed);
    const add = (start, length, fn) => {
        const first = Math.round(start * rate);
        for (let i = 0; i < Math.round(length * rate) && first + i < samples.length; i += 1)
            samples[first + i] += fn(i / rate);
    };
    const roots = [110, 87.31, 98, 73.42];
    const beats = [];
    for (let beat = 0; beat * beatSeconds < seconds - 0.05; beat += 1) {
        const time = beat * beatSeconds;
        beats.push(round3(time));
        const inBar = beat % 4;
        const accent = inBar === 0 ? 1 : 0.75;
        add(time, 0.3, (t) => accent * 0.55 * Math.sin(2 * Math.PI * (50 + 70 * Math.exp(-t * 30)) * t) * Math.exp(-t * 9));
        if (inBar === 1 || inBar === 3)
            add(time, 0.2, (t) => 0.28 * ((random() * 2 - 1) * 0.8 + Math.sin(2 * Math.PI * 190 * t) * 0.4) * Math.exp(-t * 18));
        if (inBar === 0 && beat % 16 === 0)
            add(time, 1.2, (t) => 0.12 * (random() * 2 - 1) * Math.exp(-t * 3));
        for (const half of [0, 0.5]) {
            let previous = 0;
            add(time + half * beatSeconds, 0.05, (t) => { const noise = random() * 2 - 1; const value = (noise - previous) * 0.09 * Math.exp(-t * 60); previous = noise; return value; });
        }
        if (inBar === 0) {
            const root = roots[(beat / 4) % roots.length];
            add(time, beatSeconds * 4, (t) => 0.18 * Math.sin(2 * Math.PI * root * t) * Math.min(1, t * 40) * Math.exp(-t * 0.6));
            for (const ratio of [2, 2.52, 3])
                add(time, beatSeconds * 4, (t) => 0.035 * Math.sin(2 * Math.PI * root * ratio * t) * Math.min(1, t * 8));
        }
    }
    let peak = 0;
    for (const value of samples)
        peak = Math.max(peak, Math.abs(value));
    for (let i = 0; i < samples.length; i += 1)
        samples[i] = samples[i] / peak * 0.8;
    return { pcm: { rate, samples }, beats };
}
/** Ten café pictures and a 128 BPM track whose beats are known by construction. */
