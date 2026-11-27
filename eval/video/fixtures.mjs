// Portable production and reference fixtures.
import fs from 'node:fs';
import path from 'node:path';
import { assemble, prng, round3, runMedia, speak } from './media.mjs';
import { sharp, VOICE_FEMALE, SPEECH_RATE, FONT, roundSpan, svg, escapeXml, png, writeWav, figure, mouthRect, buildVideo, synthMusic } from './fixture-media.mjs';
import { productionSeeds } from './production-fixtures.mjs';
import { seedReference } from './reference-fixtures.mjs';
export { synthMusic } from './fixture-media.mjs';

async function seedRetakes(dir, tools, preserveTiming = false) {
    const script = preserveTiming ? [
        { id: 'opening', text: '这次价格是一百九十九元。', role: 'keep', pause: 0.8 },
        { id: 'emphasis', text: '记住，检查，检查，再检查。', role: 'keep', pause: 1.2 },
        { id: 'factual-correction', text: '我刚才说三档，准确说是两档。', role: 'keep', pause: 0.8 },
        { id: 'thought', text: '先想清楚。', role: 'keep', pause: 1.8 },
        { id: 'payoff', text: '再动手。', role: 'keep', pause: 0.8 },
    ] : [
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
    return { attachments: [file], truth: { kind: 'retakes', file, lines, ...(preserveTiming ? { preserveTiming: true } : {}) } };
}
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
const LECTURE_PILOT_HZ = 9300;
/** A talk to camera with every spoken line under the lecture pilot tone, so an oracle hears how
 *  much of the talk a delivery keeps under music, captions or a reframe. */
async function seedTalk(dir, tools, spec) {
    const pieces = [{ pause: spec.lead }];
    for (const line of spec.script) pieces.push({ pcm: await speak(line.text, VOICE_FEMALE, SPEECH_RATE) }, { pause: line.pause });
    const { pcm, spans } = assemble(SPEECH_RATE, pieces, spec.seed);
    for (const span of spans) {
        for (let index = Math.floor(span.start * SPEECH_RATE); index < Math.min(pcm.samples.length, Math.ceil(span.end * SPEECH_RATE)); index += 1) {
            pcm.samples[index] += 0.02 * Math.sin(2 * Math.PI * LECTURE_PILOT_HZ * index / SPEECH_RATE);
        }
    }
    const audio = writeWav(path.join(dir, 'work', `${spec.name}.wav`), pcm);
    const duration = pcm.samples.length / SPEECH_RATE;
    const [width, height, cx, top, size] = spec.vertical ? [540, 960, 270, 300, 280] : [1280, 720, 470, 150, 220];
    const background = await png(path.join(dir, 'work', `${spec.name}.png`), svg(width, height, `
        <rect width="${width}" height="${height}" fill="${spec.wall}"/>${spec.props}
        <rect y="${Math.round(height * 0.78)}" width="${width}" height="${Math.round(height * 0.22)}" fill="${spec.floor}"/>${figure(cx, top, size, spec.shirt, spec.hair)}`));
    const lines = spec.script.map((line, index) => ({ id: `line-${index + 1}`, speaker: 'presenter', text: line.text, ...roundSpan(spans[index]) }));
    const out = path.join(dir, spec.folder, `${spec.name}.mp4`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const file = await buildVideo(tools, {
        width, height, fps: 25, duration,
        backgrounds: [{ file: background, seconds: duration }],
        mouths: [{ rect: mouthRect(cx, top, size), spans: lines }],
        audio,
    }, out);
    return { kind: 'talk', file, lines, pilotHz: LECTURE_PILOT_HZ, localPath: spec.folder === 'outside' };
}

/** A vertical talk with long pauses and emphasis for caption review. */
async function seedTalkingHead(dir, tools) {
    const truth = await seedTalk(dir, tools, {
        name: '会员三个坑-口播原片', folder: 'attachments', vertical: true, seed: 37, lead: 2.2,
        script: [
            { text: '做会员这件事，很多小店老板都踩过坑，今天说最常见的三个。', pause: 0.6 },
            { text: '第一个坑，规则太复杂。积分、等级、折上折，顾客根本记不住。', pause: 0.6 },
            { text: '我们店现在只有一条规则：买满十次，送一次。', pause: 2.8 },
            { text: '第二个坑，只办卡，不联系。办完卡就再也没跟顾客说过话。', pause: 0.6 },
            { text: '其实每个月发一条新品消息，回头的人就能多两成。', pause: 2.6 },
            { text: '第三个坑，把会员当成打折工具。折扣给多了，利润就没了。', pause: 0.6 },
            { text: '会员要的是被记住，不是便宜五块钱。', pause: 0.6 },
            { text: '记住这三点，你的会员才真的有用。', pause: 2.5 },
        ],
        wall: '#dfe6ea', floor: '#b9c3c9', shirt: '#2f5d62', hair: '#2b211b',
        props: '<rect x="40" y="120" width="120" height="300" rx="8" fill="#c9d3d8"/><rect x="400" y="90" width="110" height="150" fill="#f3efe6" stroke="#9aa6ad" stroke-width="6"/>',
    });
    return { attachments: [truth.file], truth };
}

/** A short talk the user keeps on their own computer and names by its path. */
async function seedLocalTalk(dir, tools) {
    const truth = await seedTalk(dir, tools, {
        name: '本周新品介绍', folder: 'outside', vertical: false, seed: 43, lead: 0.6,
        script: [
            { text: '大家好，这周我们店上了一款新品，抹茶红豆卷。', pause: 0.7 },
            { text: '外面是现烤的抹茶蛋糕胚，里面是自己熬的红豆馅。', pause: 0.7 },
            { text: '甜度我们调低了，吃完不会腻。', pause: 0.7 },
            { text: '每天下午三点出炉，一天只做四十个。', pause: 0.7 },
            { text: '想吃的朋友，可以提前在群里跟我说，帮你留着。', pause: 1.0 },
        ],
        wall: '#f1e8dc', floor: '#c9b597', shirt: '#7a4b3a', hair: '#2b211b',
        props: '<rect x="760" y="120" width="420" height="300" rx="12" fill="#e2cfb2"/><ellipse cx="900" cy="300" rx="70" ry="36" fill="#7fae6a"/><ellipse cx="1060" cy="300" rx="70" ry="36" fill="#7fae6a"/>',
    });
    return { attachments: [], outside: [truth.file], truth };
}

export const seed = {
    ...productionSeeds,
    reference: seedReference,
    retakes: (dir, tools) => seedRetakes(dir, tools),
    'retake-preservation': (dir, tools) => seedRetakes(dir, tools, true),
    dub: seedDub,
    montage: seedMontage,
    'clip-montage': seedClipMontage,
    'talking-head': seedTalkingHead,
    'local-talk': seedLocalTalk,
};
