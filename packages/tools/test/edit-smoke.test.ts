import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { existsSync, readFileSync, readdirSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseIntegratedLufs, resolveBinaries, run } from '@orkas/video-studio-core';
import { probeMedia, trim, concat, reframe, burnsubs, overlay, loudness, normalizeLoudness, mix, REPLACE_DROPS_SOUND_WARNING } from '../src/edit/edit';
import { buildMixFilter, buildNormalizeLoudnessArgs, normalizeLoudnessAudioFilter } from '../src/edit/args';

const bins = resolveBinaries();
// Real ffmpeg smoke — runs only where ffmpeg + ffprobe are installed.
const suite = bins.ffmpeg && bins.ffprobe ? describe : describe.skip;

suite('fixed-picture captioned dub (real ffmpeg)', () => {
  it('places an existing voice slice and burns its literal caption while preserving picture length', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ovs-dub-'));
    try {
      const input = join(dir, 'picture.mp4'), voice = join(dir, 'voice.wav'), output = join(dir, 'dub.mp4');
      const ff = (...args: string[]) => {
        const r = spawnSync(bins.ffmpeg!, ['-v', 'error', '-nostdin', '-y', ...args], { encoding: 'utf8' });
        expect(r.status, r.stderr).toBe(0);
      };
      ff('-f', 'lavfi', '-i', 'color=c=black:s=320x180:r=24:d=2', '-c:v', 'libx264', input);
      ff('-f', 'lavfi', '-i', 'sine=frequency=440:duration=1.5', voice);
      const caption = 'Price: $199';
      const options = { base: input, output, fit_dub: true, on_existing_audio: 'replace' as const };
      const failed = await mix({ ...options, segments: [{ path: voice, start_sec: 0.5, end_sec: 1.5, caption }] });
      expect(failed).toMatchObject({ ok: false, dub_fit_issues: [{ segment: 1, reason: 'too_long' }] });
      expect(existsSync(output)).toBe(false);
      const result = await mix({ ...options, segments: [{
        path: voice, start_sec: 0.5, end_sec: 1.5, source_start: 0.25, source_end: 1, caption,
      }] });
      expect(result).toMatchObject({ output, caption_cues: [{ start_sec: 0.75, end_sec: 1.5, text: caption }] });
      expect(await probeMedia(output)).toMatchObject({ video_duration: 2, has_audio: true });
      const picture = spawnSync(bins.ffmpeg!, ['-v', 'error', '-ss', '1', '-i', output, '-frames:v', '1', '-pix_fmt', 'gray', '-f', 'rawvideo', 'pipe:1']);
      expect(picture.status).toBe(0);
      expect(picture.stdout.some(value => value > 150)).toBe(true);
      const before = spawnSync(bins.ffmpeg!, ['-v', 'error', '-ss', '0.25', '-i', output, '-frames:v', '1', '-pix_fmt', 'gray', '-f', 'rawvideo', 'pipe:1']);
      expect(before.status).toBe(0);
      expect(before.stdout.some(value => value > 150)).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

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

  it('keeps the narrated clip audible after a silent opener', async () => {
    const silent = join(dir, 'silent.mp4');
    await run(bins.ffmpeg as string, ['-y', '-i', src, '-map', '0:v:0', '-c:v', 'copy', '-t', '1', silent]);
    const { output } = await concat([silent, src], join(dir, 'with-narration.mp4'));
    expect((await probeMedia(output)).duration).toBeCloseTo(3, 0);
    const measurement = await run(bins.ffmpeg as string, [
      '-ss', '1.4', '-i', output, '-t', '1', '-vn', '-af', 'volumedetect', '-f', 'null', '-',
    ]);
    const peak = measurement.stderr.match(/max_volume: (-?[\d.]+) dB/);
    expect(peak).not.toBeNull();
    expect(Number(peak?.[1])).toBeGreaterThan(-32);
  });

  it.each(['crop', 'blur'] as const)('fits the canvas with %s without losing audio', async (mode) => {
    const { output } = await reframe({ input: src, output: join(dir, `${mode}.mp4`), width: 180, height: 320, mode });
    expect(await probeMedia(output)).toMatchObject({ width: 180, height: 320, has_audio: true });
  });

  it('does not overwrite the source or create output for a bad canvas', async () => {
    const original = readFileSync(src);
    await expect(reframe({ input: src, output: src, aspect: '1:1' })).rejects.toThrow(/output resolves to the input/);
    expect(readFileSync(src)).toEqual(original);
    const output = join(dir, 'bad-canvas.mp4');
    await expect(reframe({ input: src, output, width: 180 })).rejects.toThrow(/width and height/);
    expect(existsSync(output)).toBe(false);
  });

  it('burns CJK subtitles with a script-covering font', async () => {
    const srt = join(dir, "字幕 [1], it's; final.srt");
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

  // A drama recap mixed its narration with `replace` and dropped every line the
  // characters said, though the recap guide asks for at least one in their own voices.
  it('warns that replacing a clip\'s own sound drops its dialogue, and says nothing when that sound is kept or is silence', async () => {
    const line = join(dir, 'line.wav');
    await run(bins.ffmpeg as string, ['-y', '-f', 'lavfi', '-i', 'sine=f=900:r=48000:d=1', line]);
    const segments = [{ path: line, start_sec: 0.5 }];
    expect(REPLACE_DROPS_SOUND_WARNING).toBe("replace drops the clip's own sound, every line of dialogue with it. A recap keeps at least one line in the characters' own voices: use --on-existing-audio mix --duck for those spans.");
    const replaced = await mix({ base: src, segments, on_existing_audio: 'replace', output: join(dir, 'replaced.mp4') });
    expect(replaced).toMatchObject({ warning: REPLACE_DROPS_SOUND_WARNING });
    const kept = await mix({ base: src, segments, on_existing_audio: 'mix', duck: true, output: join(dir, 'kept.mp4') });
    expect(existsSync(kept.output)).toBe(true);
    expect(kept).not.toHaveProperty('warning');
    const silentBase = join(dir, 'silent-base.mp4');
    await run(bins.ffmpeg as string, ['-y', '-f', 'lavfi', '-i', 'testsrc2=s=320x240:r=24:d=2', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
      '-shortest', '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', silentBase]);
    const quiet = await mix({ base: silentBase, segments, on_existing_audio: 'replace', output: join(dir, 'quiet.mp4') });
    expect(existsSync(quiet.output)).toBe(true);
    expect(quiet).not.toHaveProperty('warning');
  });

  // sidechaincompress drained on a partial last audio frame and dropped the music once the
  // narration's duck released. Loudness normalization is a separate time-varying stage, so
  // the ducking graph itself is measured, through an independent frequency reading.
  it('keeps the base sound after the sidechain release when ducking', async () => {
    const music = join(dir, 'music.wav');
    const speech = join(dir, 'speech.wav');
    await run(bins.ffmpeg as string, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=48000:duration=4', '-c:a', 'pcm_s16le', music]);
    await run(bins.ffmpeg as string, ['-y', '-f', 'lavfi', '-i', "aevalsrc='if(between(t,1,3),0.3*sin(2*PI*660*t),0)':s=48000:d=4", '-c:a', 'pcm_s16le', speech]);
    const sources = [readFileSync(music), readFileSync(speech)];
    const levels = (duck: boolean): number[] => {
      const { filter } = buildMixFilter({ base: music, baseHasAudio: true, segments: [{ path: speech, start_sec: 0 }], on_existing_audio: 'mix', duration_sec: 4, duck, output: 'unused' });
      expect(filter).toContain(normalizeLoudnessAudioFilter());
      const output = join(dir, duck ? 'ducked.wav' : 'plain.wav');
      const made = spawnSync(bins.ffmpeg as string, ['-y', '-v', 'error', '-nostdin', '-i', music, '-i', speech,
        '-filter_complex', filter.replace(normalizeLoudnessAudioFilter(), 'anull'), '-map', '[outa]', '-c:a', 'pcm_s16le', output], { encoding: 'utf8', timeout: 30_000 });
      expect(made.status, made.stderr).toBe(0);
      // Decode the whole file so seek accuracy cannot choose which late samples are read.
      const pcm = spawnSync(bins.ffmpeg as string, ['-v', 'error', '-nostdin', '-i', output, '-ac', '1', '-ar', '48000', '-f', 'f32le', '-'], { timeout: 30_000, maxBuffer: 8 * 1024 * 1024 }).stdout;
      return [0.2, 1.8, 3.7].map((start) => {
        const first = Math.round(start * 48000), count = 14400;
        expect(pcm.length / 4).toBeGreaterThanOrEqual(first + count);
        let re = 0, im = 0;
        for (let i = 0; i < count; i++) {
          const sample = pcm.readFloatLE((first + i) * 4);
          re += sample * Math.cos(i * 2 * Math.PI * 220 / 48000);
          im += sample * Math.sin(i * 2 * Math.PI * 220 / 48000);
        }
        return Math.hypot(re, im) / count;
      });
    };
    const plain = levels(false), ducked = levels(true);
    expect(plain.every((amplitude) => amplitude > 0.03)).toBe(true);
    expect(ducked[0] / plain[0]).toBeGreaterThan(0.95);
    expect(ducked[1] / plain[1]).toBeLessThan(0.4);
    expect(ducked[2] / plain[2]).toBeGreaterThan(0.8);
    expect(readFileSync(music)).toEqual(sources[0]);
    expect(readFileSync(speech)).toEqual(sources[1]);
  }, 30_000);
});

// A quiet mix with louder moments (a music bed under a 2s voice-over) came out of one
// loudnorm pass at -18.4 LUFS against -14; a measured second pass reaches the target.
suite('normalize-loudness reaches the delivery loudness (real ffmpeg)', () => {
  const dir = join(tmpdir(), `ovs-edit-loudness-${process.pid}`);
  const quiet = join(dir, 'quiet.mp4');
  // Measured independently of the op, as delivery measures it.
  const integrated = (file: string): number => {
    const r = spawnSync(bins.ffmpeg as string, ['-hide_banner', '-nostats', '-i', file, '-map', '0:a:0', '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8', timeout: 60_000 });
    const value = parseIntegratedLufs(r.stderr);
    expect(value, r.stderr.slice(-400)).not.toBeNull();
    return value as number;
  };

  beforeAll(async () => {
    mkdirSync(dir, { recursive: true });
    await run(bins.ffmpeg as string, ['-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'lavfi', '-i', 'anoisesrc=d=20:c=pink:a=0.03:seed=7',
      '-f', 'lavfi', '-i', 'sine=f=300:d=2.5,volume=0.35,tremolo=f=5:d=0.8',
      '-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=25:d=20',
      '-filter_complex', '[1:a]adelay=300|300,apad[v];[0:a][v]amix=inputs=2:duration=first:normalize=0,aformat=channel_layouts=stereo[a]',
      '-map', '2:v', '-map', '[a]', '-t', '20', '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', quiet]);
  }, 120_000);

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('brings a quiet music bed under a short voice within 2 LU of -14 LUFS', async () => {
    const result = await normalizeLoudness(quiet, join(dir, 'normalized.mp4'));
    expect(Math.abs(integrated(result.output) + 14)).toBeLessThanOrEqual(2);
  }, 120_000);

  it('applies a measurement the caller already made, as a render does', async () => {
    const before = await loudness(quiet);
    expect(before.input_i).toBeLessThan(-25);
    expect(Number.isFinite(before.input_thresh)).toBe(true);
    expect(Number.isFinite(before.target_offset)).toBe(true);
    const result = await normalizeLoudness(quiet, join(dir, 'premeasured.mp4'), undefined, before);
    expect(Math.abs(integrated(result.output) + 14)).toBeLessThanOrEqual(2);
  }, 120_000);

  it('is still off target after one unmeasured pass', async () => {
    const single = join(dir, 'single.mp4');
    await run(bins.ffmpeg as string, buildNormalizeLoudnessArgs(quiet, single));
    expect(Math.abs(integrated(single) + 14)).toBeGreaterThan(2);
  }, 120_000);
});

// A cut at a place in the music (start 3.005s into a 4s clip) returned a 0.97s piece
// as a plain success; the joined montage came out short and off the beat.
suite('trim reports the length it actually cut (real ffmpeg)', () => {
  const dir = join(tmpdir(), `ovs-edit-trim-length-${process.pid}`);
  const clip = join(dir, 'room.mp4');
  const pictureFrames = (file: string): number => Number(spawnSync(bins.ffprobe as string, ['-v', 'error', '-count_frames',
    '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout.trim());

  beforeAll(async () => {
    mkdirSync(dir, { recursive: true });
    await run(bins.ffmpeg as string, ['-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=30:d=4', '-f', 'lavfi', '-i', 'sine=f=300:r=48000:d=4',
      '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', clip]);
  }, 60_000);

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('says so when the clip ends before the requested length', async () => {
    const result = await trim({ input: clip, start_sec: 3.005, duration_sec: 2.4, output: join(dir, 'short.mp4') });
    // 4 - 3.005 leaves at most 0.995s: 29 or 30 frames, never the 72 asked for.
    expect(pictureFrames(result.output)).toBeLessThanOrEqual(30);
    expect(result.duration_sec).toBeGreaterThan(0.9);
    expect(result.duration_sec).toBeLessThan(1);
    expect(result.warning).toMatch(/The input is 4\.0\ds long, so from 3\.005s this cut is 0\.9\ds/);
    expect(result.warning).toContain('not the 2.40s asked for');
    expect(result.warning).toContain('--start (start_sec) is a time inside the input');
    expect(result.warning).toMatch(/start at or before 1\.6\ds for the full length/);
  }, 60_000);

  it('reports the full length and no warning when the clip holds it', async () => {
    const result = await trim({ input: clip, start_sec: 1.6, duration_sec: 2.4, output: join(dir, 'fits.mp4') });
    expect(pictureFrames(result.output)).toBe(72);
    expect(result.duration_sec).toBeCloseTo(2.4, 2);
    expect(result.warning).toBeUndefined();
  }, 60_000);

  it('says the clip itself is too short when no start would give the length', async () => {
    const result = await trim({ input: clip, start_sec: 0, duration_sec: 5, output: join(dir, 'whole.mp4') });
    expect(result.duration_sec).toBeCloseTo(4, 1);
    expect(result.warning).toMatch(/The input is only 4\.0\ds long/);
    expect(result.warning).toContain('not the 5.00s asked for');
    expect(result.warning).not.toContain('start at or before');
  }, 60_000);
});

// A 16-character Chinese line burned on a vertical video ran off both edges. A plain caption
// file is burned from a working copy with its long lines broken to the frame's width.
suite('long caption lines on a vertical frame (real ffmpeg)', () => {
  const dir = join(tmpdir(), `ovs-edit-captions-${process.pid}`);
  const [w, h] = [360, 640];
  const input = join(dir, 'clip.mp4');
  // Each burn runs with its own temporary directory, so a working copy left behind is visible.
  const withScratchTmp = async <T>(body: (scratch: string) => Promise<T>): Promise<T> => {
    const scratch = mkdtempSync(join(dir, 'tmp-'));
    vi.stubEnv(process.platform === 'win32' ? 'TEMP' : 'TMPDIR', scratch);
    try {
      return await body(scratch);
    } finally {
      vi.unstubAllEnvs();
    }
  };

  beforeAll(async () => {
    mkdirSync(dir, { recursive: true });
    await run(bins.ffmpeg as string, ['-y', '-v', 'error', '-f', 'lavfi', '-i', `color=c=black:s=${w}x${h}:r=30:d=2`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', input]);
  }, 60_000);

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('keeps every character inside the frame and leaves the caption file as it was', async () => {
    const subtitles = join(dir, 'captions.srt');
    const body = '1\n00:00:00,000 --> 00:00:02,000\n想吃的朋友，可以提前在群里跟我说，帮你留着。\n';
    writeFileSync(subtitles, body);
    const out = join(dir, 'captioned.mp4');
    await withScratchTmp(async (scratch) => {
      await burnsubs(input, subtitles, out);
      expect(readdirSync(scratch)).toEqual([]);
    });
    expect(readFileSync(subtitles, 'utf8')).toBe(body);
    const frame = spawnSync(bins.ffmpeg as string, ['-v', 'error', '-ss', '1', '-i', out, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1'], { maxBuffer: 1 << 26 });
    expect(frame.status).toBe(0);
    const px = frame.stdout as Buffer;
    let lit = 0; let atEdge = 0;
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      if (px[y * w + x] <= 100) continue;
      lit += 1;
      if (x < 4 || x >= w - 4) atEdge += 1;
    }
    expect(lit).toBeGreaterThan(500);
    expect(atEdge).toBe(0);
  }, 60_000);

  // A phone held upright stores 640x360 pixels with a 90° display rotation; ffmpeg turns the
  // picture upright before the captions are drawn, so they are sized and wrapped for 360x640.
  it('sizes and wraps captions for the displayed frame of a rotated recording', async () => {
    const stored = join(dir, 'stored.mp4');
    const rotated = join(dir, 'rotated.mp4');
    await run(bins.ffmpeg as string, ['-y', '-v', 'error', '-f', 'lavfi', '-i', `color=c=black:s=${h}x${w}:r=30:d=2`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', stored]);
    await run(bins.ffmpeg as string, ['-y', '-v', 'error', '-display_rotation', '90', '-i', stored, '-c', 'copy', rotated]);
    expect(await probeMedia(rotated)).toMatchObject({ width: h, height: w });
    const subtitles = join(dir, 'rotated.srt');
    writeFileSync(subtitles, '1\n00:00:00,000 --> 00:00:02,000\n想吃的朋友，可以提前在群里跟我说，帮你留着。\n');
    const out = join(dir, 'rotated-captioned.mp4');
    await burnsubs(rotated, subtitles, out);
    const frame = spawnSync(bins.ffmpeg as string, ['-v', 'error', '-ss', '1', '-i', out, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1'], { maxBuffer: 1 << 26 });
    expect(frame.status).toBe(0);
    const px = frame.stdout as Buffer;
    expect(px.length).toBe(w * h);
    let lit = 0; let atEdge = 0; let lowest = 0;
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      if (px[y * w + x] <= 100) continue;
      lit += 1;
      lowest = Math.max(lowest, y);
      if (x < 4 || x >= w - 4) atEdge += 1;
    }
    expect(lit).toBeGreaterThan(500);
    expect(atEdge).toBe(0);
    // Raised above the platform buttons: 60 of 288 units is about 133 px on 640.
    expect(h - lowest).toBeGreaterThan(0.15 * h);
  }, 60_000);

  it('writes no working copy when the cover band is refused', async () => {
    const subtitles = join(dir, 'wide.srt');
    writeFileSync(subtitles, '1\n00:00:00,000 --> 00:00:02,000\n' + '很长的字幕'.repeat(10) + '\n');
    const out = join(dir, 'wide.mp4');
    await withScratchTmp(async (scratch) => {
      await expect(burnsubs(input, subtitles, out, { cover: { top: 0.2, bottom: 0.9 } })).rejects.toThrow(/cover/);
      expect(readdirSync(scratch)).toEqual([]);
    });
    expect(existsSync(out)).toBe(false);
  }, 60_000);
});

// A silent composed title card first, narrated cuts after: the concat demuxer takes its
// streams from the first input, so the joined video had no audio at all; a silent part in
// the middle ended it early. The decoded sound is checked where each part plays.
suite('concat when only some parts carry sound (real ffmpeg)', () => {
  const dir = join(tmpdir(), `ovs-edit-concat-sound-${process.pid}`);
  const clip = async (name: string, withAudio: boolean): Promise<string> => {
    const out = join(dir, name);
    await run(bins.ffmpeg as string, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=640x360:r=24:d=2',
      ...(withAudio ? ['-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=2', '-c:a', 'aac', '-shortest'] : []),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', out]);
    return out;
  };
  const streamDuration = (file: string, stream: 'a' | 'v'): number | null => {
    const r = spawnSync(bins.ffprobe as string, ['-v', 'error', '-select_streams', `${stream}:0`, '-show_entries', 'stream=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    const value = Number(r.stdout.trim());
    return r.stdout.trim() && Number.isFinite(value) ? value : null;
  };
  const audioPeak = (file: string, start: number): number => {
    const decoded = spawnSync(bins.ffmpeg as string, ['-v', 'error', '-ss', String(start), '-i', file, '-t', '1',
      '-map', '0:a:0', '-ac', '1', '-ar', '8000', '-f', 's16le', 'pipe:1'], { timeout: 10_000 });
    expect(decoded.status, String(decoded.stderr)).toBe(0);
    expect(decoded.stdout.length).toBe(16_000);
    let peak = 0;
    for (let offset = 0; offset < decoded.stdout.length; offset += 2) peak = Math.max(peak, Math.abs(decoded.stdout.readInt16LE(offset)));
    return peak / 32768;
  };

  beforeAll(() => mkdirSync(dir, { recursive: true }));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it.each([
    ['silent part first', [false, true]],
    ['silent part last', [true, false]],
  ])('keeps the sound across the whole join with the %s', async (label, layout) => {
    const tag = label.replace(/\W+/g, '-');
    const parts = await Promise.all(layout.map((withAudio, index) => clip(`${tag}-${index}.mp4`, withAudio)));
    const result = await concat(parts, join(dir, `${tag}-joined.mp4`));
    expect(streamDuration(result.output, 'a')).toBeGreaterThan(3.8);
    expect(streamDuration(result.output, 'v')).toBeCloseTo(4, 1);
    for (const [index, withAudio] of layout.entries()) {
      const peak = audioPeak(result.output, index * 2 + 0.5);
      if (withAudio) expect(peak).toBeGreaterThan(0.05);
      else expect(peak).toBeLessThan(0.001);
    }
    expect(result.audio_conform?.padded_inputs).toEqual(parts.filter((_, index) => !layout[index]));
  }, 120_000);
});
