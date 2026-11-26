import path from 'node:path';
import { buildVideo, png, svg, writeWav } from './fixture-media.mjs';
import { probeMedia } from './media.mjs';

const accent = '#7951d1';
const escapeXml = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const text = (x, y, value, size, fill = '#202035') =>
    `<text x="${x}" y="${y}" font-family="sans-serif" font-size="${size}" font-weight="700" fill="${fill}">${escapeXml(value)}</text>`;
const rect = (x, y, w, h, fill, rx = 12) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`;

async function silentVideo(dir, tools, name, width, height, scenes, seconds) {
    const backgrounds = await Promise.all(scenes.map(async (body, index) => ({
        file: await png(path.join(dir, 'work', `${name}-${index}.png`), svg(width, height, body)),
        seconds,
    })));
    const duration = scenes.length * seconds;
    const audio = writeWav(path.join(dir, 'work', `${name}.wav`), { rate: 16000, samples: new Float32Array(16000 * duration) });
    const file = path.join(dir, 'attachments', `${name}.mp4`);
    await buildVideo(tools, { width, height, fps: 24, duration, backgrounds, audio }, file);
    return { file, duration: (await probeMedia(tools, file)).duration };
}

const hero = '<rect width="960" height="540" fill="#f8f6fe"/>';
function interfaceScene(label, detail, index) {
    const header = text(70, 75, 'Catalog Desk', 26, accent) + text(70, 170, label, 58);
    const lines = (x, y, lengths, color = '#ded5ef') =>
        lengths.map((width, row) => rect(x, y + row * 32, width, 14, color)).join('');
    const panels = [
        rect(360, 205, 530, 260, '#fff') + rect(390, 230, 470, 38, '#e9defd')
            + text(410, 257, detail, 17) + rect(391, 293, 142, 135, '#eee9fb')
            + lines(555, 304, [180, 230, 150]) + rect(70, 237, 106, 34, accent),
        rect(70, 206, 820, 300, '#fff') + rect(95, 225, 770, 48, '#e9defd')
            + text(122, 256, detail, 20)
            + [0, 1, 2, 3].map(row => rect(96, 296 + row * 47, 38, 33, accent)
                + rect(163, 305 + row * 47, 462, 14, '#ded5ef') + rect(720, 300 + row * 47, 115, 23, '#d2b9fa')).join(''),
        rect(70, 206, 280, 300, '#e5d5fa') + rect(380, 206, 510, 300, '#fff')
            + text(410, 252, detail, 20) + lines(413, 288, [410, 340, 395, 200]) + rect(718, 436, 135, 36, accent),
        rect(70, 206, 820, 285, '#fff') + text(101, 248, detail, 20)
            + [0, 1, 2].map(row => rect(102, 278 + row * 57, 730, 42, '#ede7fc')
                + rect(102, 278 + row * 57, 165 + row * 205, 42, accent)).join(''),
    ];
    return hero + header + panels[index];
}

function viralScene(title, label, index) {
    const backdrop = `<rect width="540" height="960" fill="${index === 5 ? '#101620' : '#1b2635'}"/>`;
    const chip = rect(68, 150, 404, 78, index === 5 ? '#16382a' : '#153e64')
        + text(92, 200, label, 27, '#ffffff');
    if (index === 5) return backdrop + chip + text(68, 470, title, 42, '#ffffff') + rect(68, 560, 355, 8, '#83d1ae');
    const image = rect(68, 305, 404, 260, ['#4a6175', '#57463e', '#56654c', '#456066', '#4d4964'][index]);
    const icon = `<circle cx="${135 + index * 62}" cy="428" r="61" fill="#c0d4e1"/><path d="M80 535 206 420 291 535 381 452 462 535Z" fill="#152c43"/>`;
    return backdrop + chip + image + icon + text(68, 665, title, 26, '#ffffff');
}

export async function seedReference(dir, tools, { scenario }) {
    if (scenario === 'remake') {
        const titles = ['A calmer morning', 'Leave a glass ready', 'Open the curtains', 'Put your phone away', 'Start with one small step', 'Save this for tomorrow'];
        const labels = ['THE MORNING RESET', '01  WATER', '02  LIGHT', '03  SPACE', 'ONE SMALL STEP', 'TRY IT TOMORROW'];
        const reference = await silentVideo(dir, tools, 'viral-reference', 540, 960,
            titles.map((title, index) => viralScene(title, labels[index], index)), 2);
        const source = await silentVideo(dir, tools, 'ovs-product-video', 960, 540,
            ['Open a video project', 'Arrange clips', 'Edit the canvas', 'Export a playable video']
                .map((step, index) => interfaceScene(step, 'Orkas VideoStudio', index)), 3);
        return { attachments: [reference.file, source.file], truth: { kind: 'reference', scenario, reference, source } };
    }
    const scenes = [
        interfaceScene('A home for your catalog', 'Everything in view', 0),
        interfaceScene('Organize inventory', 'Product rows', 1),
        interfaceScene('Draft content', 'Description preview', 2),
        interfaceScene('Follow progress', 'Task statuses', 3),
    ];
    const reference = await silentVideo(dir, tools, 'product-layout-reference', 960, 540, scenes, 6);
    return { attachments: [reference.file], truth: { kind: 'reference', scenario, reference } };
}
