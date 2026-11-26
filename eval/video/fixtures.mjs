// Baseline synthetic fixtures adapted from Orkas VideoStudio production fixtures.ts.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { assemble, prng, round3, runMedia, speak, wavBytes } from './media.mjs';
const sharp = createRequire(new URL('../../packages/tools/package.json', import.meta.url))('sharp');
const VOICE_FEMALE = 'Tingting';
const SPEECH_RATE = 22050;
const FONT = 'PingFang SC, Hiragino Sans GB, Heiti SC, sans-serif';
const roundSpan = ({ start, end }) => ({ start: round3(start), end: round3(end) });
const svg = (width, height, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`);
const escapeXml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
async function png(file, image) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await sharp(image).png().toFile(file);
    return file;
}
function writeWav(file, pcm) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, wavBytes(pcm));
    return file;
}
function figure(cx, top, size, shirt, hair) {
    return `
    <rect x="${cx - size * 0.55}" y="${top + size * 1.05}" width="${size * 1.1}" height="${size * 1.6}" rx="${size * 0.3}" fill="${shirt}"/>
    <circle cx="${cx}" cy="${top + size * 0.55}" r="${size * 0.5}" fill="#f1c7a3"/>
    <path d="M ${cx - size * 0.52} ${top + size * 0.5} Q ${cx} ${top - size * 0.15} ${cx + size * 0.52} ${top + size * 0.5} L ${cx + size * 0.5} ${top + size * 0.32} Q ${cx} ${top + size * 0.05} ${cx - size * 0.5} ${top + size * 0.32} Z" fill="${hair}"/>
    <circle cx="${cx - size * 0.17}" cy="${top + size * 0.5}" r="${size * 0.05}" fill="#2a2a2a"/>
    <circle cx="${cx + size * 0.17}" cy="${top + size * 0.5}" r="${size * 0.05}" fill="#2a2a2a"/>`;
}
/** Where `figure` draws the mouth, for the speaking overlay. */
function mouthRect(cx, top, size) {
    const w = Math.round(size * 0.36 / 2) * 2;
    const h = Math.round(size * 0.12 / 2) * 2;
    return { x: Math.round(cx - w / 2), y: Math.round(top + size * 0.72), w, h };
}
const between = (spans) => spans.map((span) => `between(t,${round3(span.start)},${round3(span.end)})`).join('+') || '0';
async function buildVideo(tools, spec, out) {
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
    args.push('-i', spec.audio);
    const audioIndex = index;
    args.push('-filter_complex', filters.join(';'), '-map', `[${current}]`, '-map', `${audioIndex}:a`, '-t', String(round3(spec.duration)), '-r', String(spec.fps), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-g', String(spec.fps), '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-movflags', '+faststart', out);
    await runMedia(tools.ffmpeg, args, undefined, 600_000);
    return out;
}
async function seedRetakes(dir, tools) {
    const script = [
        { id: 'hello', text: '大家好，今天给大家介绍一款护眼台灯。', role: 'keep', pause: 0.8 },
        { id: 'soft-stumble', text: '它的光线非常柔', role: 'retake', pause: 0.9 },
        { id: 'soft', text: '它的光线非常柔和，看久了眼睛也不累。', role: 'keep', pause: 0.8 },
        { id: 'um', text: '嗯', role: 'filler', pause: 0.55 },
        { id: 'modes', text: '它有三档色温可以调。', role: 'keep', pause: 0.8 },
        { id: 'price-wrong', text: '现在只要一百九十八元。', role: 'wrong', pause: 0.5 },
        { id: 'correction', text: '不对，', role: 'wrong', pause: 0.6 },
        { id: 'price', text: '现在只要一百九十九元。', role: 'keep', pause: 0.8 },
        { id: 'link', text: '喜欢的话，点击下方链接就能买到。', role: 'keep', pause: 0.9 },
    ];
    // A take that is redone is said faster and unevenly, so it never sounds identical to the good one.
    const pieces = [{ pause: 0.6 }];
    for (const line of script)
        pieces.push({ pcm: await speak(line.text, VOICE_FEMALE, SPEECH_RATE, line.role === 'keep' ? undefined : 230) }, { pause: line.pause });
    const { pcm, spans } = assemble(SPEECH_RATE, pieces, 11);
    const audio = writeWav(path.join(dir, 'work', 'retakes.wav'), pcm);
    const duration = pcm.samples.length / SPEECH_RATE;
    const size = 300;
    const background = await png(path.join(dir, 'work', 'presenter.png'), svg(540, 960, `
    <rect width="540" height="960" fill="#dfe8ef"/><rect y="640" width="540" height="320" fill="#c7d3dc"/>${figure(270, 260, size, '#2f5d8a', '#3b2a20')}`));
    const lines = script.map((line, index) => ({ id: line.id, speaker: 'presenter', text: line.text, role: line.role, ...roundSpan(spans[index]) }));
    const file = await buildVideo(tools, {
        width: 540, height: 960, fps: 25, duration,
        backgrounds: [{ file: background, seconds: duration }],
        mouths: [{ rect: mouthRect(270, 260, size), spans: lines }],
        audio,
    }, path.join(dir, 'attachments', `台灯口播原片.mp4`));
    return { attachments: [file], truth: { kind: 'retakes', file, lines } };
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
async function seedMontage(dir) {
    const subjects = [
        { name: '门口', bg: '#2f4a3a', body: '<rect x="200" y="300" width="500" height="700" fill="#e9dcc4"/><rect x="380" y="620" width="140" height="380" fill="#5a3b25"/><rect x="230" y="330" width="440" height="120" fill="#7a2f2f"/><text x="450" y="410" text-anchor="middle" font-family="sans-serif" font-size="70" fill="#f6efe2">CAFE</text>' },
        { name: '拿铁', bg: '#c89b6d', body: '<ellipse cx="450" cy="760" rx="300" ry="90" fill="#f2efe9"/><path d="M 230 520 L 670 520 L 620 820 L 280 820 Z" fill="#f6f3ee"/><ellipse cx="450" cy="520" rx="220" ry="60" fill="#a8703f"/><path d="M 420 500 Q 450 450 480 500 Q 450 560 420 500" fill="#f3e4d0"/>' },
        { name: '豆子', bg: '#3a2418', body: Array.from({ length: 24 }, (_v, i) => `<ellipse cx="${150 + (i % 6) * 120}" cy="${300 + Math.floor(i / 6) * 160}" rx="48" ry="64" fill="#6b3d22" transform="rotate(${(i * 37) % 90} ${150 + (i % 6) * 120} ${300 + Math.floor(i / 6) * 160})"/>`).join('') },
        { name: '可颂', bg: '#e8c27a', body: '<path d="M 180 700 Q 450 380 720 700 Q 450 600 180 700" fill="#b8742f"/><path d="M 260 660 Q 450 470 640 660" stroke="#8a4f1c" stroke-width="18" fill="none"/>' },
        { name: '咖啡机', bg: '#9fb3c4', body: '<rect x="230" y="300" width="440" height="560" rx="30" fill="#c9ced3"/><rect x="300" y="380" width="300" height="160" fill="#2b3036"/><rect x="400" y="600" width="100" height="140" fill="#3a3f45"/><rect x="380" y="780" width="140" height="70" fill="#f2efe9"/>' },
        { name: '窗边', bg: '#f1e6d0', body: '<rect x="120" y="200" width="660" height="560" fill="#9cc7e6"/><rect x="440" y="200" width="20" height="560" fill="#ffffff"/><rect x="120" y="470" width="660" height="20" fill="#ffffff"/><rect x="100" y="860" width="700" height="60" fill="#8a5a3a"/><rect x="380" y="780" width="120" height="80" fill="#ffffff"/>' },
        { name: '菜单', bg: '#1f2d27', body: '<rect x="180" y="220" width="540" height="760" fill="#243a31" stroke="#d9c9a3" stroke-width="10"/>' + ['美式', '拿铁', '燕麦', '手冲'].map((item, i) => `<text x="450" y="${380 + i * 150}" text-anchor="middle" font-family="${FONT}" font-size="80" fill="#efe6cf">${item}</text>`).join('') },
        { name: '甜点', bg: '#f3c6cf', body: '<rect x="250" y="520" width="400" height="260" rx="20" fill="#ffffff"/><rect x="250" y="520" width="400" height="80" fill="#e7798f"/><circle cx="450" cy="480" r="50" fill="#c3203b"/>' },
        { name: '手冲', bg: '#5d6b4a', body: '<path d="M 330 300 L 570 300 L 480 520 L 420 520 Z" fill="#f2efe9"/><rect x="360" y="560" width="180" height="300" rx="30" fill="#d9e3e9" opacity="0.9"/><rect x="380" y="700" width="140" height="140" fill="#6b3d22"/>' },
        { name: '夜景', bg: '#16213a', body: '<rect x="200" y="420" width="500" height="560" fill="#2b3b5a"/><rect x="250" y="480" width="400" height="260" fill="#ffd27a"/><circle cx="700" cy="220" r="70" fill="#f6efe2"/>' },
    ];
    const photos = [];
    for (const [index, subject] of subjects.entries()) {
        photos.push(await png(path.join(dir, 'attachments', `咖啡店-${String(index + 1).padStart(2, '0')}-${subject.name}.png`), svg(900, 1200, `<rect width="900" height="1200" fill="${subject.bg}"/>${subject.body}`)));
    }
    const bpm = 128;
    const musicDuration = 24;
    const { pcm: track, beats } = synthMusic(musicDuration, bpm, 97);
    const rate = track.rate;
    const samples = track.samples;
    const music = writeWav(path.join(dir, 'attachments', '店里的背景音乐.wav'), { rate, samples });
    return {
        attachments: [...photos, music],
        truth: {
            kind: 'montage', music, photos, bpm, musicDuration,
            beats, bars: beats.filter((_beat, index) => index % 4 === 0),
        },
    };
}
function fittedSubtitle(width, text) {
    const size = Math.min(Math.round(width / 16), Math.floor((width - 40) / Math.max(1, [...text].length)));
    return svg(width, size * 2, `<text x="${width / 2}" y="${size * 1.35}" text-anchor="middle" font-family="${FONT}" font-size="${size}" fill="#ffffff" stroke="#000000" stroke-width="${Math.max(2, size / 12)}" paint-order="stroke">${escapeXml(text)}</text>`);
}
/** A clean Chinese talking-head clip with its lines burned in as captions, to be made English. */
async function seedDub(dir, tools) {
    const script = [
        { id: 'hello', text: '大家好，今天给大家介绍一款护眼台灯。', pause: 0.7 },
        { id: 'soft', text: '它的光线非常柔和，看久了眼睛也不累。', pause: 0.7 },
        { id: 'modes', text: '它有三档色温可以调。', pause: 0.7 },
        { id: 'price', text: '现在只要一百九十九元。', pause: 0.7 },
        { id: 'link', text: '喜欢的话，点击下方链接就能买到。', pause: 1.0 },
    ];
    const pieces = [{ pause: 0.6 }];
    for (const line of script)
        pieces.push({ pcm: await speak(line.text, VOICE_FEMALE, SPEECH_RATE) }, { pause: line.pause });
    const { pcm, spans } = assemble(SPEECH_RATE, pieces, 13);
    const audio = writeWav(path.join(dir, 'work', 'dub-source.wav'), pcm);
    const duration = pcm.samples.length / SPEECH_RATE;
    const size = 300;
    const background = await png(path.join(dir, 'work', 'dub-presenter.png'), svg(540, 960, `
    <rect width="540" height="960" fill="#e8e2d8"/><rect y="640" width="540" height="320" fill="#cdbfae"/>${figure(270, 260, size, '#8a3f2f', '#2b2018')}`));
    const lines = script.map((line, index) => ({ id: line.id, speaker: 'presenter', text: line.text, ...roundSpan(spans[index]) }));
    const overlays = [];
    for (const line of lines) {
        overlays.push({ file: await png(path.join(dir, 'work', `dub-sub-${line.id}.png`), fittedSubtitle(540, line.text)), x: 0, y: 770,
            spans: [{ start: line.start - 0.1, end: line.end + 0.25 }] });
    }
    const file = await buildVideo(tools, {
        width: 540, height: 960, fps: 25, duration,
        backgrounds: [{ file: background, seconds: duration }], overlays,
        mouths: [{ rect: mouthRect(270, 260, size), spans: lines }],
        audio,
    }, path.join(dir, 'attachments', '台灯口播-中文版.mp4'));
    return { attachments: [file], truth: { kind: 'dub', file, lines, duration: round3(duration), numbers: [199, 3] } };
}
const AMBIENT_HZ = 6300;
/** Six moving 4-second clips of a guesthouse, each with its own sound, and a 100 BPM track. */
async function seedClipMontage(dir, tools) {
    const stripes = (colour, count, y, height) => Array.from({ length: count }, (_item, index) => `<rect x="${index * (1440 / count)}" y="${y}" width="${1440 / count / 2}" height="${height}" fill="${colour}"/>`).join('');
    const scenes = [
        { name: '院子', body: `<rect width="1440" height="1280" fill="#a9d2e8"/><rect y="760" width="1440" height="520" fill="#7aa35f"/>${stripes('#f6efe2', 12, 640, 160)}<rect x="560" y="420" width="380" height="380" fill="#c8a27a"/><polygon points="520,430 750,260 980,430" fill="#8a4f2f"/>` },
        { name: '客房', body: `<rect width="1440" height="1280" fill="#efe3cf"/>${stripes('#d9c4a3', 18, 0, 1280)}<rect x="300" y="700" width="840" height="300" rx="20" fill="#ffffff"/><rect x="300" y="640" width="840" height="90" rx="20" fill="#9fb7c9"/><rect x="1180" y="300" width="200" height="320" fill="#bde0f2" stroke="#ffffff" stroke-width="12"/>` },
        { name: '早餐', body: `<rect width="1440" height="1280" fill="#f4dcb8"/><rect y="700" width="1440" height="580" fill="#b07a4f"/>${[0, 1, 2, 3, 4, 5].map((index) => `<circle cx="${140 + index * 240}" cy="820" r="90" fill="#ffffff"/><circle cx="${140 + index * 240}" cy="820" r="50" fill="${['#e3a33b', '#c0392b', '#7aa35f', '#f1c40f', '#8e5a3a', '#e67e22'][index]}"/>`).join('')}` },
        { name: '露台', body: `<rect width="1440" height="1280" fill="#ffd9a8"/><rect y="560" width="1440" height="200" fill="#6a8fb0"/>${stripes('#5a4030', 16, 760, 300)}<rect y="1060" width="1440" height="220" fill="#8a6a4a"/><circle cx="1100" cy="260" r="110" fill="#fff2c4"/>` },
        { name: '夜景', body: `<rect width="1440" height="1280" fill="#16213a"/>${Array.from({ length: 60 }, (_item, index) => `<circle cx="${(index * 97) % 1440}" cy="${(index * 53) % 520}" r="${2 + (index % 3)}" fill="#f6efe2"/>`).join('')}${stripes('#ffd27a', 14, 760, 120)}<rect y="880" width="1440" height="400" fill="#0d1424"/>` },
        { name: '山景', body: `<rect width="1440" height="1280" fill="#cfe6f2"/><polygon points="0,900 240,420 480,900" fill="#6d8f7a"/><polygon points="360,900 700,300 1040,900" fill="#56786a"/><polygon points="900,900 1180,460 1440,900" fill="#7d9c88"/><rect y="900" width="1440" height="380" fill="#8fb36b"/>${stripes('#e8f2f7', 10, 180, 40)}` },
    ];
    const clips = [];
    for (const [index, scene] of scenes.entries()) {
        const wide = await png(path.join(dir, 'work', `stay-${index}.png`), svg(1440, 1280, scene.body));
        const rate = 44100;
        const random = prng(200 + index);
        const samples = new Float32Array(rate * 4);
        for (let sample = 0; sample < samples.length; sample += 1)
            samples[sample] = 0.03 * Math.sin(2 * Math.PI * AMBIENT_HZ * sample / rate) + (random() * 2 - 1) * 0.003;
        const sound = writeWav(path.join(dir, 'work', `stay-${index}.wav`), { rate, samples });
        const out = path.join(dir, 'attachments', `民宿-${String(index + 1).padStart(2, '0')}-${scene.name}.mp4`);
        // A steady pan across the scene, as a handheld walk-through would be.
        await runMedia(tools.ffmpeg, ['-v', 'error', '-nostdin', '-y', '-loop', '1', '-framerate', '30', '-t', '4', '-i', wide, '-i', sound,
            '-filter_complex', `[0:v]crop=720:1280:x='t*180':y=0,format=yuv420p[v]`, '-map', '[v]', '-map', '1:a', '-t', '4', '-r', '30',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', out], undefined, 300_000);
        clips.push(out);
    }
    const bpm = 100;
    const musicDuration = 24;
    const { pcm: track, beats } = synthMusic(musicDuration, bpm, 131);
    const music = writeWav(path.join(dir, 'attachments', '民宿-背景音乐.wav'), track);
    return { attachments: [...clips, music], truth: { kind: 'clip-montage', music, clips, bpm, musicDuration, beats, ambientHz: AMBIENT_HZ } };
}
export const seed = { retakes: seedRetakes, dub: seedDub, montage: seedMontage, 'clip-montage': seedClipMontage };
