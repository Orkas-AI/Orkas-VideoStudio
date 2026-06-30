import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveBinaries, run } from '@orkas/video-studio-core';
import { probeMedia, trim, concat, loudness } from '../src/edit/edit';

const bins = resolveBinaries();
// Real ffmpeg smoke — runs only where ffmpeg + ffprobe are installed.
const suite = bins.ffmpeg && bins.ffprobe ? describe : describe.skip;

suite('edit smoke (real ffmpeg)', () => {
  const dir = join(tmpdir(), `ovs-edit-smoke-${process.pid}`);
  const src = join(dir, 'src.mp4');

  beforeAll(async () => {
    mkdirSync(dir, { recursive: true });
    // 2s 320x240 test pattern with a 440Hz tone (so it has both video and audio).
    await run(bins.ffmpeg as string, [
      '-y',
      '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=24:duration=2',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
      src,
    ]);
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('probes the generated clip', async () => {
    const p = await probeMedia(src);
    expect(p.width).toBe(320);
    expect(p.height).toBe(240);
    expect(p.has_audio).toBe(true);
    expect(p.duration).toBeGreaterThan(1.5);
  });

  it('trims to a frame-accurate sub-clip', async () => {
    const r = await trim({ input: src, start_sec: 0.5, duration_sec: 1, output: join(dir, 'cut.mp4') });
    expect(existsSync(r.output)).toBe(true);
    const p = await probeMedia(r.output);
    expect(p.duration).toBeGreaterThan(0.8);
    expect(p.duration).toBeLessThan(1.3);
  });

  it('concatenates two cuts into one clip', async () => {
    await trim({ input: src, start_sec: 0, duration_sec: 1, output: join(dir, 'a.mp4') });
    await trim({ input: src, start_sec: 1, duration_sec: 1, output: join(dir, 'b.mp4') });
    const r = await concat([join(dir, 'a.mp4'), join(dir, 'b.mp4')], join(dir, 'joined.mp4'));
    const p = await probeMedia(r.output);
    expect(p.duration).toBeGreaterThan(1.7);
  });

  it('measures integrated loudness', async () => {
    const l = await loudness(src);
    expect(Number.isFinite(l.input_i)).toBe(true);
  });
});
