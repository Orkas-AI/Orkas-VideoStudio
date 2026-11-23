import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REFERENCE_MOTION_CODE, referenceMoments, resolveFfmpegTools, runOk, type VideoEdl } from '@orkas/video-studio-core';
import { verifyProductionDelivery, verifyTimelineDelivery } from '../src/render/delivery.js';
import { narrationPlaybackIssues } from '../src/render/narration-playback.js';
import { compareWithReference, writeReferenceComparisonSheet } from '../src/render/reference-compare.js';
const dir = mkdtempSync(join(tmpdir(), 'ovs-delivery-'));
const video = join(dir, 'finished.mp4');
const audio = join(dir, 'line.wav');
const plan: VideoEdl = { aspect: '16:9', total_target_sec: 2, language: 'en', delivery_promise: { type: 'compose_led', source_required: false, motion_min_ratio: 0 }, segments: [], tracks: {} };
beforeAll(async () => {
  const { ffmpeg } = resolveFfmpegTools();
  await runOk(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'color=c=blue:s=320x180:r=24:d=2', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', video]);
  await runOk(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=600:duration=1', audio]);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));
it('verifies a real finished file and fails on drift regardless of assembly route', async () => {
  const checked = await verifyProductionDelivery(plan, join(dir, 'plan.json'), video);
  expect(checked.ok).toBe(true);
  expect(checked.is_generation).toBe(false);
  expect(checked.spec.fps).toBe(24);
  expect(checked.integrated_lufs).not.toBeNull();
  const drift = await verifyProductionDelivery({ ...plan, total_target_sec: 4, aspect: '9:16' }, join(dir, 'plan.json'), video);
  expect(drift.ok).toBe(false);
  expect(drift.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['DELIVERY_DURATION_DRIFT', 'DELIVERY_ASPECT_MISMATCH']));
});
it('enforces delivered duration, canvas and sound for direct model output too', async () => {
  const generated: VideoEdl = {
    ...plan,
    aspect: '9:16',
    total_target_sec: 12,
    delivery_promise: { type: 'motion_led', source_required: false, motion_min_ratio: 0.7 },
    segments: [{
      id: 'g1', order: 1, role: 'body', layer: 'primary', source: 'generate', target_sec: 12,
      spec: { prompt: 'a blue frame', media_kind: 'video', operation: 'generate' },
    }],
    tracks: {},
  };
  const checked = await verifyProductionDelivery(generated, join(dir, 'plan.json'), video);
  expect(checked.ok).toBe(false);
  expect(checked.is_generation).toBe(true);
  expect(checked.integrated_lufs).not.toBeNull();
  expect(checked.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['DELIVERY_DURATION_DRIFT', 'DELIVERY_ASPECT_MISMATCH']));

  const unreadable = join(dir, 'not-video.mp4');
  await import('node:fs/promises').then(({ writeFile }) => writeFile(unreadable, 'not media'));
  const failed = await verifyProductionDelivery(generated, join(dir, 'plan.json'), unreadable);
  expect(failed.ok).toBe(false);
  expect(failed.issues.map((issue) => issue.code)).toEqual(['DELIVERY_VIDEO_UNREADABLE']);
});
it('measures every declared line and fails closed when one cannot be checked', async () => {
  const withNarration: VideoEdl = { ...plan, tracks: { narration: { segments: [
    { text: 'First', produced_path: audio, start_sec: 0, target_sec: 1 },
    { text: 'Second', produced_path: audio, start_sec: 0.5, target_sec: 1 },
    { text: 'Missing', produced_path: 'missing.wav', start_sec: 1, target_sec: 1 },
  ] } } };
  const result = await verifyProductionDelivery(withNarration, join(dir, 'plan.json'), video);
  expect(result.ok).toBe(false);
  expect(result.narration_lines_measured).toBe(2);
  expect(result.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['DELIVERY_NARRATION_OVERLAP', 'DELIVERY_NARRATION_UNVERIFIABLE']));
});
it('refuses an audible file whose sound stops well before its picture', async () => {
  const file = join(dir, 'short-sound.mp4');
  await runOk(resolveFfmpegTools().ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=blue:s=320x180:r=24:d=2', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', file]);
  const checked = await verifyProductionDelivery(plan, join(dir, 'plan.json'), file);
  expect(checked.ok).toBe(false);
  expect(checked.issues.map(i => i.code)).toContain('DELIVERY_AV_DURATION_MISMATCH');
  // On 2026-11-19 "one of them stops early" left a tutorial (picture 30.6 s, sound 22.2 s) asking
  // for its narration to be recorded again rather than filling or cutting the silent end.
  expect(checked.issues.find(i => i.code === 'DELIVERY_AV_DURATION_MISMATCH')?.message)
    .toMatch(/^The picture runs 2\.00s and the sound 0\.5\ds, so the last 1\.[45]\ds have no sound\. Give that stretch sound, such as another narration line or music under the end, or cut the picture to 0\.5\ds, then deliver again\.$/);
});
it('refuses a file whose sound runs on past its picture, and says to cut the sound or extend the picture', async () => {
  const file = join(dir, 'long-sound.mp4');
  await runOk(resolveFfmpegTools().ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=blue:s=320x180:r=24:d=1', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', file]);
  const checked = await verifyProductionDelivery({ ...plan, total_target_sec: 3 }, join(dir, 'plan.json'), file);
  expect(checked.issues.find(i => i.code === 'DELIVERY_AV_DURATION_MISMATCH')?.message)
    .toMatch(/^The picture runs 1\.00s and the sound 3\.0\ds, so the sound runs 2\.0\ds past the picture\. Cut the sound to 1\.00s or extend the picture, then deliver again\.$/);
});
// Captions are burned into the picture, which no container check can see; only the legacy plan check still looks.
it('looks for declared captions in the container only for the legacy plan check, never for timeline delivery', async () => {
  const captioned: VideoEdl = { ...plan, tracks: { captions: { lines: [{ text: 'Hello', start_sec: 0, target_sec: 1 }] } } };
  const legacy = await verifyProductionDelivery(captioned, join(dir, 'plan.json'), video);
  expect(legacy.issues.map(i => i.code)).toContain('DELIVERY_CAPTIONS_MISSING');
  const { checked } = await verifyTimelineDelivery(captioned, join(dir, 'plan.json'), video, undefined, { captions: true });
  expect(checked.issues.map(i => i.code)).not.toContain('DELIVERY_CAPTIONS_MISSING');
});

