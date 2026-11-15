import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { prepareImage } from '../src/image/preparation.js';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const dirs: string[] = [];
const temp = () => { const p = mkdtempSync(join(tmpdir(), 'ovs-image-')); dirs.push(p); return p; };
afterEach(() => { for (const p of dirs.splice(0)) rmSync(p, { force: true, recursive: true }); });

describe('local image preparation', () => {
  it('uses oriented original coordinates and publishes exclusively without changing the source', async () => {
    const project = temp();
    await sharp({ create: { width: 80, height: 40, channels: 3, background: '#ef1020' } }).jpeg().withMetadata({ orientation: 6 }).toFile(join(project, 'original.jpg'));
    const original = readFileSync(join(project, 'original.jpg'));
    const inspected = await prepareImage({ project, request: { op: 'inspect', input_path: 'original.jpg' } });
    expect(inspected).toMatchObject({ ok: true, width: 40, height: 80, coordinate_space: 'oriented_original_pixels', model_calls: 0 });
    const request = { op: 'process', input_path: 'original.jpg', output_path: 'crop.png', source_size: { width: 40, height: 80 }, crop: { left: 0, top: 0, width: 20, height: 40 }, resize: { width: 10 }, padding: { left: 2, right: 2 } };
    expect(await prepareImage({ project, request })).toMatchObject({ ok: true, width: 14, height: 20 });
    const output = readFileSync(join(project, 'crop.png'));
    expect(await prepareImage({ project, request })).toMatchObject({ ok: false, errorCode: 'E_IMAGE_ASSET_EXISTS' });
    expect(readFileSync(join(project, 'crop.png'))).toEqual(output);
    expect(readFileSync(join(project, 'original.jpg'))).toEqual(original);
  });
  it('rejects preview coordinates, escaping symlinks, oversized requests and unsupported fields', async () => {
    const project = temp(), outside = temp();
    await sharp({ create: { width: 40, height: 80, channels: 3, background: '#123456' } }).png().toFile(join(project, 'input.png'));
    symlinkSync(outside, join(project, 'escape'));
    const base = { op: 'process', input_path: 'input.png', output_path: 'out.png' };
    expect(await prepareImage({ project, request: { ...base, crop: { left: 0, top: 0, width: 10, height: 10 }, source_size: { width: 20, height: 40 } } })).toMatchObject({ errorCode: 'E_IMAGE_ASSET_COORDINATES' });
    expect(await prepareImage({ project, request: { ...base, output_path: 'escape/out.png' } })).toMatchObject({ errorCode: 'E_IMAGE_ASSET_PATH' });
    expect(await prepareImage({ project, request: { ...base, output_path: 'input.png' } })).toMatchObject({ errorCode: 'E_IMAGE_ASSET_PATH' });
    expect(await prepareImage({ project, request: { ...base, prompt: 'x' } })).toMatchObject({ errorCode: 'E_IMAGE_ASSET_ARGUMENT' });
    writeFileSync(join(project, 'large.json'), ' '.repeat(65537));
    expect(await prepareImage({ project, request_file: 'large.json' })).toMatchObject({ errorCode: 'E_IMAGE_ASSET_LIMIT' });
  });
});
