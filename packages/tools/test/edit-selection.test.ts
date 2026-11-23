import { afterAll, beforeAll, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
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
  // Every selected frame survives the accurate seek: 4 or 5 frames per cut, 72 in all.
  for (let i = 0; i < 16; i++) expect(pictureFrames(cuts[i])).toBe(Math.round((i + 1) * .15 * 30) - Math.round(i * .15 * 30));
  expect(pictureFrames(joined.output)).toBe(72);
  const beat = await trim({ input: source, start_sec: 1.03, duration_sec: 0.46875, output: join(dir, 'one-beat.mp4') });
  expect(pictureFrames(beat.output)).toBe(14);
}, 30_000);
// An id copied one character short was answered "the measured source or transcript
// changed", and the caller stopped, sure its files did not match.
it('answers an id copied short with the id of this listing, and cuts nothing', async () => {
  const take = await fixture(SPACED);
  const view = await cutSelection({ input: take.video, transcript: take.transcript });
  const output = join(take.root, 'short-id.mp4');
  await expect(cutSelection({ input: take.video, transcript: take.transcript, keep: [1, 3], selection_id: view.selection_id.slice(0, -1), output }))
    .rejects.toThrow(`--selection-id (selection_id) is not the id of this listing, so no cut was written. This listing's id is ${view.selection_id}: copy all 64 characters. If the source or transcript changed since you listed it, choose the IDs from this listing again.`);
  await expect(stat(output)).rejects.toThrow();
}, 60_000);
// A false start and its retake 0.4s apart were one candidate, because candidates split
// only at pauses of half a second, so the false start could not be dropped on its own.
it('lists a false start a short pause before its retake as its own candidate and drops only it', async () => {
  const take = await fixture({
    audio: "aevalsrc='0.4*(sin(2*PI*440*t)*between(t,0.5,2)+sin(2*PI*660*t)*between(t,2.3,3.3)+sin(2*PI*880*t)*between(t,3.6,5.6))':s=48000:d=10",
    words: [{ text: 'Opening', start: 0.5, end: 2 }, { text: 'False start', start: 2.3, end: 3.3 }, { text: 'Complete take', start: 3.6, end: 5.6 }],
  });
  const before = await readFile(take.video);
  const view = await cutSelection({ input: take.video, transcript: take.transcript });
  expect(view.candidates.map((c) => c.text)).toEqual(['Opening', 'False start', 'Complete take']);
  const output = join(take.root, 'clean.mp4');
  await cutSelection({ input: take.video, transcript: take.transcript, keep: [1, 3], selection_id: view.selection_id, output });
  // 0–2s, then 3.6s to the end: both kept takes whole, the false start gone.
  expect((await probeMedia(output)).video_duration).toBeCloseTo(8.4, 1);
  expect(tonePower(output, 440, 0.6, 1.3)).toBeGreaterThan(0.005);
  expect(tonePower(output, 880, 2.1, 1.9)).toBeGreaterThan(0.005);
  expect(tonePower(output, 660, 0, 8.4)).toBeLessThan(0.00001);
  expect(await readFile(take.video)).toEqual(before);
}, 120_000);

function pictureFrames(file: string): number {
  return Number(spawnSync(resolveFfmpegTools().ffprobe, ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout.trim());
}
/** Mean power of one frequency over a window of the decoded sound. */
function tonePower(file: string, hz: number, startSec: number, durationSec: number): number {
  const pcm = spawnSync(resolveFfmpegTools().ffmpeg, ['-v', 'error', '-nostdin', '-i', file, '-ac', '1', '-ar', '48000', '-f', 'f32le', '-'], { maxBuffer: 16 * 1024 * 1024 }).stdout;
  const first = Math.round(startSec * 48000), count = Math.min(Math.round(durationSec * 48000), pcm.length / 4 - first);
  let re = 0, im = 0;
  for (let i = 0; i < count; i++) {
    const sample = pcm.readFloatLE((first + i) * 4);
    re += sample * Math.cos(2 * Math.PI * hz * i / 48000);
    im += sample * Math.sin(2 * Math.PI * hz * i / 48000);
  }
  return (re * re + im * im) / (count * count);
}
const SPACED = {
  audio: "aevalsrc='0.4*(sin(2*PI*440*t)*between(t,0.5,2)+sin(2*PI*660*t)*between(t,3,4.5)+sin(2*PI*880*t)*between(t,6,8))':s=48000:d=10",
  words: [{ text: 'Opening', start: 0.5, end: 2 }, { text: 'False start', start: 3, end: 4.5 }, { text: 'Complete take', start: 6, end: 8 }],
};
/** A 10s portrait take with speech placed by `take.audio` and its saved word transcript. */
async function fixture(take: { audio: string; words: Array<{ text: string; start: number; end: number }> }) {
  const root = await mkdtemp(join(dir, 'take-'));
  const video = join(root, 'source.mp4'), transcript = join(root, 'words.json');
  await runOk(resolveFfmpegTools().ffmpeg, ['-v', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=180x320:r=25:d=10', '-f', 'lavfi', '-i', take.audio, '-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac', video], { timeoutMs: 30_000 });
  await writeFile(transcript, JSON.stringify({ words: take.words }));
  return { root, video, transcript };
}
