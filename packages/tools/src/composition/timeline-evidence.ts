import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { resolveFfmpegTools, runOk } from '@orkas/video-studio-core';
import { beats } from '../analyze/current.js';
import { timelineContained } from './timeline.js';
import { writeFrameContactSheet } from '../render/composition-qa.js';
export async function deliveredHints(file: string, duration: number, cutToBeat: boolean, signal?: AbortSignal) {
  const issues: Array<{ code: string; severity: 'warning'; message: string }> = [];
  const result = await runOk(resolveFfmpegTools().ffmpeg, ['-hide_banner', '-nostats', '-nostdin', '-i', file, '-map', '0:v:0', '-vf', "scale=240:-2,freezedetect=n=-55dB:d=1,select='gt(scene,0.35)',showinfo", '-an', '-f', 'null', '-'], { signal, timeoutMs: 300_000, maxBuffer: 4 * 1024 * 1024 }).catch(e => { if (signal?.aborted) throw e; return null; });
  if (result) {
    const starts = [...result.stderr.matchAll(/freeze_start:\s*(-?[\d.]+)/g)].map(m => Number(m[1]));
    const ends = [...result.stderr.matchAll(/freeze_end:\s*(-?[\d.]+)/g)].map(m => Number(m[1]));
    const share = starts.reduce((n, start, i) => n + Math.max(0, (ends[i] ?? duration) - start), 0) / duration;
    const shots = 1 + [...result.stderr.matchAll(/Parsed_showinfo.*\bn:\s*\d+/g)].length;
    if (share > .4) issues.push({ code: 'DELIVERY_MOSTLY_STATIC', severity: 'warning', message: `${Math.round(Math.min(1, share) * 100)}% of the video holds still for a second or more. Review whether that serves the brief.` });
    if (duration >= 3 && shots / duration > 1.5) issues.push({ code: 'DELIVERY_SHOTS_TOO_SHORT', severity: 'warning', message: `${shots} shots in ${duration.toFixed(1)}s may be difficult to follow.` });
  } else issues.push({ code: 'DELIVERY_VISUAL_HINTS_UNVERIFIABLE', severity: 'warning', message: 'Automatic static/shot hints were unavailable; review the final file.' });
  if (cutToBeat) {
    try {
      const rhythm = await beats({ input: file }, { signal });
      if ('cuts' in rhythm && rhythm.cuts && rhythm.cuts.off_beat > 0) issues.push({ code: 'DELIVERY_CUTS_OFF_BEAT', severity: 'warning', message: `${rhythm.cuts.off_beat} of ${rhythm.cuts.count} measured cuts are more than one frame off the beat. Use the measured beat frames, then render again.` });
      if (!rhythm.steady) issues.push({ code: 'DELIVERY_BEATS_UNVERIFIABLE', severity: 'warning', message: 'No steady beat was established; review musical timing before claiming beat alignment.' });
    } catch (e) { if (signal?.aborted) throw e; issues.push({ code: 'DELIVERY_BEATS_UNVERIFIABLE', severity: 'warning', message: 'Beat alignment was not verified; inspect the cut against the music.' }); }
  }
  return issues;
}
export async function deliveredFrames(root: string, file: string, duration: number, sceneEnds: number[], signal?: AbortSignal) {
  const directory = join(root, 'preview', randomUUID());
  const frames: Array<{ label: string; time_seconds: number; path: string }> = [];
  try {
    await fs.mkdir(directory, { recursive: true }); timelineContained(root, await fs.realpath(directory));
    const last = Math.max(0, duration - .1);
    const times = [...new Set([0, ...Array.from({ length: 6 }, (_, i) => last * i / 5), ...sceneEnds.slice(0, 64).map(t => Math.min(last, Math.max(0, t - .05)))])].sort((a, b) => a - b);
    for (const [i, t] of times.entries()) {
      const out = join(directory, `${i}.png`);
      await runOk(resolveFfmpegTools().ffmpeg, ['-v', 'error', '-nostdin', '-y', '-ss', String(t), '-i', file, '-frames:v', '1', '-vf', 'scale=480:-2', out], { signal, timeoutMs: 30_000, maxBuffer: 64 * 1024 });
      if (!(await fs.stat(out)).size) throw new Error('No final frame was captured.');
      frames.push({ label: `${t.toFixed(2)}s`, time_seconds: t, path: out });
    }
    const sheet = await writeFrameContactSheet(directory, frames);
    return { frames, contact_sheet: sheet, visual_review: { status: 'not_checked' as const } };
  } catch (e) {
    if (signal?.aborted) throw e;
    return { frames, contact_sheet: null, visual_review: { status: 'not_checked' as const }, frame_warning: 'Final frame evidence is incomplete; inspect the delivered file before reporting completion.' };
  }
}