const ff = (args: string[]) => runOk(resolveFfmpegTools().ffmpeg, ['-v', 'error', '-nostdin', '-y', ...args], { timeoutMs: 120_000 });

// A drama recap played one narration line from 11.9 s, cut it before its last words, and
// played it again in full from 23.0 s; delivery passed it.
describe('narration played twice or cut off in a delivery', () => {
  /** Two narration lines and an earlier draft of the first that shares its opening. Lines are
   *  distinct noise, so each can only be found where it was placed. */
  async function voices() {
    const root = mkdtempSync(join(dir, 'playback-'));
    mkdirSync(join(root, 'voice'));
    const noise = (seed: number, seconds: number, file: string) => ff(['-f', 'lavfi', '-i', `anoisesrc=d=${seconds}:c=pink:r=16000:a=0.3:seed=${seed}`, '-ac', '1', join(root, file)]);
    await noise(1, 3, 'voice/hook.wav');
    await noise(2, 2.5, 'voice/close.wav');
    await noise(3, 1.5, 'tail.wav');
    // The draft: the hook's first 1.5 s, then a different ending.
    await ff(['-i', join(root, 'voice/hook.wav'), '-i', join(root, 'tail.wav'), '-filter_complex', '[0:a]atrim=0:1.5,asetpts=N/SR/TB[a];[a][1:a]concat=n=2:v=0:a=1', join(root, 'voice/hook-draft.wav')]);
    const line = (file: string, text: string) => ({ path: join(root, file), text });
    return {
      root,
      lines: [line('voice/hook-draft.wav', '合同从三十天变成九十天。'), line('voice/hook.wav', '合同从三十天变成九十天，谁动了手脚？'), line('voice/close.wav', '关键录音，竟然被删了。')],
    };
  }
  /** A 12 s delivery: each placement is [file, start s, length s or whole], over a quiet music bed. */
  async function delivery(root: string, name: string, placements: Array<[string, number, number?]>) {
    const chains = placements.map(([, start, length], index) => `[${index + 1}:a]${length ? `atrim=0:${length},` : ''}asetpts=N/SR/TB,adelay=${Math.round(start * 1000)}:all=1[p${index}]`);
    const out = join(root, `${name}.m4a`);
    await ff(['-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=16000:duration=12', ...placements.flatMap(([file]) => ['-i', join(root, file)]), '-filter_complex',
      `[0:a]volume=0.05[bed];${chains.join(';')};[bed]${placements.map((_p, index) => `[p${index}]`).join('')}amix=inputs=${placements.length + 1}:normalize=0:duration=first[out]`, '-map', '[out]', '-c:a', 'aac', out]);
    return out;
  }

  it('says nothing when each line plays once and whole, and a draft sharing a line\'s opening never played', async () => {
    const { root, lines } = await voices();
    const video = await delivery(root, 'clean', [['voice/hook.wav', 1], ['voice/close.wav', 6]]);
    expect(await narrationPlaybackIssues({ video, lines })).toEqual([]);
  });

  it('names a line played twice, with where each playback starts', async () => {
    const { root, lines } = await voices();
    const video = await delivery(root, 'twice', [['voice/hook.wav', 0.5, 2], ['voice/close.wav', 3.5], ['voice/hook.wav', 7]]);
    const issues = await narrationPlaybackIssues({ video, lines });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: 'DELIVERY_NARRATION_REPEATED', severity: 'error' });
    expect(issues[0].message).toMatch(/^The narration line "合同从三十天变成九十天，谁动了手脚？" plays twice, from 0\.[45] s and from 7\.0 s\. Keep it once, then deliver again\.$/);
  });

  it('names a line that stops before its end, with where it stops and how much is not heard', async () => {
    const { root, lines } = await voices();
    const video = await delivery(root, 'cut', [['voice/hook.wav', 1, 1.8], ['voice/close.wav', 6]]);
    const issues = await narrationPlaybackIssues({ video, lines });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: 'DELIVERY_NARRATION_CUT_OFF', severity: 'error' });
    expect(issues[0].message).toMatch(/^The narration line "合同从三十天变成九十天，谁动了手脚？" stops at 2\.[78] s before its end; about 1\.[12] s of it is not heard\. Let it finish or shorten the line, then deliver again\.$/);
  });

  it('checks nothing without declared lines, and stops nothing when the sound cannot be read', async () => {
    const { root, lines } = await voices();
    const video = await delivery(root, 'clean', [['voice/hook.wav', 1], ['voice/close.wav', 6]]);
    expect(await narrationPlaybackIssues({ video, lines: [] })).toEqual([]);
    writeFileSync(join(root, 'broken.mp4'), 'not a video');
    expect(await narrationPlaybackIssues({ video: join(root, 'broken.mp4'), lines })).toEqual([]);
  });

  it('checks a complete 180-second soundtrack without judging the same prefix of a longer delivery', async () => {
    const { root, lines } = await voices();
    const repeated = await delivery(root, 'repeated', [['voice/hook.wav', 1], ['voice/hook.wav', 6]]);
    const check = async (duration: number) => {
      const video = join(root, `delivery-${duration}.wav`);
      await ff(['-i', repeated, '-af', `apad,atrim=duration=${duration}`, '-ar', '8000', video]);
      return narrationPlaybackIssues({ video, lines: [lines[1]] });
    };
    expect(await check(180)).toEqual([expect.objectContaining({ code: 'DELIVERY_NARRATION_REPEATED' })]);
    expect(await check(182)).toEqual([]);
  });

  it('runs on timeline delivery of declared lines, not on the legacy plan check', async () => {
    const { root, lines } = await voices();
    const sound = await delivery(root, 'declared', [['voice/hook.wav', 1], ['voice/hook.wav', 6]]);
    const twice = join(root, 'declared.mp4');
    await ff(['-f', 'lavfi', '-i', 'color=c=blue:s=320x180:r=24:d=12', '-i', sound, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-t', '12', twice]);
    const declared: VideoEdl = { ...plan, total_target_sec: 12, tracks: { narration: { segments: [{ text: lines[1].text, produced_path: lines[1].path, start_sec: 1, target_sec: 5 }] } } };
    const { checked, heard } = await verifyTimelineDelivery(declared, join(root, 'plan.json'), twice);
    expect(checked.issues.map(i => i.code)).toContain('DELIVERY_NARRATION_REPEATED');
    expect(heard).toEqual([expect.objectContaining({ text: lines[1].text })]);
    expect(heard[0].startSec).toBeCloseTo(1, 1);
    expect(heard[0].endSec).toBeCloseTo(4, 1);
    const legacy = await verifyProductionDelivery(declared, join(root, 'plan.json'), twice);
    expect(legacy.issues.map(i => i.code)).not.toContain('DELIVERY_NARRATION_REPEATED');
  });
});

