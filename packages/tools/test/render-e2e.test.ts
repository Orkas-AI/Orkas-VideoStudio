import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync, mkdirSync, statSync, writeFileSync, readFileSync, cpSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveBinaries, type VideoEdl } from '@orkas/video-studio-core';
import { resolveHyperframesInvocation } from '../src/hyperframes/client';

const bins = resolveBinaries();
const suite = process.env.OVS_E2E === '1' ? describe : describe.skip;
const cli = fileURLToPath(new URL('../../cli/dist/index.js', import.meta.url));
const fixture = fileURLToPath(new URL('./fixtures/production-video/', import.meta.url));

suite('video production e2e (public CLI + real HyperFrames)', () => {
  const keep = process.env.OVS_VIDEO_EVIDENCE_DIR;
  if (keep) mkdirSync(resolve(keep), { recursive: true });
  const dir = mkdtempSync(join(keep ? resolve(keep) : tmpdir(), 'ovs-production-'));
  const project = join(dir, 'composition');
  const draft = join(dir, 'picture-and-sound.mp4');
  const final = join(dir, 'video.mp4');
  const planFile = join(dir, 'plan.json');
  let step = 0;
  const logReview: Array<{ command: string; stderrLines: number; classification: string }> = [];

  function command(executable: string, args: string[], status = 0) {
    const result = spawnSync(executable, args, { encoding: 'utf8', timeout: 600_000, maxBuffer: 32 * 1024 * 1024 });
    const prefix = join(dir, `${String(step++).padStart(2, '0')}-${executable === process.execPath ? args[1] : 'media'}`);
    writeFileSync(`${prefix}-stdout.log`, result.stdout || '');
    writeFileSync(`${prefix}-stderr.log`, result.stderr || '');
    expect(result.error, `command launch: ${prefix}`).toBeUndefined();
    expect(result.status, `command result: ${prefix}\n${result.stdout?.slice(-3000)}\n${result.stderr?.slice(-1000)}`).toBe(status);
    const lines = (result.stderr || '').split(/\r?\n/).filter(Boolean);
    let classification = 'empty';
    if (executable === process.execPath && args[1] === 'draft') {
      // HyperFrames 0.7.60 emits severity-prefixed renderer logs plus its GPU status.
      for (const line of lines) expect(line.startsWith('[INFO] ') || line.startsWith('[hyperframes] browserGpuMode '), 'unclassified renderer stderr').toBe(true);
      classification = 'renderer info and GPU selection';
    } else if (executable === process.execPath && args[1] === 'edit' && args[2] === 'burnsubs') {
      for (const line of lines) {
        const event = JSON.parse(line);
        expect(event.type).toBe('progress');
        expect(['running', 'completed']).toContain(event.status);
      }
      expect(JSON.parse(lines.at(-1)!).status).toBe('completed');
      classification = 'asserted subtitle progress';
    } else expect(lines, 'unexpected command stderr').toEqual([]);
    logReview.push({ command: executable === process.execPath ? args.slice(1, 3).filter((arg) => !arg.includes('/')).join(' ') : 'media', stderrLines: lines.length, classification });
    return result;
  }
  function ovs(args: string[], status = 0) {
    return JSON.parse(command(process.execPath, [cli, ...args], status).stdout);
  }
  function pixels(video: string, time: number, filter: string): Buffer {
    const result = spawnSync(bins.ffmpeg!, ['-v', 'error', '-ss', String(time), '-i', video, '-vf', filter, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { timeout: 60_000, maxBuffer: 8 * 1024 * 1024 });
    expect(result.status).toBe(0);
    expect(result.stderr.toString()).toBe('');
    return result.stdout;
  }
  function difference(a: Buffer, b: Buffer) {
    expect(a.length).toBeGreaterThan(0);
    expect(a.length).toBe(b.length);
    return a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / a.length;
  }

  beforeAll(() => {
    expect([bins.node, bins.ffmpeg, bins.ffprobe].every(Boolean), 'Node, ffmpeg and ffprobe are mandatory when OVS_E2E=1').toBe(true);
    expect(existsSync(cli), 'run pnpm build before production E2E').toBe(true);
    expect(resolveHyperframesInvocation('doctor').source).toBe('dependency');
    cpSync(fixture, project, { recursive: true });
    mkdirSync(join(project, 'assets'), { recursive: true });
    // Deterministic instrumental fixture: no paid synthesis, network, voice or model.
    command(bins.ffmpeg!, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'aevalsrc=0.10*sin(2*PI*220*t)+0.06*sin(2*PI*330*t)+0.04*sin(2*PI*440*t):s=48000:d=9', '-af', 'afade=t=in:d=0.1,afade=t=out:st=8.5:d=0.5', '-ac', '2', join(project, 'assets/music.wav')]);
    const plan: VideoEdl = {
      aspect: '16:9', total_target_sec: 9, language: 'en',
      delivery_promise: { type: 'compose_led', source_required: false, motion_min_ratio: 0 },
      segments: [{ id: 'composition', order: 1, role: 'body', layer: 'primary', source: 'compose', target_sec: 9, spec: { project }, produced_path: final }],
      tracks: { captions: { lines: [
        { text: 'One plan. A clear story.', start_sec: 0, target_sec: 2.9 },
        { text: 'Three scenes. Real motion.', start_sec: 3, target_sec: 2.9 },
        { text: 'A playable video, verified.', start_sec: 6, target_sec: 2.9 },
      ] } },
    };
    writeFileSync(planFile, JSON.stringify(plan, null, 2));
  });
  afterAll(() => { if (!keep) rmSync(dir, { recursive: true, force: true }); });

  it('produces a complete three-scene video with motion, audio and burned captions before acceptance', () => {
    const authored = readFileSync(join(project, 'index.html'), 'utf8');
    expect(ovs(['composition', 'prepare', project]).ok).toBe(true);
    expect(ovs(['composition', 'reconcile', project]).ok).toBe(true);
    expect(readFileSync(join(project, 'index.html'), 'utf8')).toContain('id="playhead"');
    expect(authored).toContain('Plan the story');
    const preview = ovs(['snapshot', project, '--out', join(dir, 'preview.png')]);
    expect(preview.frame_paths.length).toBeGreaterThanOrEqual(3);
    for (const file of preview.frame_paths) expect(statSync(file).size).toBeGreaterThan(1000);
    writeFileSync(join(dir, 'preview-report.json'), JSON.stringify(preview, null, 2));
    const rendered = ovs(['draft', project, '--out', draft, '--quality', 'high', '--report', join(dir, 'draft-report.json'), '--evidence-dir', join(dir, 'rendered-frames')]);
    expect(rendered.ok).toBe(true);
    expect(rendered.report.steps.media_qa.ok).toBe(true);
    expect(rendered.report.steps.video_qa.ok).toBe(true);
    ovs(['edit', 'burnsubs', draft, '--srt', join(project, 'captions.srt'), '--out', final]);
    copyFileSync(join(project, 'captions.srt'), join(dir, 'video.srt'));
    expect(statSync(final).size).toBeGreaterThan(10_000);
    const probe = ovs(['edit', 'probe', final]);
    expect(probe.width).toBe(1920);
    expect(probe.height).toBe(1080);
    expect(probe.v_codec).toBe('h264');
    expect(probe.has_audio).toBe(true);
    // The video timeline is exact; AAC normalization may pad the audio tail.
    // The accepted delivery contract allows 0.5s container/audio tolerance.
    expect(probe.video_duration).toBeCloseTo(9, 1);
    expect(Math.abs(probe.duration - 9)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(probe.audio_duration - 9)).toBeLessThanOrEqual(0.5);
    // Decode the whole file, not just the container header.
    expect(command(bins.ffmpeg!, ['-v', 'error', '-i', final, '-f', 'null', '-']).stderr).toBe('');
    const background = [[20, 60, 74], [75, 36, 74], [36, 76, 48]];
    for (const [i, time] of [1.5, 4.5, 7.5].entries()) {
      const sample = pixels(final, time, 'crop=2:2:20:20');
      for (let channel = 0; channel < 3; channel++) expect(Math.abs(sample[channel] - background[i][channel])).toBeLessThan(8);
      // Burned captions must change the bottom band in every scene.
      expect(difference(pixels(draft, time, 'crop=1920:180:0:900,scale=320:30'), pixels(final, time, 'crop=1920:180:0:900,scale=320:30'))).toBeGreaterThan(1);
      command(bins.ffmpeg!, ['-v', 'error', '-y', '-ss', String(time), '-i', final, '-frames:v', '1', join(dir, `scene-${i + 1}.png`)]);
    }
    // The delivered opening is visible and both moving scenes really change pixels.
    const opening = pixels(final, 0, 'scale=192:108');
    expect(opening.filter((value) => value > 180).length).toBeGreaterThan(400);
    for (const time of [0, 3]) expect(difference(pixels(final, time + 0.4, 'crop=1640:410:120:375,scale=164:41'), pixels(final, time + 2.4, 'crop=1640:410:120:375,scale=164:41'))).toBeGreaterThan(1);
    const pcm = spawnSync(bins.ffmpeg!, ['-v', 'error', '-i', final, '-vn', '-ac', '1', '-ar', '8000', '-f', 'f32le', '-'], { maxBuffer: 1024 * 1024 });
    expect(pcm.status).toBe(0);
    expect(pcm.stderr.toString()).toBe('');
    for (const second of [1, 4, 7]) {
      let energy = 0;
      for (let i = second * 8000; i < (second + 1) * 8000; i++) energy += pcm.stdout.readFloatLE(i * 4) ** 2;
      expect(Math.sqrt(energy / 8000)).toBeGreaterThan(0.01);
    }
    const accepted = ovs(['plan', 'promise-check', planFile, '--video', final]);
    expect(accepted.verdict).not.toBe('fail');
    expect(accepted.delivery.ok).toBe(true);
    const wrong = { ...JSON.parse(readFileSync(planFile, 'utf8')), total_target_sec: 12 };
    writeFileSync(join(dir, 'wrong-plan.json'), JSON.stringify(wrong));
    const rejected = ovs(['plan', 'promise-check', join(dir, 'wrong-plan.json'), '--video', final], 1);
    expect(rejected.delivery.issues.some((issue: { code: string }) => issue.code === 'DELIVERY_DURATION_DRIFT')).toBe(true);
    writeFileSync(join(dir, 'production-evidence.json'), JSON.stringify({ ok: true, final, probe, delivery: accepted.delivery, logReview, checks: ['full-decode', 'scene-order', 'visible-opening', 'real-motion', 'audible-all-scenes', 'burned-captions-all-scenes', 'reject-wrong-duration'] }, null, 2));
  }, 600_000);
});
