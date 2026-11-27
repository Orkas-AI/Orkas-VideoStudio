import { sharp } from './fixture-media.mjs';
import { probeMedia, runMedia } from './media.mjs';

const distance = (data, at, rgb) =>
    Math.abs(data[at] - rgb[0]) + Math.abs(data[at + 1] - rgb[1]) + Math.abs(data[at + 2] - rgb[2]);
const reads = (data, at, color, tolerance) => distance(data, at, color) <= tolerance;

function largestShape(data, width, height, colors, tolerance) {
    const seen = new Uint8Array(width * height);
    const queue = new Int32Array(seen.length);
    let best;
    for (let p = 0; p < seen.length; p += 1) {
        if (seen[p] || !colors.some(color => reads(data, p * 3, color, tolerance))) continue;
        seen[p] = 1;
        queue[0] = p;
        let count = 1;
        let left = width, top = height, right = -1, bottom = -1;
        const add = at => {
            if (seen[at] || !colors.some(color => reads(data, at * 3, color, tolerance))) return;
            seen[at] = 1;
            queue[count++] = at;
        };
        for (let i = 0; i < count; i += 1) {
            const at = queue[i], x = at % width, y = Math.floor(at / width);
            left = Math.min(left, x); top = Math.min(top, y);
            right = Math.max(right, x); bottom = Math.max(bottom, y);
            if (x > 0) add(at - 1);
            if (x + 1 < width) add(at + 1);
            if (y > 0) add(at - width);
            if (y + 1 < height) add(at + width);
        }
        if (!best || count > best.count) best = { count, left, top, width: right - left + 1, height: bottom - top + 1 };
    }
    return best;
}

async function template({ file, anchor, components }) {
    const { data, info: { width, height } } = await sharp(file).resize({ width: 200 })
        .removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
    const shape = largestShape(data, width, height, anchor, 28);
    if (!shape) throw new Error('The supplied fixture has no recognizable subject anchor');
    // Sample the subject and its surrounding silhouette; omit the fixture's edge stripes.
    const points = components.map(() => []);
    const background = [];
    for (let row = -22; row <= 20; row += 1) {
        for (let col = -3; col <= 19; col += 1) {
            const x = Math.round(shape.left + shape.width * col / 16);
            const y = Math.round(shape.top + shape.height * row / 16);
            if (x < 0 || x >= width || y < height * 0.24 || y >= height * 0.76) continue;
            const at = (y * width + x) * 3;
            const color = components.findIndex(candidate => reads(data, at, candidate, 8));
            const position = { x: col / 16, y: row / 16 };
            if (color >= 0) points[color].push(position);
            else if (row >= 0 && row <= 16 && col >= 0 && col <= 16) background.push(position);
        }
    }
    if (points.some(group => !group.length) || !background.length) throw new Error('The supplied fixture lacks subject or silhouette samples');
    return { anchor, components, points, background, ratio: shape.width / shape.height };
}

function matchesSubject(data, width, height, expected) {
    const shape = largestShape(data, width, height, expected.anchor, 31);
    if (!shape || shape.width < 8 || shape.height < 8
        || Math.abs(Math.log(shape.width / shape.height / expected.ratio)) > 0.38) return false;
    const at = point => {
        const x = Math.round(shape.left + point.x * shape.width);
        const y = Math.round(shape.top + point.y * shape.height);
        return x >= 0 && x < width && y >= 0 && y < height ? (y * width + x) * 3 : -1;
    };
    const share = (points, predicate) => points.filter(point => {
        const pixel = at(point);
        return pixel >= 0 && predicate(pixel);
    }).length / points.length;
    const closeColor = (pixel, color) => {
        const x = (pixel / 3) % width, y = Math.floor(pixel / 3 / width);
        for (let row = Math.max(0, y - 1); row <= Math.min(height - 1, y + 1); row += 1) {
            for (let col = Math.max(0, x - 1); col <= Math.min(width - 1, x + 1); col += 1) {
                if (reads(data, (row * width + col) * 3, color, 34)) return true;
            }
        }
        return false;
    };
    return expected.points.every((points, i) => share(points, pixel => closeColor(pixel, expected.components[i])) >= 0.65)
        && share(expected.background, pixel => !expected.anchor.some(color => reads(data, pixel, color, 31))) >= 0.55;
}

export async function subjectPictureShares(tools, file, subjects) {
    const { width: originalWidth, height: originalHeight } = await probeMedia(tools, file);
    const width = 128;
    const height = Math.max(2, Math.round(originalHeight / originalWidth * width / 2) * 2);
    const fps = 4;
    const size = width * height * 3;
    const raw = await runMedia(tools.ffmpeg, ['-v', 'error', '-nostdin', '-i', file, '-map', '0:v:0', '-vf',
        `fps=${fps},scale=${width}:${height}:flags=area,format=rgb24`, '-f', 'rawvideo', 'pipe:1']);
    const result = {};
    for (const [key, source] of Object.entries(subjects)) {
        const expected = await template(source);
        const times = [];
        for (let offset = 0; offset + size <= raw.length; offset += size) {
            if (matchesSubject(raw.subarray(offset, offset + size), width, height, expected)) times.push(offset / size / fps);
        }
        result[key] = { seconds: times.length / fps, first: times[0], last: times.at(-1) };
    }
    return result;
}