// Remakes kept coming out stiller than what they copied, and nothing in delivery looked at the reference again.
describe('a delivery beside its reference', () => {
  let moving: string, still: string, halfStill: string;
  beforeAll(async () => {
    const make = async (name: string, inputs: string[], filter?: string) => {
      const file = join(dir, name);
      await ff([...inputs.flatMap(input => ['-f', 'lavfi', '-i', input]), ...(filter ? ['-filter_complex', filter, '-map', '[v]'] : []), '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', file]);
      return file;
    };
    moving = await make('moving.mp4', ['testsrc2=s=360x640:r=30:d=4']);
    still = await make('still.mp4', ['color=c=0x335577:s=360x640:r=30:d=4']);
    halfStill = await make('half.mp4', ['testsrc2=s=360x640:r=30:d=2', 'color=c=0x335577:s=360x640:r=30:d=2'], '[0:v][1:v]concat=n=2:v=1:a=0[v]');
  });

  it('names a still video made from a moving reference, and passes one that moves like it', async () => {
    const stiller = await compareWithReference({ reference: moving, video: still, videoSec: 4 });
    expect(stiller?.issue?.code).toBe(REFERENCE_MOTION_CODE);
    expect(stiller?.report.motion_score).toBe(0);
    expect(stiller?.report.rows.map(row => row.motion_vs_reference)).toEqual([0, 0, 0, 0]);
    const alike = await compareWithReference({ reference: moving, video: moving, videoSec: 4 });
    expect(alike?.issue).toBeNull();
    expect(alike?.report.motion_score).toBe(1);
  });

  it('names only the quarters that stop moving', async () => {
    const result = await compareWithReference({ reference: moving, video: halfStill, videoSec: 4 });
    expect(result?.issue?.message).toContain('row 3 (63% through: 0% of the reference\'s movement) and row 4 (88% through: 0%');
    expect(result?.issue?.message).not.toContain('row 1');
  });

  it('compares nothing against a reference that is not a video or is too short', async () => {
    const text = join(dir, 'notes.txt');
    writeFileSync(text, 'not a video');
    expect(await compareWithReference({ reference: text, video: still, videoSec: 4 })).toBeNull();
    const short = join(dir, 'short.mp4');
    await ff(['-f', 'lavfi', '-i', 'testsrc2=s=360x640:r=30:d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', short]);
    expect(await compareWithReference({ reference: short, video: still, videoSec: 4 })).toBeNull();
  });

  it('keeps reference reading to known video containers when comparing and drawing', async () => {
    const unsupported = join(dir, 'unsupported.txt');
    copyFileSync(moving, unsupported);
    const out = mkdtempSync(join(dir, 'unsupported-'));
    expect(await compareWithReference({ reference: unsupported, video: still, videoSec: 4 })).toBeNull();
    expect(await writeReferenceComparisonSheet({ reference: unsupported, video: still, moments: referenceMoments(4, 4), directory: out })).toBeNull();
    expect(readdirSync(out)).toEqual([]);
  });

  it('draws the reference beside the video, one row per quarter', async () => {
    const out = mkdtempSync(join(dir, 'sheet-'));
    const sheet = await writeReferenceComparisonSheet({ reference: moving, video: still, moments: referenceMoments(4, 4), directory: out });
    expect(sheet).toMatch(/contact-sheet\.svg$/);
    const svg = readFileSync(sheet!, 'utf8');
    expect(svg.match(/<image /g)).toHaveLength(8);
    expect(svg).toContain('1 · reference 0.5s');
    expect(svg).toContain('4 · this video 3.5s');
    // Two columns: reference left, this video right.
    expect(svg).toMatch(/<svg [^>]*width="688"/);
  });
});
