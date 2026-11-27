import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { sharp, synthMusic } from '../../../eval/video/fixture-media.mjs';
import { seed } from '../../../eval/video/fixtures.mjs';
import { mediaTools } from '../../../eval/video/media.mjs';
import { mixedMusicSeconds } from '../../../eval/video/music-evidence.mjs';
import { verifiedReferenceRead } from '../../../eval/video/reference-read.mjs';
import { subjectPictureShares } from '../../../eval/video/subject-evidence.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function scratch() {
  const root = mkdtempSync(join(tmpdir(), 'ovs-score-matching-'));
  roots.push(root);
  return root;
}

it('proves a renamed reference was read and rejects a same-name substitute and unrelated frame receipt', () => {
  const root = scratch();
  const workspace = join(root, 'workspace');
  mkdirSync(workspace);
  const reference = { file: join(root, 'reference.mp4'), duration: 12 };
  writeFileSync(reference.file, 'original fixture bytes');
  copyFileSync(reference.file, join(workspace, 'renamed reference.mp4'));
  writeFileSync(join(workspace, 'reference.mp4'), 'some other video');
  const score = (command: string, output = 'frame.png', exit = 0) => verifiedReferenceRead(workspace, reference, [{
    events: [{ type: 'item.completed', item: { type: 'command_execution', exit_code: exit, command,
      aggregated_output: JSON.stringify({ output }, null, 2) } }],
  }]);
  const good = 'ovs edit extract-frame "renamed reference.mp4" --at 6 --out frame.png';
  expect(score(`/bin/zsh -lc 'ovs edit probe reference.mp4 && ${good}'`)).toBe(true);
  expect(score(good.replace('"renamed reference.mp4"', 'reference.mp4'))).toBe(false);
  expect(score(good, 'different.png')).toBe(false);
  expect(score(good, 'frame.png', 1)).toBe(false);
  expect(score(`printf '%s' '${good}'`)).toBe(false);
  expect(score(`cd another-folder; ${good}`)).toBe(false);
  expect(score(good.replace('--at 6', '--at 16'))).toBe(false);
  if (process.platform !== 'win32') {
    symlinkSync(reference.file, join(workspace, 'external.mp4'));
    expect(score(good.replace('"renamed reference.mp4"', 'external.mp4'))).toBe(false);
  }
});

it('finds quiet mixed music across windows and rejects silence, a same-tempo substitute and a brief excerpt', () => {
  const rate = 8000;
  function music(seed: number) {
    const pcm = synthMusic(12, 96, seed).pcm;
    return Float32Array.from({ length: 12 * rate }, (_, i) => {
      const at = i * pcm.rate / rate;
      const before = Math.floor(at);
      return pcm.samples[before] + (pcm.samples[before + 1] - pcm.samples[before]) * (at - before);
    });
  }
  const source = music(42);
  const voice = source.map((_, i) => {
    const t = i / rate;
    return 0.55 * Math.sin(2 * Math.PI * (203 + 5 * Math.sin(7 * t)) * t)
      + 0.25 * Math.sin(2 * Math.PI * 385 * t) * Math.sin(9 * t);
  });
  const mix = (bed: Float32Array, keep = bed.length) => voice.map((sample, i) =>
    sample + (i < keep ? 0.18 * bed[(i + bed.length - 108) % bed.length] : 0));
  expect(mixedMusicSeconds(mix(source), source)).toBeGreaterThanOrEqual(8);
  expect(mixedMusicSeconds(mix(music(72)), source)).toBe(0);
  expect(mixedMusicSeconds(voice, source)).toBe(0);
  expect(mixedMusicSeconds(mix(source, 2 * rate), source)).toBe(0);
});

it('recovers both cropped subjects and rejects upside-down, same-palette substitutes', async () => {
  const root = scratch();
  const tools = mediaTools();
  const { attachments, truth } = await seed['portrait-fallback'](join(root, 'fixture'), tools);
  const encode = async (flip: boolean) => {
    const images = await Promise.all(attachments.map(async (source: string, i: number) => {
      // Keep the subject, cropping away every colored edge stripe.
      const cropped = await sharp(source).extract({ left: 88, top: 325, width: 904, height: 696 }).png().toBuffer();
      const tile = await (flip ? sharp(cropped).flip() : sharp(cropped)).resize({ width: 240 }).png().toBuffer();
      const file = join(root, `${flip}-${i}.png`);
      await sharp({ create: { width: 270, height: 480, channels: 3, background: '#eee7d3' } })
        .composite([{ input: tile, top: 105 + i * 18, left: 15 }]).png().toFile(file);
      return file;
    }));
    const video = join(root, `${flip}.mp4`);
    const result = spawnSync(tools.ffmpeg, ['-v', 'error', '-nostdin', '-threads', '1',
      ...images.flatMap(file => ['-loop', '1', '-framerate', '4', '-t', '2', '-i', file]),
      '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', video],
    { encoding: 'utf8', timeout: 30_000 });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    return subjectPictureShares(tools, video, truth.subjects);
  };
  const good = await encode(false);
  expect(good.portrait.seconds).toBeGreaterThanOrEqual(1);
  expect(good.bread.seconds).toBeGreaterThanOrEqual(1);
  const substituted = await encode(true);
  expect(substituted.portrait.seconds).toBe(0);
  expect(substituted.bread.seconds).toBe(0);
}, 45_000);
