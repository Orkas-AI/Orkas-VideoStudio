import { afterAll, beforeAll, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveFfmpegTools, runOk } from '@orkas/video-studio-core';
import { shipTimeline } from '../src/composition/timeline-actions.js';
let root: string, video: string;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'ovs-version-')); video = join(root, 'source.mp4');
  await runOk(resolveFfmpegTools().ffmpeg, ['-y', '-f', 'lavfi', '-i', 'color=blue:s=320x180:r=24:d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', video]);
});
afterAll(async () => { await rm(root, { recursive: true, force: true }); });
it('keeps immutable delivered bytes, reuses only the latest verified version and rejects wrong promises', async () => {
  const rejected = await shipTimeline({ production: root, input: video, expect: { durationSec: 5 } });
  expect(rejected.ok).toBe(false);
  const first = await shipTimeline({ production: root, input: video, expect: { durationSec: 1, audio: false } });
  expect(first.ok).toBe(true);
  const again = await shipTimeline({ production: root, input: video, expect: { durationSec: 1 } });
  expect(again.version?.id).toBe(first.version?.id);
  const old = await readFile(join(root, first.version!.path));
  await writeFile(video, 'changed original');
  expect(await readFile(join(root, first.version!.path))).toEqual(old);
  await writeFile(join(root, first.version!.path), 'changed version');
  await writeFile(video, old);
  await expect(shipTimeline({ production: root, input: video })).rejects.toThrow(/missing or changed/);
});
it('leaves a damaged version history intact instead of resetting it', async () => {
  await writeFile(join(root, 'versions.json'), '{broken');
  await expect(shipTimeline({ production: root, input: video })).rejects.toThrow();
  expect(await readFile(join(root, 'versions.json'), 'utf8')).toBe('{broken');
});
it('records only explicitly named accepted findings and returns inspected-file frames without claiming a visual review', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ovs-accepted-'));
  try {
    const accepted = await shipTimeline({ production: directory, input: video, expect: { durationSec: 5, audio: false }, accept_findings: ['DELIVERY_DURATION_DRIFT'], accept_reason: 'The user explicitly kept the one-second cut.' });
    expect(accepted.ok).toBe(true);
    expect(accepted.version?.override).toMatchObject({ codes: ['DELIVERY_DURATION_DRIFT'] });
    expect(accepted.visual_review).toEqual({ status: 'not_checked' });
    expect(accepted.frames?.length).toBeGreaterThan(1);
    const stillBlocked = await shipTimeline({ production: directory, input: video, expect: { durationSec: 5, aspect: '9:16' }, accept_findings: ['DELIVERY_DURATION_DRIFT'], accept_reason: 'Keep length.' });
    expect(stillBlocked.ok).toBe(false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
