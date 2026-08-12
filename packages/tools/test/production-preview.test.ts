import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveBinaries, run } from '@orkas/video-studio-core';
import { buildProductionPreviewPlan, productionPreview } from '../src/production-preview';

describe('buildProductionPreviewPlan', () => {
  const segments = [
    { id: 's1_hook', order: 1, layer: 'primary', target_sec: 6 },
    { id: 's2_cap', order: 2, layer: 'overlay', target_sec: 3 },
    { id: 's3_body', order: 3, layer: 'primary', target_sec: 8 },
    { id: 's4_cta', order: 4, layer: 'primary', target_sec: 6 },
  ];

  it('samples the cover plus each primary segment midpoint, scaled to the real duration', () => {
    // Planned primaries total 20s but the real cut is 10s → every window halves.
    const { samples, warnings } = buildProductionPreviewPlan(segments, 10);
    expect(warnings).toEqual([]);
    expect(samples.map((s) => s.label)).toEqual(['cover', '1-s1_hook', '2-s3_body', '3-s4_cta']);
    expect(samples[1].time_seconds).toBeCloseTo(1.5, 1); // 0..3 window
    expect(samples[2].time_seconds).toBeCloseTo(5, 1); // 3..7 window
    expect(samples[3].time_seconds).toBeCloseTo(8.5, 1); // 7..10 window
  });

  it('never samples past the last seekable moment', () => {
    const { samples } = buildProductionPreviewPlan([{ id: 'only', order: 1, layer: 'primary', target_sec: 5 }], 0.3);
    expect(samples.every((s) => s.time_seconds <= 0.3)).toBe(true);
  });

  it('degrades to the cover alone without primaries or a duration', () => {
    expect(buildProductionPreviewPlan([], 10).samples.map((s) => s.label)).toEqual(['cover']);
    expect(buildProductionPreviewPlan(segments, 0).samples.map((s) => s.label)).toEqual(['cover']);
    expect(buildProductionPreviewPlan(undefined, 10).samples.map((s) => s.label)).toEqual(['cover']);
  });

  it('caps the sheet and says what was dropped', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ id: `s${i}`, order: i + 1, layer: 'primary', target_sec: 2 }));
    const { samples, warnings } = buildProductionPreviewPlan(many, 60);
    expect(samples).toHaveLength(25); // cover + 24
    expect(warnings.join(' ')).toContain('first 24 of 30');
  });
});

const bins = resolveBinaries();
const suite = bins.ffmpeg && bins.ffprobe ? describe : describe.skip;

suite('productionPreview (real ffmpeg)', () => {
  const dir = join(tmpdir(), `ovs-prod-preview-${process.pid}`);
  const video = join(dir, 'assembled.mp4');

  beforeAll(async () => {
    mkdirSync(dir, { recursive: true });
    await run(bins.ffmpeg as string, [
      '-y', '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=24:duration=4',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', video,
    ]);
    writeFileSync(join(dir, 'plan.json'), JSON.stringify({
      segments: [
        { id: 'hook', order: 1, layer: 'primary', target_sec: 2 },
        { id: 'payoff', order: 2, layer: 'primary', target_sec: 2 },
      ],
    }), 'utf8');
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('extracts one frame per primary segment and composes one sheet', async () => {
    const result = await productionPreview(join(dir, 'plan.json'), video, join(dir, 'preview'));
    expect(result.ok).toBe(true);
    expect(result.frames.map((f) => f.label)).toEqual(['cover', '1-hook', '2-payoff']);
    for (const frame of result.frames) expect(existsSync(frame.path)).toBe(true);
    expect(existsSync(result.contact_sheet)).toBe(true);
    const sheet = readFileSync(result.contact_sheet, 'utf8');
    expect(sheet).toContain('1-hook');
    expect(sheet).toContain('2-payoff');
  });
});
