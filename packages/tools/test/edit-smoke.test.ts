import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveBinaries, run } from '@orkas/video-studio-core';
import { probeMedia, trim, concat, burnsubs, overlay, loudness, normalizeLoudness, mix } from '../src/edit/edit';

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
    expect(r.conform).toBeUndefined();
  });

  it('conforms mismatched canvas/fps inputs before joining, and reports it', async () => {
    // The concat demuxer takes canvas + time base from the FIRST input; without
    // conforming, a 12fps part after a 24fps part is reinterpreted and the
    // joined duration drifts (24/12 = 2x for that part).
    const odd = join(dir, 'odd.mp4');
    await run(bins.ffmpeg as string, [
      '-y',
      '-f', 'lavfi', '-i', 'testsrc=size=160x120:rate=12:duration=1',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
      odd,
    ]);
    const r = await concat([join(dir, 'a.mp4'), odd], join(dir, 'joined-mixed.mp4'));
    expect(r.conform?.applied).toBe(true);
    expect(r.conform?.target).toBe('320x240@24');
    expect(r.conform?.conformed_inputs).toHaveLength(1);
    const p = await probeMedia(r.output);
    expect(p.width).toBe(320);
    expect(p.duration).toBeGreaterThan(1.7);
    expect(p.duration).toBeLessThan(2.4);
  });

  it('burns CJK subtitles with a script-covering font', async () => {
    const srt = join(dir, 'zh.srt');
    writeFileSync(srt, '1\n00:00:00,000 --> 00:00:01,500\n指挥官与协作\n', 'utf8');
    const r = await burnsubs(src, srt, join(dir, 'subbed.mp4'));
    expect(existsSync(r.output)).toBe(true);
    expect((await probeMedia(r.output)).duration).toBeGreaterThan(1.5);
  });

  it('refuses a full-frame opaque overlay that would erase the base footage', async () => {
    const card = join(dir, 'card.mp4');
    await run(bins.ffmpeg as string, [
      '-y', '-f', 'lavfi', '-i', 'color=c=red:size=320x240:rate=24:duration=1',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', card,
    ]);
    await expect(overlay(src, card, 0, 0, join(dir, 'erased.mp4'))).rejects.toThrow(/replace the base footage/);
    // A sub-frame opaque overlay (logo box) keeps working.
    const logo = join(dir, 'logo.mp4');
    await run(bins.ffmpeg as string, [
      '-y', '-f', 'lavfi', '-i', 'color=c=blue:size=64x48:rate=24:duration=1',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', logo,
    ]);
    const ok = await overlay(src, logo, 8, 8, join(dir, 'badged.mp4'));
    expect(existsSync(ok.output)).toBe(true);
  });

  it('reports audio that outlives the video instead of calling it a truncation', async () => {
    const longTone = join(dir, 'long-tone.wav');
    await run(bins.ffmpeg as string, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=550:duration=4', longTone]);
    // 4s of narration onto a 2s base: nothing truncates it — the written file
    // carries sound past the video's end, and the report must say so.
    const r = await mix({
      base: src,
      segments: [{ path: longTone, start_sec: 0 }],
      on_existing_audio: 'replace',
      output: join(dir, 'overrun.mp4'),
    });
    expect(r.coverage?.status).toBe('over');
    expect(r.av_mismatch).toBeDefined();
    expect(r.av_mismatch!.audio_overrun_sec).toBeGreaterThan(1);
    expect(r.coverage?.warnings.join(' ')).toContain('outlives its video');
    expect(r.coverage?.warnings.join(' ')).not.toContain('will be truncated');
  });

  it('does not leave a partial output behind when ffmpeg fails', async () => {
    const out = join(dir, 'failed.mp4');
    await expect(burnsubs(src, join(dir, 'missing.srt'), out)).rejects.toThrow();
    expect(existsSync(out)).toBe(false);
  });

  it('measures integrated loudness', async () => {
    const l = await loudness(src);
    expect(Number.isFinite(l.input_i)).toBe(true);
  });

  it('normalizes loudness to a new output file', async () => {
    const r = await normalizeLoudness(src, join(dir, 'normalized.mp4'));
    expect(existsSync(r.output)).toBe(true);
    expect(Number.isFinite(r.loudness.input_i)).toBe(true);
  });

  it('reports coverage when mixing timed audio', async () => {
    const tone = join(dir, 'tone.wav');
    await run(bins.ffmpeg as string, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=660:duration=1', tone]);
    const r = await mix({
      base: src,
      segments: [{ path: tone, start_sec: 0 }],
      on_existing_audio: 'replace',
      output: join(dir, 'mixed.mp4'),
    });
    expect(existsSync(r.output)).toBe(true);
    expect(r.coverage?.status).toBe('ok');
    expect(r.coverage?.coverageRatio).toBeLessThan(1);
    expect(r.coverage?.trailingGapSec).toBeGreaterThan(0.5);
  });
});
