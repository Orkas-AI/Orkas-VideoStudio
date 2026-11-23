import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { assessHeldShot, heardFrameSamples, heldStillScenes, heldStillsDeliveredMessage, heldStillsMessage, HELD_STILLS_BLOCK, parseVisualHints, resolveFfmpegTools, runOk } from '@orkas/video-studio-core';
import { beats } from '../analyze/current.js';
import { scenes } from '../analyze/analyze.js';
import { timelineContained } from './timeline.js';
import { writeFrameContactSheet } from '../render/composition-qa.js';

/** Seconds of a music cut read for its cuts. */
const BEAT_CHECK_MAX_SEC = 600;

/** Where each scene plays, whether it shows footage, and whether it places a still picture. */
export type DeliveredSceneSpan = { id: string; startSec: number; endSec: number; footage: boolean; pictures: boolean };

export async function deliveredHints(file: string, duration: number, cutToBeat: boolean, signal?: AbortSignal, timeline?: {
  sceneSpans: readonly DeliveredSceneSpan[];
  /** This video was stopped for held stills since its last delivery, on other bytes. */
  stoppedBefore: boolean;
}) {
  const issues: Array<{ code: string; severity: 'error' | 'warning'; message: string }> = [];
  const result = await runOk(resolveFfmpegTools().ffmpeg, ['-hide_banner', '-nostats', '-nostdin', '-i', file, '-map', '0:v:0', '-vf', "scale=240:-2,freezedetect=n=-55dB:d=1,select='gt(scene,0.35)',showinfo", '-an', '-f', 'null', '-'], { signal, timeoutMs: 300_000, maxBuffer: 4 * 1024 * 1024 }).catch(e => { if (signal?.aborted) throw e; return null; });
  if (result) {
    const { staticShare: share, shots, frozen } = parseVisualHints(result.stderr, duration);
    const held = timeline ? heldStillScenes(frozen, timeline.sceneSpans) : [];
    const heldShare = held.reduce((sum, scene) => sum + scene.seconds, 0) / duration;
    // Stopped once for held stills, a video gets one round of changes: a later file of it is delivered with the finding as a warning.
    if (heldShare > HELD_STILLS_BLOCK) {
      issues.push(timeline?.stoppedBefore
        ? { code: 'DELIVERY_HELD_STILLS', severity: 'warning', message: heldStillsDeliveredMessage(heldShare, held) }
        : { code: 'DELIVERY_HELD_STILLS', severity: 'error', message: heldStillsMessage(heldShare, held) });
    } else if (share > .4) issues.push({ code: 'DELIVERY_MOSTLY_STATIC', severity: 'warning', message: `${Math.round(Math.min(1, share) * 100)}% of the video holds still for a second or more. Review whether that serves the brief.` });
    if (duration >= 3 && shots / duration > 1.5) issues.push({ code: 'DELIVERY_SHOTS_TOO_SHORT', severity: 'warning', message: `${shots} shots in ${duration.toFixed(1)}s may be difficult to follow.` });
  } else issues.push({ code: 'DELIVERY_VISUAL_HINTS_UNVERIFIABLE', severity: 'warning', message: 'Automatic static/shot hints were unavailable; review the final file.' });
  if (cutToBeat) {
    let cuts: number[] | null = null;
    try {
      const rhythm = await beats({ input: file }, { signal });
      if ('cuts' in rhythm && rhythm.cuts && rhythm.cuts.off_beat > 0) issues.push({ code: 'DELIVERY_CUTS_OFF_BEAT', severity: 'warning', message: `${rhythm.cuts.off_beat} of ${rhythm.cuts.count} measured cuts are more than one frame off the beat. Use the measured beat frames, then render again.` });
      if (!rhythm.steady) issues.push({ code: 'DELIVERY_BEATS_UNVERIFIABLE', severity: 'warning', message: 'No steady beat was established; review musical timing before claiming beat alignment.' });
      if ('cuts' in rhythm && rhythm.cuts && rhythm.cuts.list.length === rhythm.cuts.count) cuts = rhythm.cuts.list.map(cut => cut.t);
    } catch (e) { if (signal?.aborted) throw e; issues.push({ code: 'DELIVERY_BEATS_UNVERIFIABLE', severity: 'warning', message: 'Beat alignment was not verified; inspect the cut against the music.' }); }
    // A picture that never changes is named whether or not the sound has a steady beat; a cut pass that fails reports nothing.
    cuts ??= await scenes({ input: file }, { signal }).then(found => found.candidates.map(c => c.tSec)).catch(e => { if (signal?.aborted) throw e; return null; });
    if (cuts) issues.push(...assessHeldShot(cuts.filter(t => t < BEAT_CHECK_MAX_SEC), Math.min(duration, BEAT_CHECK_MAX_SEC)));
  }
  return issues;
}

/** Frames of the delivered file. With measured narration lines, one just before each line ends
 *  (up to sixteen) and the last frame, each line's words beside its frame; otherwise evenly spaced.
 *  Each scene's last frame is always taken. */
export async function deliveredFrames(root: string, file: string, duration: number, sceneEnds: number[], signal?: AbortSignal, heard: ReadonlyArray<{ startSec: number; endSec: number; text: string }> = []) {
  const directory = join(root, 'preview', randomUUID());
  const frames: Array<{ label: string; time_seconds: number; path: string; heard?: string }> = [];
  try {
    await fs.mkdir(directory, { recursive: true }); timelineContained(root, await fs.realpath(directory));
    const last = Math.max(0, duration - .1);
    const lineSamples = heardFrameSamples(duration, heard);
    const base = lineSamples.length ? [] : [0, ...Array.from({ length: 6 }, (_, i) => last * i / 5)];
    const samples = new Map<number, { label: string; heard?: string }>();
    for (const t of [...base, ...sceneEnds.slice(0, 64).map(t => Math.min(last, Math.max(0, t - .05)))]) samples.set(t, { label: `${t.toFixed(2)}s` });
    for (const sample of lineSamples) samples.set(sample.atSec, { label: sample.label, ...(sample.heard ? { heard: sample.heard } : {}) });
    const times = [...samples.keys()].sort((a, b) => a - b);
    for (const [i, t] of times.entries()) {
      const out = join(directory, `${i}.png`);
      await runOk(resolveFfmpegTools().ffmpeg, ['-v', 'error', '-nostdin', '-y', '-ss', String(t), '-i', file, '-frames:v', '1', '-vf', 'scale=480:-2', out], { signal, timeoutMs: 30_000, maxBuffer: 64 * 1024 });
      if (!(await fs.stat(out)).size) throw new Error('No final frame was captured.');
      frames.push({ ...samples.get(t)!, time_seconds: t, path: out });
    }
    const sheet = await writeFrameContactSheet(directory, frames);
    return { frames, contact_sheet: sheet, visual_review: { status: 'not_checked' as const } };
  } catch (e) {
    if (signal?.aborted) throw e;
    return { frames, contact_sheet: null, visual_review: { status: 'not_checked' as const }, frame_warning: 'Final frame evidence is incomplete; inspect the delivered file before reporting completion.' };
  }
}
