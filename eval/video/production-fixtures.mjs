// Synthetic production inputs adapted from the Orkas VideoStudio evaluation.
import fs from 'node:fs';
import path from 'node:path';
import { assemble, prng, round3, runMedia, speak, trimSilence, wavBytes } from './media.mjs';
import { sharp, VOICE_FEMALE, SPEECH_RATE, FONT, roundSpan, svg, escapeXml, png, writeWav, figure, mouthRect, buildVideo, synthMusic } from './fixture-media.mjs';
import { STORY_SCRIPT, EPISODE_SCRIPT } from './story-scripts.mjs';

const LECTURE_PILOT_HZ = 9300;

export const AD_PROFILES = {
    baseline: { shape: 'lamp', shortName: '台灯', name: 'LUMEN L2 护眼台灯', price: 199, revisedPrice: 179,
        spokenPrice: '一百九十九', spokenRevisedPrice: '一百七十九',
        specs: ['无频闪', '三档色温', '底座 10W 无线充电'], use: '适合书桌、床头和工作台使用。' },
    alternate: { shape: 'bottle', shortName: '水杯', name: 'MORI 随行水杯', price: 89, revisedPrice: 69,
        spokenPrice: '八十九', spokenRevisedPrice: '六十九',
        specs: ['450 mL', '旋盖设计', '蓝色杯身'], use: '适合通勤和日常随身携带。' },
    holdout: { shape: 'fan', shortName: '风扇', name: 'BREEZE 桌面风扇', price: 129, revisedPrice: 109,
        spokenPrice: '一百二十九', spokenRevisedPrice: '一百零九',
        specs: ['三档风速', 'USB-C 供电', '可折叠支架'], use: '适合书桌和办公室使用。' },
};
export const TUTORIAL_PROFILES = {
    baseline: { app: '云盘助手', goal: '开启自动备份', page: '备份', heading: '设置', toggle: '自动备份',
        option: '备份频率', optionValue: '每天 02:00', folderLabel: '备份文件夹', folder: 'D:\\照片\\家庭',
        button: '立即备份', done: '备份完成', result: '下次自动备份：明天 02:00', width: 1280, height: 720, lead: 4, wait: 10 },
    alternate: { app: '采购清单', goal: '导出带商品图片的 PDF 清单', page: '导出', heading: '导出设置', toggle: '包含商品图片',
        option: '导出格式', optionValue: 'PDF', folderLabel: '保存目录', folder: 'D:\\采购\\本周',
        button: '导出 PDF', done: '导出完成', result: '文件已保存到所选目录', width: 1600, height: 900, lead: 2, wait: 7 },
    holdout: { app: '相册整理器', goal: '把照片按拍摄日期整理到新文件夹', page: '整理', heading: '整理设置', toggle: '按拍摄日期分组',
        option: '文件操作', optionValue: '复制并保留原图', folderLabel: '目标文件夹', folder: 'D:\\归档\\旅行',
        button: '开始整理', done: '整理完成', result: '原图保留在原位置', width: 1440, height: 900, lead: 5, wait: 12 },
};
const MALE_PITCH = 0.8;
async function speakPart(tools, text, male) {
    const pcm = await speak(text, VOICE_FEMALE, SPEECH_RATE);
    if (!male)
        return pcm;
    const raw = await runMedia(tools.ffmpeg, ['-v', 'error', '-nostdin', '-f', 'wav', '-i', 'pipe:0',
        '-af', `asetrate=${SPEECH_RATE * MALE_PITCH},aresample=${SPEECH_RATE},atempo=${1 / MALE_PITCH}`,
        '-ac', '1', '-ar', String(SPEECH_RATE), '-f', 's16le', 'pipe:1'], wavBytes(pcm));
    const samples = new Float32Array(raw.length >> 1);
    for (let index = 0; index < samples.length; index += 1)
        samples[index] = raw.readInt16LE(index * 2) / 32768;
    return trimSilence({ rate: SPEECH_RATE, samples });
}
function card(width, height, lines, background = '#101418', color = '#ffffff') {
    const size = Math.round(width / 13);
    const startY = height / 2 - (lines.length - 1) * size * 0.75;
    return svg(width, height, `<rect width="${width}" height="${height}" fill="${background}"/>${lines.map((line, index) => (`<text x="${width / 2}" y="${startY + index * size * 1.5}" text-anchor="middle" font-family="${FONT}" font-size="${index === 0 ? size : Math.round(size * 0.7)}" fill="${color}">${escapeXml(line)}</text>`)).join('')}`);
}
function subtitle(width, text) {
    const size = Math.round(width / 16);
    return svg(width, size * 2, `<text x="${width / 2}" y="${size * 1.35}" text-anchor="middle" font-family="${FONT}" font-size="${size}" fill="#ffffff" stroke="#000000" stroke-width="${Math.max(2, size / 12)}" paint-order="stroke">${escapeXml(text)}</text>`);
}
async function seedPodcast(dir, tools) {
    const script = [
        { id: 'intro-1', speaker: 'host', text: '欢迎来到咖啡聊聊，今天的嘉宾是街角小店的老板阿青。', pause: 0.6 },
        { id: 'intro-2', speaker: 'guest', text: '大家好，很高兴来聊天。', pause: 1.3 },
        { id: 'a-q', speaker: 'host', text: '去年你们为什么要提价？', pause: 0.7 },
        { id: 'a-1', speaker: 'guest', text: '豆子成本涨了三成，我们算了很久。', pause: 0.5 },
        { id: 'a-2', speaker: 'guest', text: '后来想明白了，便宜留不住人，好喝才留得住人。', pause: 1.3 },
        { id: 'b-q', speaker: 'host', text: '听说你能记住每个熟客的名字？', pause: 0.7 },
        { id: 'b-1', speaker: 'guest', text: '对，大概有两百个吧。', pause: 0.5 },
        { id: 'b-2', speaker: 'guest', text: '有个客人跟我说，被叫出名字的那一刻，他觉得这家店是他的。', pause: 1.3 },
        { id: 'c-q', speaker: 'host', text: '房租这么贵，你们是怎么撑下来的？', pause: 0.7 },
        { id: 'c-1', speaker: 'guest', text: '我们把下午的空档租给了一个读书会。', pause: 0.5 },
        { id: 'c-2', speaker: 'guest', text: '就这一个读书会，一年就把房租的缺口补上了。', pause: 1.3 },
        { id: 'd-1', speaker: 'host', text: '最近天气挺热的。', pause: 0.5 },
        { id: 'd-2', speaker: 'guest', text: '是啊，冰咖啡卖得多一些。', pause: 1.3 },
        { id: 'outro-1', speaker: 'host', text: '今天就聊到这里，谢谢阿青。', pause: 0.5 },
        { id: 'outro-2', speaker: 'guest', text: '谢谢大家。', pause: 1.0 },
    ];
    const pieces = [{ pause: 0.8 }];
    for (const line of script) {
        pieces.push({ pcm: await speakPart(tools, line.text, line.speaker === 'host') }, { pause: line.pause });
    }
    const { pcm, spans } = assemble(SPEECH_RATE, pieces, 23);
    const audio = writeWav(path.join(dir, 'work', 'podcast.wav'), pcm);
    const duration = pcm.samples.length / SPEECH_RATE;
    const lines = script.map((line, index) => ({ id: line.id, speaker: line.speaker, text: line.text, ...roundSpan(spans[index]) }));
    const size = 120;
    const host = { cx: 190, top: 95 };
    const guest = { cx: 450, top: 95 };
    const background = await png(path.join(dir, 'work', 'studio.png'), svg(640, 360, `
    <rect width="640" height="360" fill="#3b3330"/><rect y="250" width="640" height="110" fill="#6b4f3a"/>
    <text x="320" y="44" text-anchor="middle" font-family="${FONT}" font-size="26" fill="#f3e3c8">咖啡聊聊</text>
    ${figure(host.cx, host.top, size, '#2f6f8a', '#222222')}${figure(guest.cx, guest.top, size, '#c0682f', '#5a3420')}
    <rect x="${host.cx - 8}" y="230" width="16" height="60" fill="#222"/><rect x="${guest.cx - 8}" y="230" width="16" height="60" fill="#222"/>`));
    const file = await buildVideo(tools, {
        width: 640, height: 360, fps: 25, duration,
        backgrounds: [{ file: background, seconds: duration }],
        mouths: [
            { rect: mouthRect(host.cx, host.top, size), spans: lines.filter((line) => line.speaker === 'host') },
            { rect: mouthRect(guest.cx, guest.top, size), spans: lines.filter((line) => line.speaker === 'guest') },
        ],
        audio,
    }, path.join(dir, 'attachments', '咖啡聊聊第12期.mp4'));
    return {
        attachments: [file],
        truth: {
            kind: 'podcast', file, lines,
            stories: [
                { id: 'intro', lines: ['intro-1', 'intro-2'] },
                { id: 'price', lines: ['a-q', 'a-1', 'a-2'], question: 'a-q', payoff: 'a-2' },
                { id: 'names', lines: ['b-q', 'b-1', 'b-2'], question: 'b-q', payoff: 'b-2' },
                { id: 'rent', lines: ['c-q', 'c-1', 'c-2'], question: 'c-q', payoff: 'c-2' },
                { id: 'weather', lines: ['d-1', 'd-2'] },
                { id: 'outro', lines: ['outro-1', 'outro-2'] },
            ],
        },
    };
}
async function seedRecap(dir, tools) {
    const fps = 25;
    const width = 540;
    const height = 960;
    const episodes = [[
            { kind: 'title', card: ['《改合同的人》', '第 1 集', '主演 沈墨 小周'], hold: 2.5 },
            { kind: 'scene', scene: 'office', lines: [
                    { speaker: '沈墨', text: '小周，合同呢？', pause: 0.6 },
                    { speaker: '小周', text: '沈总，合同被人改过了。', pause: 0.6 },
                    { speaker: '沈墨', text: '改了哪里？', pause: 0.6 },
                    { speaker: '小周', text: '付款日期，从三十天改成了九十天。', pause: 0.9 },
                ] },
            { kind: 'scene', scene: 'archive', lines: [
                    { speaker: '沈墨', text: '这份合同，只有三个人碰过。', pause: 0.6 },
                    { speaker: '小周', text: '我、您，还有财务部。', pause: 0.9 },
                ] },
            { kind: 'preview', card: ['下集预告'], lines: [{ speaker: '小周', text: '沈总，我查到是谁了。', pause: 0.8 }] },
            { kind: 'credits', card: ['出品 · 小剧场', '感谢观看'], hold: 2 },
        ], [
            { kind: 'title', card: ['《改合同的人》', '第 2 集'], hold: 2.5 },
            { kind: 'recap', card: ['前情提要'], lines: [{ speaker: '小周', text: '沈总，合同被人改过了。', pause: 0.8 }] },
            { kind: 'scene', scene: 'office', lines: [
                    { speaker: '小周', text: '沈总，我查到是谁了，是财务部的老林。', pause: 0.6 },
                    { speaker: '沈墨', text: '老林跟了我十年。', pause: 0.6 },
                    { speaker: '小周', text: '他说，是您让他改的。', pause: 0.9 },
                ] },
            { kind: 'scene', scene: 'archive', lines: [
                    { speaker: '沈墨', text: '我从来没让他改过。', pause: 0.6 },
                    { speaker: '沈墨', text: '把那天的录音调出来。', pause: 0.9 },
                ] },
            { kind: 'preview', card: ['下集预告'], lines: [{ speaker: '小周', text: '录音被删了。', pause: 0.8 }] },
            { kind: 'credits', card: ['出品 · 小剧场', '感谢观看'], hold: 2 },
        ]];
    const sceneImage = async (name) => png(path.join(dir, 'work', `scene-${name}.png`), svg(width, height, `
    <rect width="${width}" height="${height}" fill="${name === 'office' ? '#1d2a3a' : '#2b2520'}"/>
    <rect x="40" y="120" width="200" height="260" fill="${name === 'office' ? '#33506e' : '#4a3d30'}"/>
    <rect y="700" width="${width}" height="260" fill="${name === 'office' ? '#2a3442' : '#3a312a'}"/>
    ${figure(170, 380, 150, '#7a1f2b', '#141414')}${figure(390, 400, 140, '#4a5a6a', '#262626')}`));
    const scenes = { office: await sceneImage('office'), archive: await sceneImage('archive') };
    const truthEpisodes = [];
    const attachments = [];
    for (const [episodeIndex, beats] of episodes.entries()) {
        const pieces = [];
        const plan = [];
        let spoken = 0;
        for (const beat of beats) {
            const lead = beat.kind === 'scene' ? 0.5 : 0.4;
            pieces.push({ pause: lead });
            const lineIndexes = [];
            for (const line of beat.lines ?? []) {
                pieces.push({ pcm: await speakPart(tools, line.text, line.speaker !== '沈墨') }, { pause: line.pause });
                lineIndexes.push(spoken);
                spoken += 1;
            }
            if (!beat.lines?.length)
                pieces.push({ pause: Math.max(0, (beat.hold ?? 2) - lead) });
            plan.push({ beat, lineIndexes, lead });
        }
        const { pcm, spans } = assemble(SPEECH_RATE, pieces, 31 + episodeIndex);
        const duration = pcm.samples.length / SPEECH_RATE;
        const audio = writeWav(path.join(dir, 'work', `episode-${episodeIndex + 1}.wav`), pcm);
        const segments = [];
        const lines = [];
        let cursor = 0;
        const beatEnds = [];
        let pieceCursor = 0;
        for (const [planIndex, item] of plan.entries()) {
            const pieceCount = 1 + (item.beat.lines?.length ? item.beat.lines.length * 2 : 1);
            const seconds = pieces.slice(pieceCursor, pieceCursor + pieceCount).reduce((sum, piece) => sum + ('pause' in piece ? piece.pause : piece.pcm.samples.length / SPEECH_RATE), 0);
            pieceCursor += pieceCount;
            cursor += seconds;
            beatEnds[planIndex] = cursor;
        }
        const backgrounds = [];
        const overlays = [];
        let previousEnd = 0;
        for (const [planIndex, item] of plan.entries()) {
            const end = planIndex === plan.length - 1 ? duration : beatEnds[planIndex];
            segments.push({ kind: item.beat.kind, start: round3(previousEnd), end: round3(end) });
            const backgroundFile = item.beat.card
                ? await png(path.join(dir, 'work', `ep${episodeIndex + 1}-card-${planIndex}.png`), card(width, height, item.beat.card, item.beat.kind === 'preview' ? '#4a1010' : '#101418'))
                : scenes[item.beat.scene];
            backgrounds.push({ file: backgroundFile, seconds: end - previousEnd });
            for (const [lineNumber, lineIndex] of item.lineIndexes.entries()) {
                const source = item.beat.lines[lineNumber];
                const span = roundSpan(spans[lineIndex]);
                const subtitleFile = await png(path.join(dir, 'work', `ep${episodeIndex + 1}-sub-${lineIndex}.png`), subtitle(width, source.text));
                overlays.push({ file: subtitleFile, x: 0, y: 760, spans: [{ start: span.start - 0.1, end: span.end + 0.25 }] });
                lines.push({ id: `ep${episodeIndex + 1}-${lineIndex}`, speaker: source.speaker, text: source.text, subtitle: source.text, segment: item.beat.kind, ...span });
            }
            previousEnd = end;
        }
        if (episodeIndex === 0) {
            const firstScene = segments.find((segment) => segment.kind === 'scene');
            const nameCard = await png(path.join(dir, 'work', 'names.png'), svg(width, 70, `
        <rect x="20" y="8" width="230" height="54" rx="6" fill="#000000" opacity="0.55"/><text x="135" y="46" text-anchor="middle" font-family="${FONT}" font-size="30" fill="#ffd27a">沈墨 · 总经理</text>
        <rect x="290" y="8" width="230" height="54" rx="6" fill="#000000" opacity="0.55"/><text x="405" y="46" text-anchor="middle" font-family="${FONT}" font-size="30" fill="#bfe3ff">小周 · 助理</text>`));
            overlays.push({ file: nameCard, x: 0, y: 640, spans: [{ start: firstScene.start, end: firstScene.start + 3 }] });
        }
        const file = await buildVideo(tools, {
            width, height, fps, duration, backgrounds, overlays,
            timecode: { offset: episodeIndex * 2048, height: 28 },
            audio,
        }, path.join(dir, 'attachments', `改合同的人-第${episodeIndex + 1}集.mp4`));
        attachments.push(file);
        truthEpisodes.push({ file, duration: round3(duration), segments, lines });
    }
    return {
        attachments,
        truth: {
            kind: 'recap', fps, episodes: truthEpisodes,
            names: ['沈墨', '沈总', '小周', '老林'],
            misheard: ['沈默', '神总', '审总', '小舟', '小州', '老琳', '老凌'],
        },
    };
}
function lampDrawing(width, height, options = {}) {
    const cx = width / 2 + (options.offsetX ?? 0);
    const base = height * 0.8;
    const scale = Math.min(width, height) / 900 * (options.size ?? 1);
    const s = (value) => value * scale;
    return svg(width, height, `
    <rect width="${width}" height="${height}" fill="${options.background ?? '#ece7df'}"/>
    <rect y="${base + s(40)}" width="${width}" height="${height - base - s(40)}" fill="#b9946a"/>
    ${options.lit ? `<polygon points="${cx + s(150)},${base - s(370)} ${cx + s(60)},${base + s(40)} ${cx + s(420)},${base + s(40)} ${cx + s(250)},${base - s(370)}" fill="#ffe7a3" opacity="0.55"/>` : ''}
    <ellipse cx="${cx}" cy="${base + s(20)}" rx="${s(150)}" ry="${s(34)}" fill="#f4f4f1" stroke="#9aa1a8" stroke-width="${s(4)}"/>
    <text x="${cx}" y="${base + s(30)}" text-anchor="middle" font-family="sans-serif" font-size="${s(26)}" fill="#3a4450">LUMEN</text>
    <line x1="${cx}" y1="${base}" x2="${cx - s(60)}" y2="${base - s(300)}" stroke="#f4f4f1" stroke-width="${s(26)}" stroke-linecap="round"/>
    <line x1="${cx - s(60)}" y1="${base - s(300)}" x2="${cx + s(170)}" y2="${base - s(420)}" stroke="#f4f4f1" stroke-width="${s(22)}" stroke-linecap="round"/>
    <circle cx="${cx - s(60)}" cy="${base - s(300)}" r="${s(20)}" fill="#c9ced3"/>
    <polygon points="${cx + s(120)},${base - s(440)} ${cx + s(290)},${base - s(410)} ${cx + s(250)},${base - s(360)} ${cx + s(150)},${base - s(375)}" fill="#f4f4f1" stroke="#9aa1a8" stroke-width="${s(4)}"/>
    ${options.lit ? `<line x1="${cx + s(150)}" y1="${base - s(372)}" x2="${cx + s(250)}" y2="${base - s(362)}" stroke="#fff6cf" stroke-width="${s(8)}"/>` : ''}
  `);
}
const AD_FACTS = AD_PROFILES.baseline;
async function seedAdPage(dir, variant = 'baseline') {
    const profile = AD_PROFILES[variant];
    const drawing = (side) => variant === 'baseline' ? lampDrawing(900, 900, side ? { lit: true, background: '#3a3530' } : {})
        : svg(1200, 900, `<rect width="1200" height="900" fill="#e5e0d4"/>
      <rect x="30" y="30" width="300" height="840" fill="#34495e"/><text x="65" y="120" font-size="42" fill="white">${profile.name.split(' ')[0]}</text>
      <g transform="translate(${side ? 110 : 0},0)">${profile.shape === 'bottle'
            ? '<rect x="600" y="210" width="180" height="440" rx="60" fill="#316da8"/><rect x="620" y="160" width="140" height="85" rx="20" fill="#243e55"/><text x="625" y="400" font-size="28" fill="white">MORI</text><text x="625" y="445" font-size="24" fill="white">450 mL</text>'
            : '<rect x="650" y="480" width="60" height="200" fill="#244838"/><ellipse cx="680" cy="690" rx="140" ry="25" fill="#244838"/><circle cx="680" cy="340" r="180" fill="#739b85" stroke="#244838" stroke-width="20"/><path d="M680 340 Q500 160 640 190 Q800 270 680 340 Q590 580 540 420 Q520 280 680 340 Q940 350 810 460 Q680 500 680 340" fill="#d0e2d5"/>'}</g>
      <rect x="360" y="740" width="800" height="100" fill="#d1c6ab"/><text x="390" y="800" font-family="${FONT}" font-size="34" fill="#243447">${profile.specs.map(escapeXml).join(' · ')}</text>`);
    const front = await sharp(drawing(false)).png().toBuffer();
    const lit = await sharp(drawing(true)).png().toBuffer();
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${profile.name}</title>
<style>body{font-family:-apple-system,"PingFang SC",sans-serif;margin:0;background:#fafafa;color:#222}main{max-width:960px;margin:0 auto;padding:32px}
.gallery{display:flex;gap:16px}.gallery img{width:440px;height:440px;object-fit:cover;border-radius:8px}h1{font-size:32px}.price{font-size:36px;color:#c0392b}li{font-size:20px;margin:8px 0}</style></head>
<body><main><h1>${profile.name}</h1><div class="gallery"><img src="front.png" alt="${profile.shortName}正面"><img src="lit.png" alt="${profile.shortName}侧面"></div>
<p class="price">¥${profile.price}</p><h2>产品特点</h2><ul>${profile.specs.map((spec) => `<li>${spec}</li>`).join('')}</ul>
<p>${profile.use}</p></main></body></html>`;
    const music = writeWav(path.join(dir, 'work', 'page-music.wav'), synthMusic(24, 96, 239).pcm);
    return {
        attachments: [],
        page: { html, assets: { 'front.png': front, 'lit.png': lit } },
        truth: { kind: 'ad', name: profile.name, price: profile.price, revisedPrice: profile.revisedPrice,
            specs: [...profile.specs], spokenPrice: profile.spokenPrice, spokenRevisedPrice: profile.spokenRevisedPrice,
            use: profile.use, images: ['front.png', 'lit.png'], music },
    };
}
async function seedNoSpend(dir) {
    const photos = [
        await png(path.join(dir, 'attachments', '台灯-正面.png'), lampDrawing(1080, 1080)),
        await png(path.join(dir, 'attachments', '台灯-侧面.png'), lampDrawing(1080, 1080, { offsetX: -160, background: '#e3e6ea' })),
        await png(path.join(dir, 'attachments', '台灯-底座特写.png'), svg(1080, 1080, `<rect width="1080" height="1080" fill="#ece7df"/>
      <ellipse cx="540" cy="620" rx="420" ry="110" fill="#f4f4f1" stroke="#9aa1a8" stroke-width="6"/><text x="540" y="640" text-anchor="middle" font-family="sans-serif" font-size="70" fill="#3a4450">LUMEN</text>
      <rect x="380" y="430" width="320" height="40" rx="20" fill="#c9ced3"/>`)),
    ];
    return {
        attachments: photos,
        truth: { kind: 'ad', name: AD_FACTS.name, price: AD_FACTS.price, revisedPrice: AD_FACTS.revisedPrice, specs: [...AD_FACTS.specs], images: photos },
    };
}
function seedExplainer(dir) {
    const sourceText = [
        '# 飞机为什么能飞起来：资料整理',
        '',
        '来源：NASA Glenn Research Center《Beginner\'s Guide to Aeronautics》中 "What is Lift?"、"Incorrect Lift Theory #1 (Equal Transit)" 两页；以下为中文摘录整理。',
        '',
        '1. 升力是机翼对空气施加作用、空气反过来作用在机翼上的力，方向大致垂直于来流。',
        '2. 机翼让流过它的气流改变方向，把空气向下推；按照牛顿第三定律，空气对机翼产生向上的力。',
        '3. 同样的现象也可以用压强来描述：机翼上表面的气压比下表面低，上下压差产生向上的升力。这两种描述说的是同一件事。',
        '4. 升力随迎角增大而增大；迎角过大时，气流从上表面分离，升力骤降，这就是失速。',
        '5. 升力和空气密度、飞行速度的平方、机翼面积成正比。',
        '6. 常见误解（"等时间"理论）：认为上下两股气流必须同时到达机翼后缘，所以上表面的气流更快。这个说法是错的：实际上上表面的气流比下表面更早到达后缘，而且平板和对称翼型在有迎角时同样能产生升力。',
        '',
        '整理时只保留以上内容；没有涉及具体机型、发动机或历史。',
    ].join('\n');
    const file = path.join(dir, 'attachments', '飞机为什么能飞-资料.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, sourceText, 'utf8');
    return { attachments: [file], truth: { kind: 'explainer', file, sourceText } };
}
export const TUTORIAL_COLORS = { wait: [92, 70, 20], toast: [247, 120, 186], done: [31, 138, 112] };
const rgbHex = (rgb) => `#${rgb.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
function appScreen(state, profile) {
    const text = (x, y, size, fill, value, weight = 400) => `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(value)}</text>`;
    const nav = ['首页', '文件', '设置'].map((item, index) => {
        const active = (state.page === 'home' ? 0 : 2) === index;
        return `<rect x="16" y="${86 + index * 54}" width="188" height="42" rx="8" fill="${active ? '#d6e2f5' : '#e9edf3'}"/>${text(44, 114 + index * 54, 20, '#24324a', item)}`;
    }).join('');
    let main = '';
    if (state.page === 'home') {
        main = text(260, 110, 28, '#1d2633', profile.goal) + ['合同扫描.pdf', '家庭照片 2026', '报价单.xlsx', '会议记录.docx', '发票.pdf'].map((name, index) => (`<rect x="260" y="${140 + index * 64}" width="980" height="52" rx="6" fill="#ffffff"/>${text(290, 173 + index * 64, 20, '#2c3646', name)}`)).join('');
    }
    else {
        const tabs = ['通用', profile.page, '账号'].map((name, index) => {
            const active = (state.page === 'general' ? 0 : 1) === index;
            return text(280 + index * 120, 140, 22, active ? '#2f6fed' : '#5b6575', name) + (active ? `<rect x="${272 + index * 120}" y="152" width="64" height="4" fill="#2f6fed"/>` : '');
        }).join('');
        const row = (y, label, value, enabled = true) => `<rect x="260" y="${y}" width="980" height="56" rx="6" fill="#ffffff"/>${text(290, y + 36, 21, '#1d2633', label)}${text(900, y + 36, 21, enabled ? '#1d2633' : '#a9b0ba', value)}`;
        main = text(260, 100, 30, '#1d2633', profile.heading) + tabs + '<rect x="260" y="160" width="980" height="2" fill="#d8dde5"/>';
        if (state.page === 'general') {
            main += row(190, '语言', '中文') + row(262, '主题', '浅色') + row(334, '开机启动', '开');
        }
        else {
            const on = !!state.backupOn;
            main += `<rect x="260" y="190" width="980" height="56" rx="6" fill="#ffffff"/>${text(290, 226, 21, '#1d2633', profile.toggle)}
        <rect x="1110" y="200" width="76" height="36" rx="18" fill="${on ? '#22a06b' : '#c8cdd4'}"/><circle cx="${on ? 1168 : 1128}" cy="218" r="14" fill="#ffffff"/>`;
            main += row(262, profile.option, profile.optionValue, on);
            main += `<rect x="260" y="334" width="980" height="56" rx="6" fill="#ffffff"/>${text(290, 370, 21, '#1d2633', profile.folderLabel)}
        <rect x="560" y="342" width="620" height="40" rx="4" fill="#f6f8fb" stroke="#b7c0cc" stroke-width="2"/>${text(576, 370, 20, '#1d2633', state.folder ?? '')}`;
            main += `<rect x="1060" y="420" width="180" height="52" rx="8" fill="${state.pressed ? '#1f4fb8' : '#2f6fed'}"/>${text(1080, 454, 21, '#ffffff', profile.button)}`;
            if (state.done) {
                main += `<rect x="260" y="520" width="980" height="150" rx="12" fill="${rgbHex(TUTORIAL_COLORS.done)}"/>${text(310, 585, 36, '#ffffff', profile.done, 600)}${text(310, 636, 24, '#e6fff6', profile.result)}`;
            }
        }
    }
    return svg(1280, 720, `<rect width="1280" height="720" fill="#f3f5f8"/><rect width="1280" height="56" fill="#ffffff"/>
    <circle cx="28" cy="28" r="7" fill="#ff5f57"/><circle cx="50" cy="28" r="7" fill="#febc2e"/><circle cx="72" cy="28" r="7" fill="#28c840"/>
    ${text(100, 36, 20, '#1d2633', profile.app)}<rect y="56" width="220" height="664" fill="#e9edf3"/>${nav}${main}`);
}
function waitScreen(turn, profile) {
    const angle = turn * 90;
    return svg(1280, 720, `<rect width="1280" height="720" fill="${rgbHex(TUTORIAL_COLORS.wait)}"/>
    <circle cx="640" cy="300" r="56" fill="none" stroke="#a08850" stroke-width="14"/>
    <path d="M 640 244 A 56 56 0 0 1 696 300" fill="none" stroke="#ffffff" stroke-width="14" transform="rotate(${angle} 640 300)"/>
    <text x="640" y="420" text-anchor="middle" font-family="${FONT}" font-size="34" fill="#ffffff">${escapeXml(profile.button)}…</text>
    <text x="640" y="470" text-anchor="middle" font-family="${FONT}" font-size="22" fill="#e8dcc0">请勿关闭窗口</text>`);
}
const TOAST_TEXT = '新消息 · 示例客户 00000000000：发票已经开好了';
async function seedTutorial(dir, tools, variant = 'baseline') {
    const profile = TUTORIAL_PROFILES[variant];
    const shift = profile.lead - 4;
    const screens = [
        { state: { page: 'home' }, seconds: profile.lead },
        { state: { page: 'general' }, seconds: 4.5 },
        { state: { page: 'backup' }, seconds: 4 },
        { state: { page: 'backup', backupOn: true }, seconds: 3.5 },
        { state: { page: 'backup', backupOn: true, folder: 'D:' }, seconds: 2.5 },
        { state: { page: 'backup', backupOn: true, folder: 'D:\\照片' }, seconds: 2.5 },
        { state: { page: 'backup', backupOn: true, folder: 'D:\\照片\\家庭' }, seconds: 2.5 },
        { state: { page: 'backup', backupOn: true, folder: 'D:\\照片\\家庭', pressed: true }, seconds: 1.5 },
        ...Array.from({ length: profile.wait * 4 }, () => ({ state: 'wait', seconds: 0.25 })),
        { state: { page: 'backup', backupOn: true, folder: 'D:\\照片\\家庭', done: true }, seconds: 6 },
    ];
    const backgrounds = [];
    for (const [index, screen] of screens.entries()) {
        if (variant !== 'baseline' && screen.state !== 'wait' && screen.state.folder && index >= 5) {
            screen.state.folder = index === 5 ? path.win32.dirname(profile.folder) : profile.folder;
        }
        const image = screen.state === 'wait' ? waitScreen(index % 4, profile) : appScreen(screen.state, profile);
        backgrounds.push({ file: await png(path.join(dir, 'work', `screen-${String(index).padStart(2, '0')}.png`), image), seconds: screen.seconds });
    }
    const duration = backgrounds.reduce((sum, item) => sum + item.seconds, 0);
    const cursor = await png(path.join(dir, 'work', 'cursor.png'), svg(28, 40, '<path d="M 2 2 L 2 34 L 10 26 L 16 38 L 22 35 L 16 23 L 26 23 Z" fill="#111111" stroke="#ffffff" stroke-width="2"/>'));
    const toast = await png(path.join(dir, 'work', 'toast.png'), svg(440, 110, `<rect width="440" height="110" rx="12" fill="${rgbHex(TUTORIAL_COLORS.toast)}"/>
    <text x="24" y="44" font-family="${FONT}" font-size="26" font-weight="700" fill="#111111">新消息 · 王丽</text>
    <text x="24" y="86" font-family="${FONT}" font-size="23" font-weight="700" fill="#111111">13812345678：发票已经开好了</text>`));
    const at = (x, y, start, end) => ({ file: cursor, x, y, spans: [{ start, end }] });
    const overlays = [
        at(120, 205, Math.max(0, profile.lead - 1.5), profile.lead), at(410, 120, 6.5 + shift, 8.5 + shift),
        at(1140, 212, 10.5 + shift, 12.5 + shift), at(700, 356, 14.5 + shift, 23.5 + shift),
        at(1140, 440, 23.5 + shift, 25 + shift), at(900, 450, duration - 6, duration),
        { file: toast, x: 820, y: 64, spans: [{ start: 18 + shift, end: 23 + shift }] },
    ];
    const { pcm } = assemble(SPEECH_RATE, [{ pause: duration }], 41, 0.0015);
    const audio = writeWav(path.join(dir, 'work', 'room.wav'), pcm);
    const file = await buildVideo(tools, { width: 1280, height: 720, fps: 25, duration, backgrounds, overlays, audio }, path.join(dir, 'attachments', `${profile.goal}-录屏.mp4`));
    if (profile.width !== 1280 || profile.height !== 720) {
        const resized = path.join(dir, 'work', 'sized.mp4');
        await runMedia(tools.ffmpeg, ['-v', 'error', '-nostdin', '-y', '-i', file, '-vf',
            `scale=${profile.width}:${profile.height}:force_original_aspect_ratio=decrease,pad=${profile.width}:${profile.height}:(ow-iw)/2:(oh-ih)/2:color=0xf3f5f8`,
            '-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'copy', resized]);
        fs.renameSync(resized, file);
    }
    return {
        attachments: [file],
        truth: {
            kind: 'tutorial', file, duration, profile,
            steps: [
                { title: '在左边点「设置」', start: 2.5, end: 4 },
                { title: `切到「${profile.page}」页`, start: 6.5, end: 8.5 },
                { title: `打开「${profile.toggle}」开关；${profile.option}为${profile.optionValue}`, start: 10.5, end: 12.5 },
                { title: '填写备份文件夹 D:\\照片\\家庭', start: 14.5, end: 23.5 },
                { title: `点「${profile.button}」`, start: 23.5, end: 25 },
                { title: `看到「${profile.done}」，${profile.result}`, start: 25 + profile.wait, end: 31 + profile.wait },
            ].map((step, index) => ({ ...step, ...(index === 3 ? { title: `填写${profile.folderLabel} ${profile.folder}` } : {}),
                start: step.start + shift, end: step.end + shift })),
            wait: { start: 25 + shift, end: 25 + shift + profile.wait },
            toast: { start: 18 + shift, end: 23 + shift, text: TOAST_TEXT },
        },
    };
}
const YOGA_FACTS = [
    '松间瑜伽是一家社区瑜伽馆，开在幸福里小区东门，今年是开业第 3 年。',
    '每个班最多 8 个人，老师会逐个帮学员调整动作。',
    '每天早上 7 点有晨练课，晚上 8 点有下班后的舒缓课。',
    '新朋友可以先约一节体验课，到前台或打电话预约。',
];
async function seedBrand(dir) {
    const mat = (x, y, colour) => `<rect x="${x}" y="${y}" width="150" height="420" rx="10" fill="${colour}"/>`;
    const person = (cx, top, shirt, pose) => (pose === 'sit'
        ? `<circle cx="${cx}" cy="${top}" r="34" fill="#f1c7a3"/><path d="M ${cx - 60} ${top + 150} Q ${cx} ${top + 40} ${cx + 60} ${top + 150} Z" fill="${shirt}"/><rect x="${cx - 90}" y="${top + 140}" width="180" height="26" rx="13" fill="${shirt}"/>`
        : `<circle cx="${cx}" cy="${top}" r="34" fill="#f1c7a3"/><rect x="${cx - 30}" y="${top + 36}" width="60" height="150" rx="24" fill="${shirt}"/><line x1="${cx}" y1="${top + 50}" x2="${cx - 90}" y2="${top - 60}" stroke="${shirt}" stroke-width="22" stroke-linecap="round"/><line x1="${cx}" y1="${top + 50}" x2="${cx + 90}" y2="${top - 60}" stroke="${shirt}" stroke-width="22" stroke-linecap="round"/><rect x="${cx - 26}" y="${top + 180}" width="20" height="150" fill="#3d3a46"/><rect x="${cx + 6}" y="${top + 180}" width="20" height="150" fill="#3d3a46"/>`);
    const light = '<defs><linearGradient id="sun" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff4d6"/><stop offset="1" stop-color="#e9c99a"/></linearGradient><linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c89f73"/><stop offset="1" stop-color="#9c7650"/></linearGradient></defs>';
    const pictures = [
        { name: '晨光教室', body: `${light}<rect width="1080" height="1350" fill="url(#sun)"/><rect x="140" y="120" width="800" height="560" fill="#dbeefa" stroke="#ffffff" stroke-width="18"/><rect x="530" y="120" width="18" height="560" fill="#ffffff"/>
      <polygon points="140,680 940,680 1080,1100 0,1100" fill="#fff1c4" opacity="0.45"/><rect y="900" width="1080" height="450" fill="url(#floor)"/>${mat(160, 930, '#7fa88b')}${mat(465, 930, '#c98f7b')}${mat(770, 930, '#8a9fc4')}` },
        { name: '垫子和绿植', body: `${light}<rect width="1080" height="1350" fill="#efe6d6"/><rect y="760" width="1080" height="590" fill="url(#floor)"/>
      ${[0, 1, 2, 3, 4].map((index) => `<rect x="${60 + index * 200}" y="640" width="120" height="120" rx="60" fill="${['#7fa88b', '#c98f7b', '#8a9fc4', '#d8b26a', '#9b86b8'][index]}"/>`).join('')}
      <rect x="820" y="420" width="140" height="200" fill="#b7835a"/><ellipse cx="890" cy="380" rx="150" ry="170" fill="#4f7d4a"/><ellipse cx="160" cy="520" rx="110" ry="140" fill="#5c8c55"/><rect x="110" y="600" width="100" height="160" fill="#a5714c"/>` },
        { name: '小班课', body: `${light}<rect width="1080" height="1350" fill="#f3ead9"/><rect y="820" width="1080" height="530" fill="url(#floor)"/>
      ${person(540, 420, '#3f6e5a', 'stand')}${[0, 1, 2, 3].map((index) => person(150 + index * 260, 860, ['#c98f7b', '#8a9fc4', '#d8b26a', '#9b86b8'][index], 'sit')).join('')}` },
        { name: '门口招牌', body: `<rect width="1080" height="1350" fill="#d9e4dd"/><rect x="120" y="260" width="840" height="900" fill="#f6f1e7"/><rect x="120" y="260" width="840" height="200" fill="#3f6e5a"/>
      <text x="540" y="390" text-anchor="middle" font-family="${FONT}" font-size="110" fill="#f6f1e7">松间瑜伽</text><rect x="420" y="640" width="240" height="520" fill="#8a6a4a"/><circle cx="630" cy="900" r="12" fill="#e0c060"/>
      <text x="540" y="560" text-anchor="middle" font-family="${FONT}" font-size="44" fill="#3f6e5a">幸福里小区东门</text><rect y="1160" width="1080" height="190" fill="#9aa59c"/>` },
    ];
    const photos = [];
    for (const [index, picture] of pictures.entries()) {
        photos.push(await png(path.join(dir, 'attachments', `松间瑜伽-${String(index + 1).padStart(2, '0')}-${picture.name}.png`), svg(1080, 1350, picture.body)));
    }
    const notes = path.join(dir, 'attachments', '松间瑜伽-店铺资料.md');
    fs.writeFileSync(notes, ['# 松间瑜伽 店铺资料', '', ...YOGA_FACTS.map((fact) => `- ${fact}`), ''].join('\n'), 'utf8');
    return { attachments: [...photos, notes], truth: { kind: 'brand', name: '松间瑜伽', facts: YOGA_FACTS, photos, numbers: [0, 3, 7, 8, 20] } };
}
const rgb = (colour) => `rgb(${colour.join(',')})`;
function banded(width, height, colours, middle, overTop = '', overBottom = '') {
    const band = Math.round(height * 0.24);
    return svg(width, height, `<rect width="${width}" height="${height}" fill="#f3e2c7"/>${middle}`
        + `<rect width="${width}" height="${band}" fill="${rgb(colours[0])}"/>${overTop}`
        + `<rect y="${height - band}" width="${width}" height="${band}" fill="${rgb(colours[1])}"/>${overBottom}`);
}
const STOCK_SCENES = [
    { slug: 'city-street-sunrise', role: 'scene', label: 'a city street at sunrise', author: 'MorningReel',
        tags: ['city', 'street', 'sunrise', 'morning', 'dawn', 'urban', 'road', 'buildings', 'early', 'sky'], colours: [[250, 140, 0], [150, 40, 230]],
        overTop: () => '<circle cx="1050" cy="330" r="110" fill="#ffe7a0"/>',
        middle: (width) => Array.from({ length: 8 }, (_item, index) => `<rect x="${index * width / 8 + 10}" y="${560 + (index % 3) * 90}" width="${width / 8 - 20}" height="${900 - (index % 3) * 90}" fill="${index % 2 ? '#5a5a66' : '#77778a'}"/>`
            + Array.from({ length: 5 }, (_row, row) => `<rect x="${index * width / 8 + 40}" y="${660 + (index % 3) * 90 + row * 140}" width="${width / 8 - 80}" height="60" fill="#ffe9b8"/>`).join('')).join(''),
        overBottom: (width) => Array.from({ length: 6 }, (_item, index) => `<rect x="${index * width / 6 + 60}" y="1680" width="${width / 12}" height="24" fill="#ffffff"/>`).join('') },
    { slug: 'roasted-coffee-beans', role: 'scene', label: 'roasted coffee beans, close up', author: 'BeanMacro',
        tags: ['coffee', 'bean', 'beans', 'roasted', 'roasting', 'espresso', 'closeup', 'aroma', 'dark', 'arabica'], colours: [[160, 80, 0], [20, 190, 60]],
        middle: (width) => `<rect y="400" width="${width}" height="1120" fill="#3b2316"/>` + Array.from({ length: 48 }, (_item, index) => {
            const x = 80 + (index % 8) * (width - 160) / 7;
            const y = 560 + Math.floor(index / 8) * 160;
            return `<ellipse cx="${x}" cy="${y}" rx="58" ry="78" fill="#6e3d1e" transform="rotate(${(index * 47) % 120} ${x} ${y})"/><path d="M ${x} ${y - 60} Q ${x + 18} ${y} ${x} ${y + 60}" stroke="#2a160c" stroke-width="10" fill="none"/>`;
        }).join('') },
    { slug: 'latte-art-cup', role: 'scene', label: 'latte art in a cup, seen from above', author: 'FoamLab',
        tags: ['latte', 'art', 'coffee', 'cup', 'milk', 'foam', 'cappuccino', 'drink', 'heart', 'barista'], colours: [[0, 170, 150], [250, 70, 130]],
        middle: (width) => `<rect y="400" width="${width}" height="1120" fill="#e9dcc7"/><circle cx="${width / 2}" cy="960" r="340" fill="#ffffff"/><circle cx="${width / 2}" cy="960" r="270" fill="#f3e9da"/>`
            + `<circle cx="${width / 2}" cy="960" r="230" fill="#9a5e32"/><path d="M ${width / 2} 1100 C ${width / 2 - 210} 960 ${width / 2 - 100} 800 ${width / 2} 900 C ${width / 2 + 100} 800 ${width / 2 + 210} 960 ${width / 2} 1100 Z" fill="#f6eee2"/>` },
    { slug: 'friends-coffee-cafe', role: 'people', label: 'two friends chatting over coffee at a cafe table', author: 'CityFolk',
        tags: ['people', 'friends', 'cafe', 'coffee', 'chatting', 'drinking', 'table', 'talking', 'lifestyle', 'women'], colours: [[240, 230, 30], [30, 120, 250]],
        middle: (width) => `<rect y="400" width="${width}" height="1120" fill="#efe2c8"/><rect x="${width / 2 - 420}" y="1120" width="840" height="60" fill="#8a6a4a"/>`
            + [width / 2 - 260, width / 2 + 260].map((cx, index) => `<circle cx="${cx}" cy="760" r="90" fill="#f0c6a2"/><rect x="${cx - 120}" y="860" width="240" height="280" rx="60" fill="${index ? '#c0504d' : '#4d7cc0'}"/>`
                + `<rect x="${cx + (index ? -160 : 100)}" y="1050" width="60" height="70" rx="10" fill="#ffffff"/>`).join('') },
    { slug: 'cafe-storefront', role: 'other-shop', label: 'the storefront of another cafe, BEAN HOUSE', author: 'StreetFront',
        tags: ['coffee', 'shop', 'cafe', 'storefront', 'store', 'front', 'exterior', 'facade', 'sign', 'entrance', 'street'], colours: [[140, 230, 30], [140, 0, 50]],
        overTop: (width) => `<text x="${width / 2}" y="290" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="104" fill="#1d2b12">BEAN HOUSE</text>`,
        middle: (width) => `<rect y="400" width="${width}" height="1120" fill="#d8cdbb"/><rect x="${width / 2 - 340}" y="560" width="360" height="620" fill="#b9d8e8" stroke="#3a3a3a" stroke-width="16"/>`
            + `<rect x="${width / 2 + 70}" y="520" width="260" height="940" fill="#4a3a2a"/><circle cx="${width / 2 + 300}" cy="1000" r="18" fill="#e0c060"/>` },
    { slug: 'laptop-office-desk', role: 'unrelated', label: 'a laptop on an office desk', author: 'DeskStock',
        tags: ['office', 'laptop', 'desk', 'work', 'business', 'computer', 'typing', 'workspace', 'notebook'], colours: [[0, 210, 250], [120, 140, 0]],
        middle: (width) => `<rect y="400" width="${width}" height="1120" fill="#e6e6ea"/><rect x="${width / 2 - 320}" y="800" width="640" height="420" rx="24" fill="#2e3440"/>`
            + `<rect x="${width / 2 - 290}" y="830" width="580" height="360" fill="#8fb0d8"/><rect x="${width / 2 - 360}" y="1230" width="720" height="50" rx="20" fill="#b8bcc6"/>` },
];
const SHOP = '山茶咖啡';
const SHOP_PHOTOS = [
    { name: '门头', label: `the user's own shop front: ${SHOP} on a red awning`, colours: [[230, 30, 30], [90, 0, 120]],
        overTop: `<text x="540" y="230" text-anchor="middle" font-family="${FONT}" font-size="130" fill="#ffffff">${SHOP}</text>`,
        middle: '<rect y="300" width="1080" height="760" fill="#efe6d6"/><rect x="100" y="400" width="480" height="560" fill="#cfe3ee" stroke="#5b4636" stroke-width="18"/>'
            + '<circle cx="250" cy="760" r="60" fill="#ffffff"/><circle cx="420" cy="760" r="60" fill="#ffffff"/><rect x="660" y="380" width="300" height="680" fill="#6b4a32"/><circle cx="920" cy="740" r="16" fill="#e0c060"/>' },
    { name: '吧台', label: `the counter inside ${SHOP}, with its espresso machine`, colours: [[235, 40, 200], [60, 30, 210]],
        overTop: `<rect x="390" y="90" width="300" height="140" rx="16" fill="#ffffff"/><text x="540" y="185" text-anchor="middle" font-family="${FONT}" font-size="64" fill="#7a2e2e">${SHOP}</text>`,
        middle: '<rect y="300" width="1080" height="760" fill="#f2eadc"/><rect x="300" y="560" width="480" height="420" rx="30" fill="#c9ced3"/><rect x="360" y="620" width="360" height="140" fill="#2b3036"/>'
            + '<rect x="470" y="800" width="140" height="120" fill="#3a3f45"/><rect x="120" y="880" width="100" height="120" rx="12" fill="#ffffff"/><rect x="860" y="880" width="100" height="120" rx="12" fill="#ffffff"/>' },
];
export const PET_SITE_FACTS = ['按地区、科别和 24 小时急诊筛选宠物医院', '结果可以在列表和地图之间切换', '注册会员后可以查看自己毛孩的资料'];
async function seedSiteShots(dir) {
    const W = 750;
    const H = 1334;
    const text = (x, y, size, colour, value, anchor = 'start', weight = 400) => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${colour}">${escapeXml(value)}</text>`;
    const bar = `<rect width="${W}" height="120" fill="#2f8f83"/>${text(40, 80, 40, '#ffffff', '宠医通', 'start', 700)}${text(W - 40, 80, 26, '#e6f4f1', '登录 / 注册', 'end')}`;
    const chip = (x, label, on = false) => `<rect x="${x}" y="470" width="190" height="64" rx="32" fill="${on ? '#2f8f83' : '#ffffff'}" stroke="#2f8f83" stroke-width="3"/>${text(x + 95, 512, 26, on ? '#ffffff' : '#2f8f83', label, 'middle')}`;
    const clinic = (y, name, distance, tags) => `<rect x="30" y="${y}" width="${W - 60}" height="190" rx="20" fill="#ffffff"/><rect x="56" y="${y + 30}" width="130" height="130" rx="16" fill="#cfe7e2"/>
     <circle cx="121" cy="${y + 95}" r="34" fill="#2f8f83"/>${text(214, y + 70, 32, '#1f2d2b', name, 'start', 700)}${text(214, y + 116, 24, '#5b6b68', distance)}${text(214, y + 156, 24, '#2f8f83', tags)}`;
    const screens = [
        { name: '首页', body: `<rect width="${W}" height="${H}" fill="#f2f7f6"/>${bar}
      ${text(W / 2, 270, 52, '#1f2d2b', '找附近的宠物医院', 'middle', 700)}${text(W / 2, 330, 28, '#5b6b68', '按地区、科别和 24 小时急诊筛选', 'middle')}
      <rect x="40" y="380" width="${W - 80}" height="70" rx="35" fill="#ffffff" stroke="#c4d8d4" stroke-width="3"/>${text(80, 425, 26, '#8a9a97', '输入地区或医院名称')}
      ${chip(40, '地区', true)}${chip(280, '科别')}${chip(520, '24 小时')}
      <rect x="40" y="600" width="${W - 80}" height="560" rx="24" fill="#ffffff"/><circle cx="${W / 2}" cy="820" r="150" fill="#e3f1ee"/>
      <ellipse cx="${W / 2 - 40}" cy="840" rx="70" ry="60" fill="#e9b97a"/><circle cx="${W / 2 + 40}" cy="770" r="50" fill="#e9b97a"/><circle cx="${W / 2 + 25}" cy="760" r="8" fill="#2a2a2a"/>
      ${text(W / 2, 1060, 30, '#1f2d2b', '全城宠物医院，一次查清', 'middle')}` },
        { name: '查询结果', body: `<rect width="${W}" height="${H}" fill="#f2f7f6"/>${bar}
      ${text(40, 200, 30, '#1f2d2b', '朝阳区 · 内科 · 24 小时', 'start', 700)}
      <rect x="${W - 260}" y="160" width="220" height="56" rx="28" fill="#ffffff" stroke="#2f8f83" stroke-width="3"/>${text(W - 205, 197, 24, '#2f8f83', '列表', 'middle')}${text(W - 95, 197, 24, '#8a9a97', '地图', 'middle')}
      ${clinic(250, '安心动物医院', '1.2 公里', '内科 · 24 小时急诊')}${clinic(460, '毛毛宠物诊所', '2.0 公里', '内科 · 外科')}${clinic(670, '阳光动物医院', '2.6 公里', '内科 · 24 小时急诊')}${clinic(880, '小爪宠物医院', '3.1 公里', '内科 · 牙科')}` },
        { name: '我的毛孩', body: `<rect width="${W}" height="${H}" fill="#f2f7f6"/>${bar}
      ${text(40, 200, 34, '#1f2d2b', '我的毛孩', 'start', 700)}
      <rect x="30" y="240" width="${W - 60}" height="300" rx="24" fill="#ffffff"/><circle cx="150" cy="390" r="90" fill="#f0d9b5"/><circle cx="125" cy="370" r="10" fill="#2a2a2a"/><circle cx="175" cy="370" r="10" fill="#2a2a2a"/>
      ${text(280, 350, 38, '#1f2d2b', '豆豆', 'start', 700)}${text(280, 400, 26, '#5b6b68', '柯基 · 3 岁')}${text(280, 450, 26, '#5b6b68', '已绝育 · 9.8 公斤')}
      <rect x="30" y="580" width="${W - 60}" height="520" rx="24" fill="#ffffff"/>${text(60, 640, 30, '#1f2d2b', '毛孩资料', 'start', 700)}
      ${['疫苗记录', '体检记录', '过敏与用药'].map((row, index) => `<rect x="60" y="${680 + index * 130}" width="${W - 120}" height="100" rx="16" fill="#eef6f4"/>${text(90, 742 + index * 130, 28, '#1f2d2b', row)}${text(W - 90, 742 + index * 130, 28, '#2f8f83', '查看', 'end')}`).join('')}` },
    ];
    const shots = [];
    for (const [index, screen] of screens.entries()) {
        shots.push(await png(path.join(dir, 'attachments', `宠医通截图-${String(index + 1).padStart(2, '0')}-${screen.name}.png`), svg(W, H, screen.body)));
    }
    return { attachments: shots, truth: { kind: 'promo', name: '宠医通', facts: PET_SITE_FACTS, shots } };
}
export const BOOKING_FACTS = ['选好日期、人数和时段就能在线订座', '每个时段还有没有位一眼就能看到', '订好后到店报手机尾号直接入座，开餐前 1 小时会提醒'];
async function seedBookingShots(dir) {
    const W = 750;
    const H = 1334;
    const text = (x, y, size, colour, value, anchor = 'start', weight = 400) => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${colour}">${escapeXml(value)}</text>`;
    const bar = `<rect width="${W}" height="120" fill="#e8743b"/>${text(40, 80, 40, '#ffffff', '好味订', 'start', 700)}${text(W - 40, 80, 26, '#fde8dc', '我的订座', 'end')}`;
    const pill = (x, y, w, label, on = false) => `<rect x="${x}" y="${y}" width="${w}" height="72" rx="36" fill="${on ? '#e8743b' : '#ffffff'}" stroke="#e8743b" stroke-width="3"/>${text(x + w / 2, y + 47, 28, on ? '#ffffff' : '#e8743b', label, 'middle')}`;
    const slot = (y, time, open) => `<rect x="40" y="${y}" width="${W - 80}" height="120" rx="20" fill="${open ? '#ffffff' : '#f1ece8'}"/>${text(80, y + 74, 40, open ? '#2b2220' : '#a59a94', time, 'start', 700)}
     ${text(W - 80, y + 74, 28, open ? '#2f9e5b' : '#a59a94', open ? '有位 · 可订' : '已订满', 'end')}`;
    const screens = [
        { name: '选人数时间', body: `<rect width="${W}" height="${H}" fill="#fbf5f1"/>${bar}
      <rect x="30" y="160" width="${W - 60}" height="260" rx="24" fill="#ffffff"/><rect x="60" y="190" width="200" height="200" rx="18" fill="#f6c9ad"/>
      <circle cx="160" cy="290" r="60" fill="#e8743b"/>${text(290, 250, 38, '#2b2220', '老街小馆', 'start', 700)}${text(290, 300, 26, '#7b6d66', '家常菜 · 人均 85')}${text(290, 345, 26, '#7b6d66', '步行 6 分钟')}
      ${text(40, 500, 32, '#2b2220', '几位用餐', 'start', 700)}${pill(40, 530, 150, '2 人')}${pill(210, 530, 150, '4 人', true)}${pill(380, 530, 150, '6 人')}
      ${text(40, 690, 32, '#2b2220', '哪天来', 'start', 700)}${pill(40, 720, 200, '今天')}${pill(260, 720, 230, '周六 11/29', true)}${pill(510, 720, 200, '周日')}
      <rect x="40" y="1120" width="${W - 80}" height="110" rx="55" fill="#e8743b"/>${text(W / 2, 1190, 36, '#ffffff', '查看可订时段', 'middle', 700)}` },
        { name: '可订时段', body: `<rect width="${W}" height="${H}" fill="#fbf5f1"/>${bar}
      ${text(40, 200, 32, '#2b2220', '老街小馆 · 周六 11/29 · 4 人', 'start', 700)}
      ${slot(250, '17:30', true)}${slot(400, '18:00', true)}${slot(550, '18:30', false)}${slot(700, '19:00', true)}${slot(850, '19:30', false)}
      <rect x="40" y="1120" width="${W - 80}" height="110" rx="55" fill="#e8743b"/>${text(W / 2, 1190, 36, '#ffffff', '订 18:00 这一桌', 'middle', 700)}` },
        { name: '订座成功', body: `<rect width="${W}" height="${H}" fill="#fbf5f1"/>${bar}
      <circle cx="${W / 2}" cy="330" r="110" fill="#2f9e5b"/><path d="M ${W / 2 - 50} 330 l 35 38 l 70 -80" stroke="#ffffff" stroke-width="22" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      ${text(W / 2, 520, 48, '#2b2220', '订座成功', 'middle', 700)}${text(W / 2, 580, 30, '#7b6d66', '老街小馆 · 周六 11/29 18:00 · 4 人', 'middle')}
      <rect x="40" y="660" width="${W - 80}" height="300" rx="24" fill="#ffffff"/>
      ${text(80, 740, 30, '#2b2220', '到店报手机尾号 6688，直接入座', 'start', 700)}${text(80, 810, 28, '#7b6d66', '开餐前 1 小时会提醒你')}${text(80, 880, 28, '#7b6d66', '临时有事可在「我的订座」取消')}` },
    ];
    const shots = [];
    for (const [index, screen] of screens.entries()) {
        shots.push(await png(path.join(dir, 'attachments', `好味订截图-${String(index + 1).padStart(2, '0')}-${screen.name}.png`), svg(W, H, screen.body)));
    }
    return { attachments: shots, truth: { kind: 'promo', name: '好味订', facts: BOOKING_FACTS, shots } };
}
export const LEDGER_FACTS = ['上传发票照片后自动识别金额、日期和商户', '识别结果确认后直接入账', '月底一键导出报销报表（Excel）'];
async function seedLedgerShots(dir) {
    const W = 1440;
    const H = 900;
    const text = (x, y, size, colour, value, anchor = 'start', weight = 400) => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${colour}">${escapeXml(value)}</text>`;
    const side = `<rect width="220" height="${H}" fill="#1f3a5f"/>${text(32, 64, 30, '#ffffff', '账小智', 'start', 700)}
    ${['报销单', '识别', '报表', '设置'].map((item, index) => text(32, 150 + index * 60, 22, index === 0 ? '#ffffff' : '#9fb3cc', item)).join('')}`;
    const button = (x, y, w, label) => `<rect x="${x}" y="${y}" width="${w}" height="56" rx="10" fill="#2f6fde"/>${text(x + w / 2, y + 37, 22, '#ffffff', label, 'middle', 700)}`;
    const row = (y, cells) => cells.map((cell, index) => text(270 + index * 260, y, 22, '#2a3443', cell)).join('')
        + `<rect x="250" y="${y + 18}" width="${W - 300}" height="2" fill="#e3e8ef"/>`;
    const screens = [
        { name: '报销单列表', body: `<rect width="${W}" height="${H}" fill="#f4f6f9"/>${side}
      ${text(270, 80, 34, '#1f2a37', '11 月报销单', 'start', 700)}${button(W - 260, 44, 200, '上传票据')}
      <rect x="250" y="130" width="${W - 300}" height="680" rx="14" fill="#ffffff"/>
      ${row(190, ['日期', '商户', '类别', '金额'])}${row(260, ['11-03', '城南文具', '办公用品', '¥ 126.00'])}${row(330, ['11-07', '快达物流', '快递费', '¥ 48.00'])}
      ${row(400, ['11-12', '老街小馆', '餐费', '¥ 268.00'])}${row(470, ['11-18', '城际高铁', '差旅', '¥ 553.50'])}` },
        { name: '自动识别', body: `<rect width="${W}" height="${H}" fill="#f4f6f9"/>${side}
      ${text(270, 80, 34, '#1f2a37', '票据识别', 'start', 700)}
      <rect x="270" y="130" width="440" height="660" rx="14" fill="#ffffff"/><rect x="310" y="170" width="360" height="580" fill="#fbfbf7" stroke="#d9d9cf" stroke-width="2"/>
      ${text(490, 230, 26, '#555', '增值税普通发票', 'middle', 700)}${['老街小馆', '2026-11-12', '餐饮服务', '合计 ¥268.00'].map((line, index) => text(340, 300 + index * 60, 22, '#666', line)).join('')}
      <rect x="760" y="130" width="620" height="660" rx="14" fill="#ffffff"/>${text(800, 190, 26, '#1f2a37', '已自动识别', 'start', 700)}
      ${[['金额', '¥ 268.00'], ['日期', '2026-11-12'], ['商户', '老街小馆'], ['类别', '餐费']].map(([key, value], index) => `${text(800, 270 + index * 90, 22, '#7a8699', key)}<rect x="900" y="${235 + index * 90}" width="420" height="54" rx="8" fill="#eef4ff"/>${text(920, 270 + index * 90, 24, '#1f2a37', value, 'start', 700)}`).join('')}
      ${button(800, 700, 240, '确认入账')}` },
        { name: '月度报表', body: `<rect width="${W}" height="${H}" fill="#f4f6f9"/>${side}
      ${text(270, 80, 34, '#1f2a37', '11 月报销报表', 'start', 700)}${button(W - 300, 44, 240, '导出 Excel')}
      <rect x="250" y="130" width="${W - 300}" height="680" rx="14" fill="#ffffff"/>
      ${[['办公用品', 126, '#2f6fde'], ['快递费', 48, '#5aa0f2'], ['餐费', 268, '#f2a65a'], ['差旅', 553.5, '#3fb37f']].map(([label, value, colour], index) => `<rect x="${330 + index * 240}" y="${700 - Number(value)}" width="140" height="${Number(value)}" fill="${colour}"/>${text(400 + index * 240, 750, 22, '#2a3443', String(label), 'middle')}`).join('')}
      ${text(W - 120, 200, 26, '#1f2a37', '合计 ¥ 995.50', 'end', 700)}` },
    ];
    const shots = [];
    for (const [index, screen] of screens.entries()) {
        shots.push(await png(path.join(dir, 'attachments', `账小智截图-${String(index + 1).padStart(2, '0')}-${screen.name}.png`), svg(W, H, screen.body)));
    }
    return { attachments: shots, truth: { kind: 'promo', name: '账小智', facts: LEDGER_FACTS, shots } };
}
function seedServiceBrief() {
    return { attachments: [], truth: { kind: 'promo', name: '中小企业定制 AI Agent 服务', facts: ['自动回复客户咨询', '把有意向的客户整理成销售线索'], shots: [] } };
}
async function seedLecture(dir, tools) {
    const script = [
        { id: 'topic', text: '今天讲《战国策》里的一段故事：楚国大败之后，有人去劝秦国的相国魏冉。' },
        { id: 'setting', text: '那时候秦国刚刚打败楚国，魏冉权势正盛，想乘胜再进一步。' },
        { id: 'warning', text: '说客提醒他，齐国和魏国都在一旁看着，秦国不能只盯着眼前的胜利。' },
        { id: 'risk', text: '把楚国逼得太紧，诸侯就会联合起来，一起对付秦国。' },
        { id: 'advice', text: '所以聪明的做法，是见好就收，给对手留一点余地。' },
        { id: 'today', text: '放到今天的职场和家里也一样：赢了一次，别把人逼到墙角。' },
        { id: 'close', text: '给别人留一步，也是给自己留一条路。' },
    ];
    const pieces = [{ pause: 0.6 }];
    for (const line of script)
        pieces.push({ pcm: await speak(line.text, VOICE_FEMALE, SPEECH_RATE) }, { pause: 0.7 });
    const { pcm, spans } = assemble(SPEECH_RATE, pieces, 29);
    for (const span of spans) {
        for (let index = Math.floor(span.start * SPEECH_RATE); index < Math.min(pcm.samples.length, Math.ceil(span.end * SPEECH_RATE)); index += 1) {
            pcm.samples[index] += 0.02 * Math.sin(2 * Math.PI * LECTURE_PILOT_HZ * index / SPEECH_RATE);
        }
    }
    const audio = writeWav(path.join(dir, 'work', 'lecture.wav'), pcm);
    const duration = pcm.samples.length / SPEECH_RATE;
    const size = 220;
    const background = await png(path.join(dir, 'work', 'lecture.png'), svg(1280, 720, `
    <rect width="1280" height="720" fill="#e8e1d4"/><rect x="780" y="90" width="380" height="460" fill="#cbbfa8"/>
    ${[0, 1, 2, 3, 4].map((index) => `<rect x="${800 + index * 72}" y="${120 + (index % 2) * 10}" width="52" height="400" fill="${['#8a5a3b', '#5f6d4e', '#7a3f35', '#4c5a6e', '#9b7a4a'][index]}"/>`).join('')}
    <rect y="560" width="1280" height="160" fill="#b9a98c"/>${figure(470, 150, size, '#3e4a5c', '#2b211b')}`));
    const lines = script.map((line, index) => ({ id: line.id, speaker: 'presenter', text: line.text, ...roundSpan(spans[index]) }));
    const file = await buildVideo(tools, {
        width: 1280, height: 720, fps: 25, duration,
        backgrounds: [{ file: background, seconds: duration }],
        mouths: [{ rect: mouthRect(470, 150, size), spans: lines }],
        audio,
    }, path.join(dir, 'attachments', '战国策讲解原片.mp4'));
    return { attachments: [file], truth: { kind: 'lecture', file, lines, names: ['战国策', '楚国', '秦国', '魏冉', '齐国', '魏国'], pilotHz: LECTURE_PILOT_HZ } };
}
async function seedLongTalk(dir, tools) {
    const script = [
        '今天聊聊小店怎么做回头客，这是我开面包店第五年最大的体会。',
        '很多人开店，第一件事是想着怎么拉新客，发传单、做团购、打折。',
        '可是新客来一次就走，成本高，留不住，算下来其实是亏的。',
        '真正让小店活下来的，是那些一周来两三次的老顾客。',
        '我统计过，我们店七成的营业额，来自三成的熟客。',
        '所以第一件事，是记住人。记住名字，记住口味，记住他常买什么。',
        '一位阿姨每周三来买全麦面包，有一次我们提前给她留好，她特别高兴。',
        '这种被记住的感觉，比任何折扣都管用。',
        '第二件事，是给熟客一个回来的理由。',
        '我们每周二出一款新品，只在店里卖，熟客都会专门来尝。',
        '新品不用多，一周一款就够，关键是让人有期待。',
        '第三件事，是把会员做简单。',
        '我们不搞复杂的积分，买满十次送一次，一张卡片就能看明白。',
        '规则越简单，顾客越愿意参与，店员也不容易出错。',
        '第四件事，是处理好投诉。',
        '有一次面包烤糊了，顾客很生气，我们当场退钱，又送了一个新出炉的。',
        '后来他成了我们最忠实的顾客，还带了好几个朋友来。',
        '投诉其实是机会，处理好了，顾客反而更信任你。',
        '还有一点，投诉之后一定要回访，过几天问一句，上次的面包怎么样。',
        '顾客会觉得，这家店是真的把他的事放在心上。',
        '第五件事，是让店里有人情味。',
        '下雨天我们会在门口放几把伞，谁需要就拿走，下次还回来就行。',
        '伞没丢几把，倒是多了很多聊天的机会。',
        '我们还在收银台旁边放了一块小黑板，写每天的天气和一句问候。',
        '很多顾客会停下来看一眼，顺手跟店员聊两句，店里一下子就热闹了。',
        '这些事都不花什么钱，但顾客记得住，也愿意跟朋友讲。',
        '最后说一句，回头客不是靠一次活动做出来的，是靠每天的小事攒出来的。',
        '记住人、给理由、规则简单、认真对待投诉、有一点人情味。',
        '做好这五件事，小店就有了自己的底气。',
    ].map((text, index) => ({ id: `line-${index + 1}`, text }));
    const pieces = [{ pause: 0.6 }];
    for (const line of script)
        pieces.push({ pcm: await speak(line.text, VOICE_FEMALE, SPEECH_RATE) }, { pause: 0.7 });
    const { pcm, spans } = assemble(SPEECH_RATE, pieces, 31);
    for (const span of spans) {
        for (let index = Math.floor(span.start * SPEECH_RATE); index < Math.min(pcm.samples.length, Math.ceil(span.end * SPEECH_RATE)); index += 1) {
            pcm.samples[index] += 0.02 * Math.sin(2 * Math.PI * LECTURE_PILOT_HZ * index / SPEECH_RATE);
        }
    }
    const audio = writeWav(path.join(dir, 'work', 'long-talk.wav'), pcm);
    const duration = pcm.samples.length / SPEECH_RATE;
    const size = 220;
    const background = await png(path.join(dir, 'work', 'long-talk.png'), svg(1280, 720, `
    <rect width="1280" height="720" fill="#efe6da"/><rect x="760" y="110" width="420" height="300" rx="12" fill="#d9c3a5"/>
    ${[0, 1, 2].map((index) => `<ellipse cx="${840 + index * 130}" cy="300" rx="52" ry="34" fill="${['#c98b4a', '#b3743a', '#d9a066'][index]}"/>`).join('')}
    <rect y="560" width="1280" height="160" fill="#c7b394"/>${figure(470, 150, size, '#6b4f3a', '#2b211b')}`));
    const lines = script.map((line, index) => ({ id: line.id, speaker: 'presenter', text: line.text, ...roundSpan(spans[index]) }));
    const file = await buildVideo(tools, {
        width: 1280, height: 720, fps: 25, duration,
        backgrounds: [{ file: background, seconds: duration }],
        mouths: [{ rect: mouthRect(470, 150, size), spans: lines }],
        audio,
    }, path.join(dir, 'attachments', '小店回头客分享原片.mp4'));
    return { attachments: [file], truth: { kind: 'lecture', file, lines, names: [], pilotHz: LECTURE_PILOT_HZ } };
}
function seedLongBrief(dir) {
    const sourceText = [
        '# 新员工报销流程要点（行政部整理）',
        '',
        '1. 什么能报：因公产生的交通、差旅住宿、业务招待、办公用品和快递费。个人消费不能报。',
        '2. 票据要求：必须是开给公司抬头的发票，抬头和税号要写对；收据、小票不能代替发票。',
        '3. 时间要求：费用发生后 30 天内提交，超过 30 天需要部门负责人另外签字说明。',
        '4. 怎么提交：在「账小智」里新建报销单，拍照上传发票，系统会识别金额和日期，核对无误后提交。',
        '5. 审批顺序：先由直属主管审批，再由财务复核；金额超过 2000 元还要部门负责人审批。',
        '6. 到账时间：财务复核通过后，每月 10 日和 25 日统一打款到工资卡。',
        '7. 常见退回原因：发票抬头错误、金额与发票不符、缺少出差审批单、同一张发票重复提交。',
        '8. 有问题找谁：报销规则问行政部，系统操作问 IT，打款进度问财务。',
        '',
        '以上是全部规则；没有列出的情况一律先问行政部。',
    ].join('\n');
    const file = path.join(dir, 'attachments', '新员工报销流程要点.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, sourceText, 'utf8');
    return { attachments: [file], truth: { kind: 'explainer', file, sourceText } };
}
const FOOTAGE_TAP = [0, 179, 164];
const FOOTAGE_HZ = 10400;
const FOOTAGE_FACTS = ['NFC 金属名片', '卡片碰一下手机，手机上就弹出个人名片'];
async function seedProductFootage(dir, tools) {
    const stamp = (index) => `<text x="36" y="58" font-family="sans-serif" font-size="34" fill="#ffffff" opacity="0.9">FACTORY CAM 0${index + 1}</text>
    <text x="1564" y="690" text-anchor="end" font-family="sans-serif" font-size="30" fill="#ffffff" opacity="0.85">LINEWORKS</text>`;
    const metalCard = (x, y, w, h, angle = 0) => `<g transform="rotate(${angle} ${x + w / 2} ${y + h / 2})">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h * 0.08}" fill="#b8bcc2"/>
    ${Array.from({ length: 14 }, (_item, index) => `<rect x="${x}" y="${y + index * (h / 14)}" width="${w}" height="${h / 28}" fill="#cfd3d8" opacity="0.7"/>`).join('')}
    <text x="${x + w * 0.08}" y="${y + h * 0.3}" font-family="sans-serif" font-size="${h * 0.14}" fill="#3b4048">LENA PARK</text>
    <circle cx="${x + w * 0.85}" cy="${y + h * 0.72}" r="${h * 0.1}" fill="none" stroke="#3b4048" stroke-width="4"/></g>`;
    const phone = (x, y, contact) => `<rect x="${x}" y="${y}" width="240" height="440" rx="34" fill="#1d2228"/>
    <rect x="${x + 14}" y="${y + 40}" width="212" height="360" rx="12" fill="${contact ? '#f4f6f7' : '#2c333b'}"/>
    ${contact ? `<rect x="${x + 28}" y="${y + 120}" width="184" height="170" rx="14" fill="${rgb(FOOTAGE_TAP)}"/>
      <text x="${x + 120}" y="${y + 190}" text-anchor="middle" font-family="sans-serif" font-size="26" fill="#ffffff">Lena Park</text>
      <text x="${x + 120}" y="${y + 230}" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#ffffff">Sales Director</text>` : ''}`;
    const scenes = [
        { name: '生产线', frames: [`<rect width="1600" height="720" fill="#5d6670"/><rect y="430" width="1600" height="120" fill="#2f353b"/>
      ${Array.from({ length: 9 }, (_item, index) => metalCard(60 + index * 180, 380, 150, 90)).join('')}<rect y="550" width="1600" height="170" fill="#3d444b"/>`] },
        { name: '金属拉丝特写', frames: [`<rect width="1600" height="720" fill="#20252b"/>${metalCard(300, 140, 1000, 440, -6)}`] },
        { name: '碰一下手机', frames: [
                `<rect width="1600" height="720" fill="#e9e4dc"/><rect y="560" width="1600" height="160" fill="#a88b6c"/>${phone(760, 150, false)}${metalCard(420, 120, 300, 180, -18)}`,
                `<rect width="1600" height="720" fill="#e9e4dc"/><rect y="560" width="1600" height="160" fill="#a88b6c"/>${phone(760, 150, true)}${metalCard(600, 470, 300, 180, -8)}`,
            ] },
        { name: '包装', frames: [`<rect width="1600" height="720" fill="#d8d2c8"/><rect x="520" y="150" width="560" height="380" rx="10" fill="#15181c"/>
      <text x="800" y="360" text-anchor="middle" font-family="sans-serif" font-size="54" fill="#c9ccd0">METAL CARD</text><rect y="560" width="1600" height="160" fill="#b2a693"/>`] },
    ];
    const clips = [];
    for (const [index, scene] of scenes.entries()) {
        const pictures = [];
        for (const [frame, body] of scene.frames.entries()) {
            pictures.push(await png(path.join(dir, 'work', `footage-${index}-${frame}.png`), svg(1600, 720, `${body}${stamp(index)}`)));
        }
        const rate = 44100;
        const random = prng(400 + index);
        const samples = new Float32Array(rate * 4);
        for (let sample = 0; sample < samples.length; sample += 1)
            samples[sample] = 0.03 * Math.sin(2 * Math.PI * FOOTAGE_HZ * sample / rate) + (random() * 2 - 1) * 0.004;
        const sound = writeWav(path.join(dir, 'work', `footage-${index}.wav`), { rate, samples });
        const out = path.join(dir, 'later', `名片素材-${String(index + 1).padStart(2, '0')}-${scene.name}.mp4`);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        const each = 4 / pictures.length;
        const inputs = pictures.flatMap((picture) => ['-loop', '1', '-framerate', '30', '-t', String(each), '-i', picture]);
        const panned = pictures.map((_picture, frame) => `[${frame}:v]crop=1280:720:x='${frame * 120}+t*60':y=0,setsar=1,format=yuv420p[p${frame}]`);
        const filter = `${panned.join(';')};${pictures.map((_picture, frame) => `[p${frame}]`).join('')}concat=n=${pictures.length}:v=1:a=0[v]`;
        await runMedia(tools.ffmpeg, ['-v', 'error', '-nostdin', '-y', ...inputs, '-i', sound, '-filter_complex', filter,
            '-map', '[v]', '-map', `${pictures.length}:a`, '-t', '4', '-r', '30',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', out], undefined, 300_000);
        clips.push(out);
    }
    return { attachments: [], later: clips, truth: { kind: 'footage', clips, tapClip: clips[2], tapColour: FOOTAGE_TAP, ambientHz: FOOTAGE_HZ, facts: FOOTAGE_FACTS } };
}
function seedStoryScript() {
    return { attachments: [], truth: { kind: 'script', language: 'en', lines: STORY_SCRIPT.scenes.map((scene) => scene.line),
            scenes: STORY_SCRIPT.scenes.map((scene) => scene.picture), seconds: STORY_SCRIPT.seconds, voiceOver: true } };
}
const AVATAR_SHOP = '麦田小屋';
const AVATAR_FACTS = ['本周新品全麦欧包', '每天早上 7 点出炉', '周末买二送一'];
const PORTRAIT_COLOURS = [[250, 90, 60], [20, 150, 200]];
const BREAD_COLOURS = [[200, 220, 20], [120, 40, 160]];

"use strict";
async function seedStock(dir, tools) {
    const photos = [];
    for (const [index, photo] of SHOP_PHOTOS.entries()) {
        const file = await png(path.join(dir, 'attachments', `${SHOP}-${String(index + 1).padStart(2, '0')}-${photo.name}.png`), banded(1080, 1350, photo.colours, photo.middle, photo.overTop ?? ''));
        photos.push({ file, label: photo.label, colours: photo.colours });
    }
    const library = [];
    const stockDir = path.join(dir, 'work', 'stock');
    fs.mkdirSync(stockDir, { recursive: true });
    for (const [index, scene] of STOCK_SCENES.entries()) {
        const wide = await png(path.join(stockDir, `${scene.slug}-source.png`), banded(1440, 1920, scene.colours, scene.middle(1440), scene.overTop?.(1440) ?? '', scene.overBottom?.(1440) ?? ''));
        const videoId = 91001 + index;
        const imageId = 92001 + index;
        const clip = path.join(stockDir, `${videoId}.mp4`);
        await runMedia(tools.ffmpeg, ['-v', 'error', '-nostdin', '-y', '-loop', '1', '-framerate', '30', '-t', '5', '-i', wide,
            '-vf', "crop=1080:1920:x='t*72':y=0,scale=720:1280,format=yuv420p", '-t', '5', '-r', '30', '-an',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', clip], undefined, 300_000);
        const still = path.join(stockDir, `${imageId}.jpg`);
        await sharp(wide).extract({ left: 180, top: 0, width: 1080, height: 1920 }).resize(720, 1280).jpeg({ quality: 88 }).toFile(still);
        const videoPreview = path.join(stockDir, `${videoId}-preview.jpg`);
        const imagePreview = path.join(stockDir, `${imageId}-preview.jpg`);
        await sharp(wide).extract({ left: 180, top: 0, width: 1080, height: 1920 }).resize(360, 640).jpeg({ quality: 82 }).toFile(videoPreview);
        await sharp(still).resize(360, 640).jpeg({ quality: 82 }).toFile(imagePreview);
        const common = { role: scene.role, label: scene.label, tags: scene.tags, colours: scene.colours, author: scene.author, width: 720, height: 1280 };
        library.push({ ...common, id: `fixture-video-${videoId}`, kind: 'video', duration: 5, file: clip,
            preview: videoPreview });
        library.push({ ...common, id: `fixture-image-${imageId}`, kind: 'image', file: still,
            preview: imagePreview });
    }
    const tiles = [
        ...STOCK_SCENES.map((scene, index) => ({ file: library[index * 2].preview, label: `stock: ${scene.label}` })),
        ...photos.map((photo) => ({ file: photo.file, label: `user's photo: ${photo.label}` })),
    ];
    const tileWidth = 240;
    const tileHeight = 427;
    const caption = 92;
    const columns = 4;
    const rows = Math.ceil(tiles.length / columns);
    const composites = await Promise.all(tiles.map(async (tile, index) => ({
        input: await sharp(tile.file).resize(tileWidth, tileHeight, { fit: 'contain', background: '#ffffff' }).png().toBuffer(),
        left: (index % columns) * tileWidth, top: Math.floor(index / columns) * (tileHeight + caption),
    })));
    const captions = svg(columns * tileWidth, rows * (tileHeight + caption), tiles.map((tile, index) => {
        const x = (index % columns) * tileWidth + 6;
        const y = Math.floor(index / columns) * (tileHeight + caption) + tileHeight + 26;
        const lines = [];
        for (const word of tile.label.split(' ')) {
            if (lines.length && `${lines[lines.length - 1]} ${word}`.length <= 26)
                lines[lines.length - 1] += ` ${word}`;
            else
                lines.push(word);
        }
        return lines.slice(0, 3).map((line, row) => `<text x="${x}" y="${y + row * 22}" font-family="${FONT}" font-size="15" fill="#111111">${escapeXml(line)}</text>`).join('');
    }).join(''));
    const legend = path.join(dir, 'work', 'stock-legend.png');
    await sharp({ create: { width: columns * tileWidth, height: rows * (tileHeight + caption), channels: 3, background: '#ffffff' } })
        .composite([...composites, { input: captions, left: 0, top: 0 }]).png().toFile(legend);
    return { attachments: photos.map((photo) => photo.file), truth: { kind: 'stock', shop: SHOP, library, photos, legend } };
}

async function seedPortrait(dir) {
    const portrait = await png(path.join(dir, 'attachments', '我的正面照.png'), banded(1080, 1350, PORTRAIT_COLOURS,
        `<rect y="300" width="1080" height="760" fill="#f5e5ce"/>${figure(540, 350, 230, '#526b83', '#34241c')}`));
    const product = await png(path.join(dir, 'attachments', '全麦欧包.png'), banded(1080, 1350, BREAD_COLOURS,
        '<rect y="300" width="1080" height="760" fill="#f4ead8"/><rect x="140" y="760" width="800" height="90" rx="20" fill="#9a6a3c"/><ellipse cx="540" cy="690" rx="330" ry="120" fill="#a7652d"/>'));
    const shirt = [82, 107, 131];
    const bread = [[167, 101, 45], [154, 106, 60]];
    return { attachments: [portrait, product], truth: { kind: 'portrait-fallback', shop: AVATAR_SHOP, facts: AVATAR_FACTS,
        subjects: {
            portrait: { file: portrait, anchor: [shirt], components: [shirt, [241, 199, 163], [52, 36, 28]] },
            bread: { file: product, anchor: bread, components: bread },
        } } };
}

function seedEpisodeFallback() {
    return { attachments: [], truth: { kind: 'script', language: 'tr', maxSeconds: EPISODE_SCRIPT.maxSeconds,
        lines: EPISODE_SCRIPT.scenes.map(scene => scene.line), scenes: EPISODE_SCRIPT.scenes.map(scene => scene.picture) } };
}

function seedBed(seeded, dir) {
    const music = writeWav(path.join(dir, 'attachments', '可用的免付费配乐.wav'), synthMusic(32, 96, 239).pcm);
    return { ...seeded, attachments: [...seeded.attachments, music], truth: { ...seeded.truth, music } };
}

export const productionSeeds = {
    podcast: seedPodcast,
    recap: seedRecap,
    'ad-page': (dir, _tools, { variant } = {}) => seedAdPage(dir, variant),
    'no-spend': seedNoSpend,
    explainer: seedExplainer,
    tutorial: (dir, tools, { variant } = {}) => seedTutorial(dir, tools, variant),
    brand: async (dir, tools) => seedBed(await seedBrand(dir, tools), dir),
    stock: seedStock,
    'site-shots': seedSiteShots,
    'booking-shots': seedBookingShots,
    'ledger-shots': seedLedgerShots,
    'service-brief': seedServiceBrief,
    lecture: async (dir, tools) => seedBed(await seedLecture(dir, tools), dir),
    'long-talk': async (dir, tools) => seedBed(await seedLongTalk(dir, tools), dir),
    'long-brief': seedLongBrief,
    'product-footage': seedProductFootage,
    'story-script': seedStoryScript,
    'portrait-fallback': seedPortrait,
    'episode-fallback': seedEpisodeFallback,
};
