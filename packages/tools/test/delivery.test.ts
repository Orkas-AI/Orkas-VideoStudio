import { afterAll, beforeAll, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveFfmpegTools, runOk, type VideoEdl } from '@orkas/video-studio-core';
import { verifyProductionDelivery } from '../src/render/delivery.js';
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
it('checks direct model output for readability without enforcing local assembly tolerances', async () => {
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
  expect(checked.ok).toBe(true);
  expect(checked.is_generation).toBe(true);
  expect(checked.integrated_lufs).toBeNull();
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
