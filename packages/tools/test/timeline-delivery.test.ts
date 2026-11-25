import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { parseIntegratedLufs, resolveFfmpegTools, runOk, type HeldStillsFinding } from '@orkas/video-studio-core';
import { renderTimeline, shipTimeline } from '../src/composition/timeline-actions.js';
import * as timelineTool from '../src/composition/timeline.js';
import * as evidenceTool from '../src/composition/timeline-evidence.js';
import * as deliveryTool from '../src/render/delivery.js';
import * as renderTool from '../src/render/render.js';
import { normalizeLoudness } from '../src/edit/edit.js';
let root: string, video: string;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'ovs-version-')); video = join(root, 'source.mp4');
  await runOk(resolveFfmpegTools().ffmpeg, ['-y', '-f', 'lavfi', '-i', 'color=blue:s=320x180:r=24:d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', video]);
});
afterAll(async () => { await rm(root, { recursive: true, force: true }); });
it('keeps immutable delivered bytes, reuses only the latest verified version and rejects wrong promises', async () => {
  // A wrong shape is a broken promise; a length other than the one asked for is advice (2026-11-24).
  const rejected = await shipTimeline({ production: root, input: video, expect: { durationSec: 5, aspect: '9:16' } });
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
    const accepted = await shipTimeline({ production: directory, input: video, expect: { aspect: '9:16', audio: false }, accept_findings: ['DELIVERY_ASPECT_MISMATCH'], accept_reason: 'The user explicitly kept the wide cut.' });
    expect(accepted.ok).toBe(true);
    expect(accepted.version?.override).toMatchObject({ codes: ['DELIVERY_ASPECT_MISMATCH'] });
    expect(accepted.visual_review).toEqual({ status: 'not_checked' });
    expect(accepted.frames?.length).toBeGreaterThan(1);
    const stillBlocked = await shipTimeline({ production: directory, input: video, expect: { aspect: '9:16', audio: true }, accept_findings: ['DELIVERY_ASPECT_MISMATCH'], accept_reason: 'Keep the shape.' });
    expect(stillBlocked.ok).toBe(false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

const ff = (args: string[]) => runOk(resolveFfmpegTools().ffmpeg, ['-v', 'error', '-nostdin', '-y', ...args], { timeoutMs: 120_000 });
type Shipped = {
  ok: boolean;
  errorCode?: string;
  issues?: Array<{ code: string; severity: string; message: string }>;
  version?: { id?: string; path?: string; warnings?: string[]; integrated_lufs?: number | null; override?: unknown };
  frames?: Array<{ label: string; time_seconds: number; path: string; heard?: string }>;
  reference_comparison?: { motion_score: number | null } | null;
  reference_sheet?: string | null;
};
const shipped = async (pending: ReturnType<typeof shipTimeline>) => (await pending) as unknown as Shipped;
const codes = (result: Shipped) => (result.issues ?? []).map((issue) => issue.code);
const found = (result: Shipped, code: string) => (result.issues ?? []).find((issue) => issue.code === code);
const scratch: string[] = [];
afterEach(() => { vi.restoreAllMocks(); });
afterAll(async () => { for (const directory of scratch.splice(0)) await rm(directory, { recursive: true, force: true }); });
async function fresh(prefix: string) {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  scratch.push(directory);
  return directory;
}
const encode = ['-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p'];

/** A v3 production rendered from the given cut: prepare runs for real and only the HyperFrames
 *  render is replaced by a copy, so delivery sees a current render record. */
async function production(scenes: unknown[], assets: unknown[], files: Record<string, string[]>) {
  const directory = await fresh('ovs-ship-');
  await mkdir(join(directory, 'videos', 'main'), { recursive: true });
  for (const [file, args] of Object.entries(files)) await ff([...args, join(directory, file)]);
  await writeFile(join(directory, 'videos/main/manifest.json'), JSON.stringify({ schema_version: 3, id: 'main', label: 'Ship', canvas: { width: 360, height: 640, fps: 30 }, scenes }));
  await writeFile(join(directory, 'assets.json'), JSON.stringify({ assets }));
  let renders = 0;
  const rendered = async (cut: string) => {
    const renderer = vi.spyOn(renderTool, 'render').mockImplementation(async (params) => { await copyFile(cut, params.output); return { output: params.output }; });
    const output = join(directory, `render-${++renders}.mp4`);
    const result = await renderTimeline({ production: directory, output });
    renderer.mockRestore();
    expect(result.ok, JSON.stringify(result)).toBe(true);
    return output;
  };
  const ship = (input: string, extra: Partial<Parameters<typeof shipTimeline>[0]> = {}) => shipped(shipTimeline({ production: directory, video_id: 'main', input, ...extra }));
  return { directory, rendered, ship };
}

describe('timeline ship on the delivered file', () => {
  it('tells the caller when a video said to be cut to the beat shows one picture throughout', async () => {
    const directory = await fresh('ovs-beat-');
    const still = join(directory, 'still.mp4');
    await ff(['-f', 'lavfi', '-i', 'color=c=0x335577:s=320x180:r=30:d=16', ...encode, still]);
    const cut = await shipped(shipTimeline({ production: directory, input: still, cut_to_beat: true, expect: { durationSec: 16, audio: false } }));
    expect(cut.ok).toBe(true);
    expect(found(cut, 'DELIVERY_NO_CUTS')).toMatchObject({ severity: 'warning', message: 'The delivered file has no cut: one picture runs the whole 16.00s. Check how long each shot was made to last, then render and deliver again.' });
    const plain = await shipped(shipTimeline({ production: await fresh('ovs-beat-'), input: still, expect: { durationSec: 16, audio: false } }));
    expect(codes(plain)).not.toContain('DELIVERY_NO_CUTS');
  });

  it('names one shot held over half of a beat cut even without a steady beat', async () => {
    const directory = await fresh('ovs-beat-');
    const held = join(directory, 'held.mp4');
    await ff(['-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=30:d=1', '-f', 'lavfi', '-i', 'color=c=0x335577:s=320x180:r=30:d=13', '-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=30:d=2',
      '-filter_complex', '[0:v][1:v][2:v]concat=n=3:v=1:a=0[v]', '-map', '[v]', ...encode, held]);
    const result = await shipped(shipTimeline({ production: directory, input: held, cut_to_beat: true, expect: { durationSec: 16, audio: false } }));
    expect(found(result, 'DELIVERY_SHOT_HELD')?.message).toMatch(/^One shot runs from 1\.0\ds to 14\.0\ds, more than half of this 16\.00s video, so the picture does not change on the beat there\./);
  });

  it('no longer looks for burned captions in the container, though an older caller still sends captions', async () => {
    const result = await shipped(shipTimeline({ production: await fresh('ovs-captions-'), input: video, expect: { durationSec: 1, audio: false, captions: true } }));
    expect(result.ok).toBe(true);
    expect(codes(result)).not.toContain('DELIVERY_CAPTIONS_MISSING');
  });

  it('shows the review once: the reply version leaves it out, the stored version keeps it', async () => {
    const directory = await fresh('ovs-review-');
    const result = await shipped(shipTimeline({ production: directory, input: video, expect: { durationSec: 1, audio: false } }));
    expect(result.ok).toBe(true);
    expect(result).toMatchObject({ visual_review: { status: 'not_checked' } });
    expect(result.version).not.toHaveProperty('visual_review');
    const stored = JSON.parse(await readFile(join(directory, 'versions.json'), 'utf8'));
    expect(stored.versions[0].visual_review).toEqual({ status: 'not_checked' });
    const again = await shipped(shipTimeline({ production: directory, input: video, expect: { durationSec: 1, audio: false } }));
    expect(again.version).not.toHaveProperty('visual_review');
  });

  it('sets a delivery beside the reference it was made from and records a much stiller one as a warning', async () => {
    const directory = await fresh('ovs-reference-');
    const reference = join(directory, 'reference.mp4');
    const still = join(directory, 'still.mp4');
    await ff(['-f', 'lavfi', '-i', 'testsrc2=s=360x640:r=30:d=4', ...encode, reference]);
    await ff(['-f', 'lavfi', '-i', 'color=c=0x335577:s=360x640:r=30:d=4', ...encode, still]);
    const result = await shipped(shipTimeline({ production: directory, input: still, reference, expect: { durationSec: 4, audio: false } }));
    expect(result.ok).toBe(true);
    expect(found(result, 'DELIVERY_MOTION_BELOW_REFERENCE')?.severity).toBe('warning');
    expect(result.version?.warnings).toContain('DELIVERY_MOTION_BELOW_REFERENCE');
    expect(result.reference_comparison?.motion_score).toBe(0);
    expect(result.reference_sheet).toMatch(/contact-sheet\.svg$/);
    await expect(shipTimeline({ production: directory, input: still, reference: join(directory, 'missing.mp4'), expect: { durationSec: 4, audio: false } })).rejects.toThrow();
    const plain = await shipped(shipTimeline({ production: await fresh('ovs-reference-'), input: still, expect: { durationSec: 4, audio: false } }));
    expect(plain).not.toHaveProperty('reference_comparison');
  });

  // A quiet music bed under a short voice-over normalized in one loudnorm pass came out at -18.4 LUFS against -14.
  it('needs no further normalization once loudness is measured and normalized in a second pass', async () => {
    const directory = await fresh('ovs-loudness-');
    const quiet = join(directory, 'quiet.mp4');
    await ff(['-f', 'lavfi', '-i', 'anoisesrc=d=20:c=pink:a=0.03:seed=7', '-f', 'lavfi', '-i', 'sine=f=300:d=2.5,volume=0.35,tremolo=f=5:d=0.8', '-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=25:d=20',
      '-filter_complex', '[1:a]adelay=300|300,apad[v];[0:a][v]amix=inputs=2:duration=first:normalize=0,aformat=channel_layouts=stereo[a]', '-map', '2:v', '-map', '[a]', '-t', '20', ...encode, '-c:a', 'aac', quiet]);
    const measured = await runOk(resolveFfmpegTools().ffmpeg, ['-hide_banner', '-nostats', '-i', quiet, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
    expect(parseIntegratedLufs(measured.stderr)).toBeLessThan(-30);
    const normalized = join(directory, 'normalized.mp4');
    await normalizeLoudness(quiet, normalized);
    const delivered = await shipped(shipTimeline({ production: directory, input: normalized, expect: { durationSec: 20, audio: true } }));
    expect(delivered.ok, JSON.stringify(delivered.issues)).toBe(true);
    expect(codes(delivered)).not.toContain('DELIVERY_LOUDNESS_OFF_TARGET');
    expect(Math.abs((delivered.version?.integrated_lufs ?? 0) + 14)).toBeLessThanOrEqual(2);
    // One unmeasured pass, as the render was, stays off target.
    const single = join(directory, 'single.mp4');
    await ff(['-i', quiet, '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1:LRA=11', '-c:a', 'aac', single]);
    expect(codes(await shipped(shipTimeline({ production: await fresh('ovs-loudness-'), input: single, expect: { durationSec: 20, audio: true } })))).toContain('DELIVERY_LOUDNESS_OFF_TARGET');
  });
});

// 2026-11-24: a 15.10 s recap asked for at 30 s was stopped though the shorter cut may serve the brief;
// a length other than the one asked for is now advice on both routes, and a timeline's own length still blocks.
describe('timeline ship and the length asked for', () => {
  const lengthAdvice = (delivered: string, asked: string) => new RegExp(`^The delivered video is ${delivered}s\\. The requested length was ${asked}s \\(a difference of [\\d.]+s\\)\\. Use the editing context to decide whether to keep this cut or revise it\\.$`);

  it('delivers a file made without a timeline at another length, and says so beside its version', async () => {
    const result = await shipped(shipTimeline({ production: await fresh('ovs-length-'), input: video, expect: { durationSec: 5, audio: false } }));
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(found(result, 'DELIVERY_REQUESTED_DURATION_DRIFT')).toMatchObject({ severity: 'warning', message: expect.stringMatching(lengthAdvice('1\\.00', '5')) });
    expect(result.version?.warnings).toContain('DELIVERY_REQUESTED_DURATION_DRIFT');
    expect(codes(result)).not.toContain('DELIVERY_DURATION_DRIFT');
  });

  it('still stops a file without the sound or shape asked for, with the length reported beside them', async () => {
    const directory = await fresh('ovs-length-');
    const result = await shipped(shipTimeline({ production: directory, input: video, expect: { durationSec: 10, audio: true, aspect: '9:16' } }));
    expect(result.ok).toBe(false);
    expect((result.issues ?? []).filter((issue) => issue.severity === 'error').map((issue) => issue.code)).toEqual(['DELIVERY_ASPECT_MISMATCH', 'DELIVERY_NO_AUDIO']);
    expect(found(result, 'DELIVERY_REQUESTED_DURATION_DRIFT')?.severity).toBe('warning');
    expect(existsSync(join(directory, 'versions.json'))).toBe(false);
  });

  it('holds a timeline delivery to its timeline\'s length and reports the length asked for as advice', async () => {
    const made = await production([{ id: 'card', duration: 2, text: { title: { value: 'Two seconds' } } }], [], {
      'two.mp4': ['-f', 'lavfi', '-i', 'testsrc2=s=360x640:r=30:d=2', ...encode],
      'one.mp4': ['-f', 'lavfi', '-i', 'testsrc2=s=360x640:r=30:d=1', ...encode],
    });
    const shorter = await made.ship(await made.rendered(join(made.directory, 'two.mp4')), { expect: { durationSec: 30 } });
    expect(shorter.ok, JSON.stringify(shorter.issues)).toBe(true);
    expect(found(shorter, 'DELIVERY_REQUESTED_DURATION_DRIFT')?.message).toMatch(lengthAdvice('2\\.00', '30'));
    const off = await made.ship(await made.rendered(join(made.directory, 'one.mp4')), { expect: { durationSec: 1 } });
    expect(off.ok).toBe(false);
    expect(found(off, 'DELIVERY_DURATION_DRIFT')).toMatchObject({ severity: 'error', message: expect.stringContaining('Narration and captions are timed against that length') });
    expect(codes(off)).not.toContain('DELIVERY_REQUESTED_DURATION_DRIFT');
  });
});

// Three of eleven users who got a video called it pictures and cards ("只是圖片組合"), one delivered at
// 82% still with only a warning. Only still pictures count: a page-drawn diagram may hold while the
// voice explains it, and footage that holds is not counted.
describe('timeline ship of a video built from held stills', () => {
  const stillAssets = [
    { id: 'shot', kind: 'image', label: 'Site', path: 'shot.png', origin: 'upload' },
    { id: 'walk', kind: 'video', label: 'Street', path: 'walk.mp4', origin: 'upload', duration: 2 },
  ];
  const stillFiles = {
    'shot.png': ['-f', 'lavfi', '-i', 'color=c=0x336699:s=360x640:d=1', '-frames:v', '1'],
    'walk.mp4': ['-f', 'lavfi', '-i', 'testsrc2=s=360x640:r=30:d=2', ...encode],
  };
  const promoScenes = [
    { id: 'hook', clips: [{ id: 'hook-shot', asset: 'shot', in: 0, dur: 2 }] },
    { id: 'site', clips: [{ id: 'site-shot', asset: 'shot', in: 0, dur: 2 }] },
    { id: 'street', clips: [{ id: 'street-walk', asset: 'walk', in: 0, dur: 2 }] },
  ];
  /** Six seconds: still where `still` says, moving elsewhere. */
  async function cut(directory: string, name: string, still: 'start' | 'end', colour = '0x336699') {
    const file = join(directory, name);
    const parts = still === 'start' ? [`color=c=${colour}:s=360x640:r=30:d=4`, 'testsrc2=s=360x640:r=30:d=2'] : ['testsrc2=s=360x640:r=30:d=4', 'color=c=0x336699:s=360x640:r=30:d=2'];
    await ff([...parts.flatMap((source) => ['-f', 'lavfi', '-i', source]), '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v]', '-map', '[v]', ...encode, file]);
    return file;
  }
  const heldMessage = /^6[0-9]% of this video is a still frame held for a second or more, so it plays as a slideshow\. It stands still in scenes "(hook|site)" \(2\.0 s\), "(hook|site)" \(2\.0 s\)\. Make those scenes move, then render and deliver again: where the shot need not be the user's own, such as a place or people using this kind of thing, put in footage the user supplies or a generated clip; where it is the user's own product or photo, move across it with a slow push in, pan or scroll; on a screen of a site or app, show the step the line names done on it with \.\/assets\/vendor\/screen-demo\.js \(timeline\.md\)\.$/;

  it('stops it and names the scenes that stand still', async () => {
    const made = await production(promoScenes, stillAssets, stillFiles);
    await writeFile(join(made.directory, 'product.json'), JSON.stringify({ name: 'PetCare', facts: [] }));
    const result = await made.ship(await made.rendered(await cut(made.directory, 'cut.mp4', 'start')));
    expect(result.ok).toBe(false);
    expect(found(result, 'DELIVERY_HELD_STILLS')).toMatchObject({ severity: 'error', message: expect.stringMatching(heldMessage) });
    expect(codes(result)).not.toContain('DELIVERY_MOSTLY_STATIC');
  });

  it('stops still pictures held over half the video when nothing is promoted', async () => {
    const made = await production([
      { id: 'screens', clips: [{ id: 'screens-shot', asset: 'shot', in: 0, dur: 4 }] },
      { id: 'street', clips: [{ id: 'street-walk', asset: 'walk', in: 0, dur: 2 }] },
    ], stillAssets, stillFiles);
    const result = await made.ship(await made.rendered(await cut(made.directory, 'cut.mp4', 'start')));
    expect(result.ok).toBe(false);
    expect(found(result, 'DELIVERY_HELD_STILLS')?.message).toMatch(/^6[0-9]% of this video is a still frame held for a second or more, so it plays as a slideshow\. It stands still in scene "screens" \(4\.0 s\)\. Make those scenes move/);
  });

  it('only warns about a page drawn and held, and never counts footage that holds still', async () => {
    const drawn = await production([
      { id: 'diagram', duration: 4, text: { title: { value: 'How it works' } } },
      { id: 'street', clips: [{ id: 'street-walk', asset: 'walk', in: 0, dur: 2 }] },
    ], stillAssets, stillFiles);
    const slides = await drawn.ship(await drawn.rendered(await cut(drawn.directory, 'cut.mp4', 'start')));
    expect(slides.ok, JSON.stringify(slides.issues)).toBe(true);
    expect(codes(slides)).toContain('DELIVERY_MOSTLY_STATIC');
    expect(codes(slides)).not.toContain('DELIVERY_HELD_STILLS');

    const footage = await production(promoScenes, stillAssets, stillFiles);
    const held = await footage.ship(await footage.rendered(await cut(footage.directory, 'cut.mp4', 'end')));
    expect(held.ok, JSON.stringify(held.issues)).toBe(true);
    expect(codes(held)).not.toContain('DELIVERY_HELD_STILLS');
  });

  // 2026-11-23: one stock clip and four screenshots in a single scene went out 69% still.
  it('counts the pictures in a scene that also plays footage, and leaves out only the time the footage plays', async () => {
    const mixed = [{ id: 'story', clips: [{ id: 'story-shot', asset: 'shot', in: 0, dur: 4 }, { id: 'story-walk', asset: 'walk', in: 0, dur: 2 }] }];
    const stills = await production(mixed, stillAssets, stillFiles);
    const stopped = await stills.ship(await stills.rendered(await cut(stills.directory, 'cut.mp4', 'start')));
    expect(stopped.ok).toBe(false);
    expect(found(stopped, 'DELIVERY_HELD_STILLS')?.message).toMatch(/^6[0-9]% of this video is a still frame held for a second or more, so it plays as a slideshow\. It stands still in scene "story" \(4\.0 s\)\./);

    const clipHolds = await production(mixed, stillAssets, stillFiles);
    const delivered = await clipHolds.ship(await clipHolds.rendered(await cut(clipHolds.directory, 'cut.mp4', 'end')));
    expect(delivered.ok, JSON.stringify(delivered.issues)).toBe(true);
    expect(codes(delivered)).not.toContain('DELIVERY_HELD_STILLS');

    // Footage holding still for most of the same scene is still not counted.
    const recording = await production([{ id: 'story', clips: [
      { id: 'story-shot', asset: 'shot', in: 0, dur: 2 }, { id: 'story-walk', asset: 'walk', in: 0, dur: 2 }, { id: 'story-walk-2', asset: 'walk', in: 0, dur: 2 },
    ] }], stillAssets, stillFiles);
    const holds = join(recording.directory, 'holds.mp4');
    await ff(['-f', 'lavfi', '-i', 'testsrc2=s=360x640:r=30:d=2', '-f', 'lavfi', '-i', 'color=c=0x336699:s=360x640:r=30:d=4', '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v]', '-map', '[v]', ...encode, holds]);
    const kept = await recording.ship(await recording.rendered(holds));
    expect(kept.ok, JSON.stringify(kept.issues)).toBe(true);
    expect(codes(kept)).not.toContain('DELIVERY_HELD_STILLS');
  });

  it('places a later scene\'s footage where it plays in the whole video', async () => {
    // Footage at 4–6 s of the whole video, in a scene that starts at 2 s after a still scene.
    const made = await production([
      { id: 'lead', clips: [{ id: 'lead-shot', asset: 'shot', in: 0, dur: 2 }] },
      { id: 'story', clips: [{ id: 'story-shot', asset: 'shot', in: 0, dur: 2 }, { id: 'story-walk', asset: 'walk', in: 0, dur: 2 }] },
    ], stillAssets, stillFiles);
    const result = await made.ship(await made.rendered(await cut(made.directory, 'cut.mp4', 'start')));
    expect(result.ok).toBe(false);
    expect(found(result, 'DELIVERY_HELD_STILLS')?.message).toMatch(/It stands still in scenes "(lead|story)" \(2\.0 s\), "(lead|story)" \(2\.0 s\)\./);
  });

  it('gives a stopped video one round of changes: its next file is delivered with a warning', async () => {
    const made = await production(promoScenes, stillAssets, stillFiles);
    const stopped = async () => (JSON.parse(await readFile(join(made.directory, 'versions.json'), 'utf8')) as { held_stills_stopped?: Record<string, string> }).held_stills_stopped;
    const first = await made.rendered(await cut(made.directory, 'cut-1.mp4', 'start'));
    expect((await made.ship(first)).ok).toBe(false);
    expect(Object.keys(await stopped() ?? {})).toEqual(['main']);
    // The same file again has not been changed.
    expect((await made.ship(first)).ok).toBe(false);

    const changed = await made.rendered(await cut(made.directory, 'cut-2.mp4', 'start', '0x993366'));
    const delivered = await made.ship(changed);
    expect(delivered.ok, JSON.stringify(delivered.issues)).toBe(true);
    expect(found(delivered, 'DELIVERY_HELD_STILLS')).toMatchObject({ severity: 'warning' });
    expect(found(delivered, 'DELIVERY_HELD_STILLS')?.message).toMatch(/^6[0-9]% of this video still stands still after one round of changes, in scenes "(hook|site)" \(2\.0 s\), "(hook|site)" \(2\.0 s\)\. It is delivered as it is: say in your reply which scenes still hold still, so the user can ask for more movement\.$/);
    expect(delivered.version?.warnings).toContain('DELIVERY_HELD_STILLS');
    expect(await stopped()).toBeUndefined();

    // A delivery starts the next round: the next held file is stopped again.
    const next = await made.rendered(await cut(made.directory, 'cut-3.mp4', 'start', '0x669933'));
    expect((await made.ship(next)).ok).toBe(false);
  });

  it('keeps the delivery finding when the stop cannot be recorded', async () => {
    const made = await production(promoScenes, stillAssets, stillFiles);
    const file = await made.rendered(await cut(made.directory, 'cut.mp4', 'start'));
    const write = vi.spyOn(timelineTool, 'writeTimelineJson').mockRejectedValueOnce(Object.assign(new Error('EACCES: versions.json'), { code: 'EACCES' }));
    const result = await made.ship(file);
    expect(write).toHaveBeenCalledOnce();
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain('DELIVERY_HELD_STILLS');
  });

  it('delivers when the user chose stills that hold', async () => {
    const made = await production(promoScenes, stillAssets, stillFiles);
    const result = await made.ship(await made.rendered(await cut(made.directory, 'cut.mp4', 'start')), { accept_findings: ['DELIVERY_HELD_STILLS'], accept_reason: '就要图文轮播，不用动' });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(result.version?.override).toMatchObject({ codes: ['DELIVERY_HELD_STILLS'] });
  });

  // 2026-11-23: a user's own canvas update stopped for held stills had no way on but asking the Agent.
  // The canvas now asks the user once, and the answer holds only for the file and version it was asked about.
  describe('when the canvas asks the user', () => {
    it.each(['confirm', 'dismiss', 'replace_file', 'newer_version', 'stale_request'] as const)('binds the decision to the file and the latest version (%s)', async (decision) => {
      const made = await production(promoScenes, stillAssets, stillFiles);
      const file = await made.rendered(await cut(made.directory, 'cut.mp4', 'start'));
      const ledger = join(made.directory, 'versions.json');
      const other = decision === 'replace_file' ? await cut(made.directory, 'other.mp4', 'start', '0x993366') : null;
      const reviewHeldStills = vi.fn(async (finding: HeldStillsFinding) => {
        expect(finding.percent).toBeGreaterThan(50);
        expect(finding.scenes.map((scene) => scene.id).sort()).toEqual(['hook', 'site']);
        // This route keeps no one-round stop record.
        expect(existsSync(ledger)).toBe(false);
        if (other) await copyFile(other, file);
        if (decision === 'newer_version') await writeFile(ledger, JSON.stringify({ versions: [{ id: 'v1', video_id: 'main', path: 'versions/recent.mp4', sha256: 'f'.repeat(64), duration_sec: 6, shipped_at: '2026-11-23T00:00:00.000Z', warnings: [], visual_review: { status: 'not_checked' } }] }));
        return decision === 'dismiss' ? null : () => decision !== 'stale_request';
      });
      const result = await made.ship(file, { reviewHeldStills });
      expect(reviewHeldStills).toHaveBeenCalledOnce();
      if (decision === 'confirm') {
        expect(result).toMatchObject({ ok: true, version: { id: 'v1', override: { codes: ['DELIVERY_HELD_STILLS'], reason: 'User confirmed this rendered version on the video canvas.' } } });
        expect(await readFile(join(made.directory, result.version!.path!))).toEqual(await readFile(file));
        return;
      }
      expect(result.ok).toBe(false);
      if (decision === 'dismiss') expect(found(result, 'DELIVERY_HELD_STILLS')?.severity).toBe('error');
      else expect(result).toMatchObject({ errorCode: 'E_VIDEO_SHIP_REVIEW_EXPIRED', message: 'The video changed. Update it again.' });
      expect(existsSync(join(made.directory, 'versions'))).toBe(false);
      if (decision === 'newer_version') expect(JSON.parse(await readFile(ledger, 'utf8')).versions).toHaveLength(1);
      else expect(existsSync(ledger)).toBe(false);
    });

    it('does not ask about a file replaced while it was being checked', async () => {
      const made = await production(promoScenes, stillAssets, stillFiles);
      const file = await made.rendered(await cut(made.directory, 'cut.mp4', 'start'));
      const replacement = await cut(made.directory, 'replacement.mp4', 'start', '0x993366');
      const verify = deliveryTool.verifyTimelineDelivery;
      vi.spyOn(deliveryTool, 'verifyTimelineDelivery').mockImplementationOnce(async (...args) => { await rename(replacement, file); return verify(...args); });
      const reviewHeldStills = vi.fn(async () => () => true);
      const result = await made.ship(file, { reviewHeldStills });
      expect(existsSync(replacement)).toBe(false);
      expect(result).toMatchObject({ ok: false, errorCode: 'E_VIDEO_SHIP_REVIEW_EXPIRED' });
      expect(reviewHeldStills).not.toHaveBeenCalled();
      expect(existsSync(join(made.directory, 'versions.json'))).toBe(false);
    });

    // The Agent can edit the timeline with its own file tools in the seconds after the user's click.
    it('expires a confirmed review when the timeline changes before the version is recorded, leaving no version or frames', async () => {
      const made = await production(promoScenes, stillAssets, stillFiles);
      const file = await made.rendered(await cut(made.directory, 'cut.mp4', 'start'));
      const manifest = join(made.directory, 'videos', 'main', 'manifest.json');
      const takeFrames = evidenceTool.deliveredFrames;
      const framesTaken: string[] = [];
      vi.spyOn(evidenceTool, 'deliveredFrames').mockImplementationOnce(async (...args) => {
        const evidence = await takeFrames(...args);
        framesTaken.push(...evidence.frames.map((frame) => dirname(frame.path)), ...(evidence.contact_sheet ? [dirname(evidence.contact_sheet)] : []));
        const edited = JSON.parse(await readFile(manifest, 'utf8'));
        await writeFile(manifest, JSON.stringify({ ...edited, label: 'Edited meanwhile' }));
        return evidence;
      });
      const result = await made.ship(file, { reviewHeldStills: async () => () => true });
      expect(result).toMatchObject({ ok: false, errorCode: 'E_VIDEO_SHIP_REVIEW_EXPIRED', message: 'The video changed. Update it again.' });
      expect(existsSync(join(made.directory, 'versions.json'))).toBe(false);
      expect(await readdir(join(made.directory, 'versions')).catch(() => [])).toEqual([]);
      expect(framesTaken.length).toBeGreaterThan(0);
      for (const directory of new Set(framesTaken)) expect(existsSync(directory)).toBe(false);
    });

    it('asks only when the render meets every other delivery check', async () => {
      const made = await production(promoScenes.slice(0, 2), stillAssets, stillFiles);
      const reviewHeldStills = vi.fn(async () => () => true);
      const result = await made.ship(await made.rendered(await cut(made.directory, 'cut.mp4', 'start')), { reviewHeldStills });
      expect(result.ok).toBe(false);
      expect(codes(result)).toEqual(expect.arrayContaining(['DELIVERY_HELD_STILLS', 'DELIVERY_DURATION_DRIFT']));
      expect(reviewHeldStills).not.toHaveBeenCalled();
      expect(existsSync(join(made.directory, 'versions'))).toBe(false);
      expect(existsSync(join(made.directory, 'versions.json'))).toBe(false);
    });
  });
});

describe('timeline ship of a narrated video', () => {
  const noise = (seed: number, seconds: number) => ['-f', 'lavfi', '-i', `anoisesrc=d=${seconds}:c=pink:r=16000:a=0.3:seed=${seed}`, '-ac', '1'];

  // A recap played one narration line twice, the first time cut off, and delivery passed it.
  it('stops a delivery that plays a declared narration line twice, and passes the same line played once', async () => {
    const made = await production(
      [{ id: 'hook', duration: 10, narration: { asset: 'hook', text: '合同从三十天变成九十天。' } }],
      [{ id: 'hook', kind: 'audio', label: 'Hook', path: 'hook.wav', origin: 'upload' }],
      { 'hook.wav': noise(7, 3) },
    );
    const line = join(made.directory, 'hook.wav');
    const placed = async (name: string, starts: number[]) => {
      const file = join(made.directory, name);
      const delayed = starts.map((start, index) => `[${index + 1}:a]adelay=${start * 1000}:all=1[p${index}]`).join(';');
      await ff(['-f', 'lavfi', '-i', 'testsrc2=s=360x640:r=30:d=10', ...starts.flatMap(() => ['-i', line]), '-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=48000:duration=10',
        '-filter_complex', `${delayed};[${starts.length + 1}:a]volume=0.05[bed];[bed]${starts.map((_s, index) => `[p${index}]`).join('')}amix=inputs=${starts.length + 1}:normalize=0:duration=first[a]`,
        '-map', '0:v', '-map', '[a]', ...encode, '-c:a', 'aac', '-t', '10', file]);
      return file;
    };
    const twice = await made.ship(await made.rendered(await placed('twice.mp4', [1, 6])));
    expect(twice.ok).toBe(false);
    expect(found(twice, 'DELIVERY_NARRATION_REPEATED')?.message).toMatch(/^The narration line "合同从三十天变成九十天。" plays twice, from 1\.0 s and from 6\.0 s\. Keep it once, then deliver again\.$/);
    const once = await made.ship(await made.rendered(await placed('once.mp4', [1])));
    expect(codes(once)).not.toContain('DELIVERY_NARRATION_REPEATED');
    expect(codes(once)).not.toContain('DELIVERY_NARRATION_CUT_OFF');
  });

  // A tutorial ended on the export spinner while its last line said the file was saved, and evenly
  // spaced frames showed the spinner beside nothing that claimed otherwise.
  it('takes each frame where a declared line ends, with its words beside it', async () => {
    const made = await production(
      [{ id: 'open', duration: 1, narration: { asset: 'l1', text: 'Open settings.' } }, { id: 'saved', duration: 1, narration: { asset: 'l2', text: 'It is saved.' } }],
      [{ id: 'l1', kind: 'audio', label: 'Line 1', path: 'l1.wav', origin: 'upload' }, { id: 'l2', kind: 'audio', label: 'Line 2', path: 'l2.wav', origin: 'upload' }],
      { 'l1.wav': noise(4, 0.8), 'l2.wav': noise(5, 0.8) },
    );
    const file = join(made.directory, 'two-colours.mp4');
    await ff(['-f', 'lavfi', '-i', 'color=red:s=360x640:r=30:d=1', '-f', 'lavfi', '-i', 'color=blue:s=360x640:r=30:d=1', '-i', join(made.directory, 'l1.wav'), '-i', join(made.directory, 'l2.wav'),
      '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v];[2:a]apad=whole_dur=2[a1];[3:a]adelay=1000:all=1,apad=whole_dur=2[a2];[a1][a2]amix=inputs=2:normalize=0:duration=longest,atrim=duration=2[a]',
      '-map', '[v]', '-map', '[a]', ...encode, '-c:a', 'aac', file]);
    const result = await made.ship(await made.rendered(file));
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    const heard = (result.frames ?? []).filter((frame) => frame.heard);
    expect(heard.map((frame) => [frame.label, frame.heard])).toEqual([['#1 0.7s', 'Open settings.'], ['#2 1.7s', 'It is saved.']]);
    const colour = async (path: string) => { const { channels } = await sharp(path).stats(); return channels[0].mean > channels[2].mean ? 'red' : 'blue'; };
    expect(await colour(heard[0].path)).toBe('red');
    expect(await colour(heard[1].path)).toBe('blue');
  });
});

// 2026-11-24: a recap kept a clip's own sound in its timeline, and the delivered file played other sound there.
describe('timeline ship of a video that keeps a clip\'s own sound', () => {
  const noise = (seed: number, level: string) => `anoisesrc=d=5:c=pink:r=16000:a=${level}:seed=${seed}`;
  const unverified = 'DELIVERY_ORIGINAL_AUDIO_UNVERIFIED';

  it('advises when that sound is not heard in step in the delivered file, and checks a repeat against the version it keeps', async () => {
    const made = await production([
      { id: 'intro', duration: 2, text: { title: { value: 'Recap' } } },
      { id: 'dialogue', clips: [{ id: 'quote', asset: 'episode', in: 1, dur: 3, audio: 'keep' }] },
    ], [{ id: 'episode', kind: 'video', label: 'Episode', path: 'episode.mp4', origin: 'upload', duration: 5 }], {
      'episode.mp4': ['-f', 'lavfi', '-i', 'testsrc2=s=360x640:r=30:d=5', '-f', 'lavfi', '-i', noise(1, '0.3'), ...encode, '-c:a', 'aac'],
      'replacement.mp4': ['-f', 'lavfi', '-i', 'testsrc2=s=360x640:r=30:d=5', '-f', 'lavfi', '-i', noise(2, '0.3'), ...encode, '-c:a', 'aac'],
    });
    const episode = join(made.directory, 'episode.mp4');
    // The clip's 1–4 s placed at 2–5 s over a bed: clearly kept, or nearly covered by the bed.
    const mixed = async (name: string, level: string, bed: string) => {
      const file = join(made.directory, name);
      await ff(['-i', episode, '-f', 'lavfi', '-i', noise(2, bed), '-filter_complex',
        `[0:a]atrim=start=1:end=4,asetpts=N/SR/TB,volume=${level},adelay=2000:all=1[original];[1:a][original]amix=inputs=2:duration=first:normalize=0[mix]`,
        '-map', '0:v', '-map', '[mix]', '-c:v', 'copy', '-c:a', 'aac', file]);
      return file;
    };
    const advised = (result: Shipped) => {
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      expect(found(result, unverified)).toMatchObject({ severity: 'warning', message: expect.stringMatching(/ at 2\.00s–5\.00s in the delivered file\. Review that section /) });
      expect(result.version?.warnings).toContain(unverified);
      expect(codes(result)).not.toContain('DELIVERY_SILENT_STRETCH');
    };
    const kept = await made.ship(await made.rendered(await mixed('kept.mp4', '0.65', '0.04')));
    expect(kept.ok, JSON.stringify(kept.issues)).toBe(true);
    expect(codes(kept)).not.toContain(unverified);
    advised(await made.ship(await made.rendered(join(made.directory, 'replacement.mp4'))));
    // The clip's sound is still there under the bed, so this is a doubt to review, not a stop.
    const covered = await made.rendered(await mixed('covered.mp4', '0.15', '0.6'));
    advised(await made.ship(covered));
    advised(await made.ship(covered));

    // A file made without a timeline declares no kept sound.
    const standalone = await shipped(shipTimeline({ production: await fresh('ovs-kept-'), input: join(made.directory, 'replacement.mp4'), expect: { audio: true } }));
    expect(standalone.ok, JSON.stringify(standalone.issues)).toBe(true);
    expect(codes(standalone)).not.toContain(unverified);
  });
});
