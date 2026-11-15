import { afterAll, beforeAll, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveFfmpegTools, runOk } from '@orkas/video-studio-core';
import { cutSelection, mix, probeMedia, trim, concat } from '../src/edit/index.js';
let dir: string, source: string, transcript: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ovs-select-test-')); source = join(dir, 'source.mp4'); transcript = join(dir, 'words.json');
  await runOk(resolveFfmpegTools().ffmpeg, ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=30:duration=3', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-c:v', 'libx264', '-c:a', 'aac', '-shortest', source], { timeoutMs: 30_000 });
  await writeFile(transcript, JSON.stringify({ words: [{ word: 'First.', start: .1, end: .6 }, { word: 'Second.', start: 1.1, end: 1.5 }, { word: 'Last.', start: 2.1, end: 2.7 }] }));
});
afterAll(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });
it('lists measured phrases without choosing takes and preserves the complete selection byte for byte', async () => {
  const view = await cutSelection({ input: source, transcript });
  expect(view.candidates).toHaveLength(3);
  const output = join(dir, 'all.mp4');
  await cutSelection({ input: source, transcript, keep: [1, 2, 3], selection_id: view.selection_id, output });
  expect(await readFile(output)).toEqual(await readFile(source));
  expect(JSON.parse(await readFile(output + '.selection.json', 'utf8')).selected_ids).toEqual([1, 2, 3]);
});
it('refuses stale measurements and existing destinations without changing their bytes', async () => {
  const view = await cutSelection({ input: source, transcript });
  const output = join(dir, 'existing.mp4'); await writeFile(output, 'preserve');
  await expect(cutSelection({ input: source, transcript, keep: [1], selection_id: view.selection_id, output })).rejects.toThrow(/new/);
  await expect(cutSelection({ input: source, transcript, keep: [2, 1], selection_id: view.selection_id, output: output + '.new' })).rejects.toThrow(/order/);
  await writeFile(transcript, JSON.stringify({ words: [{ word: 'Changed.', start: .1, end: .7 }] }));
  await expect(cutSelection({ input: source, transcript, keep: [1], selection_id: view.selection_id, output: output + '.new' })).rejects.toThrow(/changed/);
  expect(await readFile(output, 'utf8')).toBe('preserve');
  await expect(stat(output + '.new')).rejects.toThrow();
});
it('checks fixed narration windows before writing and preserves the picture when a bed is longer', async () => {
  const output = join(dir, 'mixed.mp4');
  await expect(mix({ base: source, segments: [{ path: source, start_sec: 0, end_sec: 1 }], output, on_existing_audio: 'replace' })).rejects.toThrow(/window/);
  await expect(stat(output)).rejects.toThrow();
  await mix({ base: source, segments: [{ path: source, start_sec: 1 }], output, on_existing_audio: 'mix', duck: true });
  const spec = await probeMedia(output); expect(spec.video_duration).toBeCloseTo(3, 2); expect(spec.duration).toBeLessThan(3.1);
});
it('joins sixteen beat cuts on their absolute frame grid without cumulative AAC drift', async () => {
  const cuts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const a = Math.round(i * .15 * 30), b = Math.round((i + 1) * .15 * 30), output = join(dir, `beat-${i}.mp4`);
    await trim({ input: source, start_sec: a / 30, duration_sec: (b - a) / 30, output }); cuts.push(output);
  }
  const joined = await concat(cuts, join(dir, 'beats.mp4'));
  expect((await probeMedia(joined.output)).video_duration).toBeCloseTo(2.4, 2);
}, 30_000);
