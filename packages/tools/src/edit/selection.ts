import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { complementIntervals, decisionEvidence, type Span } from '@orkas/video-studio-core';
import { phrases } from '../analyze/current.js';
import { mediaDigest as timelineDigest } from '../media-evidence.js';
import { probeMedia, runJumpCut } from './edit.js';
import type { EditRunOptions } from '../progress.js';
export async function cutSelection(p: { input: string; transcript: string; keep?: number[]; selection_id?: string; output?: string }, opts?: EditRunOptions) {
  const input = resolve(p.input), transcript = resolve(p.transcript);
  const sourceSha = await timelineDigest(input), transcriptSha = await timelineDigest(transcript);
  const analysis = await phrases({ input, transcript }, opts);
  if (analysis.timing !== 'word' || !analysis.phrases.length || analysis.phrases.length > 1000) throw new Error('Selection requires 1–1000 measured word-level phrases.');
  const rows = analysis.phrases, candidates = rows.map((row, i) => ({ id: i + 1, ...row }));
  const selection_id = createHash('sha256').update(JSON.stringify([sourceSha, transcriptSha, candidates])).digest('hex');
  const view = { ok: true, selection_id, source_sha256: sourceSha, candidates, note: analysis.note };
  if (p.keep === undefined && p.output === undefined && p.selection_id === undefined) return view;
  if (p.selection_id !== selection_id) throw new Error('The measured source or transcript changed; list candidates again before cutting.');
  const keep = p.keep;
  if (!Array.isArray(keep) || !keep.length || keep.some((id, i) => !Number.isInteger(id) || id < 1 || id > rows.length || (i > 0 && id <= keep[i - 1]))) throw new Error('Keep IDs must be unique and in source order.');
  if (!p.output) throw new Error('Selection execution requires a separate output.');
  const output = resolve(p.output), receiptPath = output + '.selection.json';
  if (output === input || output === transcript || await fs.stat(output).catch(() => null) || await fs.stat(receiptPath).catch(() => null)) throw new Error('Selection output and receipt must be new files.');
  const kept: Span[] = []; let previous = 0;
  for (const id of keep) {
    const row = rows[id - 1], last = kept.at(-1), start = id === 1 ? 0 : row.startSec, end = id === rows.length ? analysis.durationSec : row.endSec;
    if (last && id === previous + 1) last.endSec = end; else kept.push({ startSec: start, endSec: end }); previous = id;
  }
  if (sourceSha !== await timelineDigest(input) || transcriptSha !== await timelineDigest(transcript)) throw new Error('Selection input changed during analysis.');
  const probe = await probeMedia(input), duration = probe.video_duration ?? probe.duration;
  if (!(probe.fps > 0) || kept.some((s, i) => !Number.isFinite(s.startSec) || !Number.isFinite(s.endSec) || s.startSec < 0 || s.endSec > duration + .01 || s.endSec <= s.startSec || (i > 0 && s.startSec < kept[i - 1].endSec))) throw new Error('Selection needs readable, ordered nonoverlapping source intervals.');
  const aligned = kept.map(s => ({ startSec: Math.round(s.startSec * probe.fps) / probe.fps, endSec: Math.min(duration, Math.round(s.endSec * probe.fps) / probe.fps) }));
  if (aligned.some(s => s.endSec <= s.startSec)) throw new Error('A selected interval contains no complete frame.');
  let claimed = false, receiptClaimed = false;
  await fs.mkdir(resolve(output, '..'), { recursive: true });
  try {
    const receipt = await fs.open(receiptPath, 'wx'); receiptClaimed = true; await receipt.close();
    if (aligned.length === 1 && aligned[0].startSec === 0 && Math.abs(aligned[0].endSec - duration) < .01) { await fs.copyFile(input, output, constants.COPYFILE_EXCL); claimed = true; }
    else {
      const handle = await fs.open(output, 'wx'); claimed = true; await handle.close();
      await runJumpCut(input, aligned, output, { op: 'phrase_selection', phase: 'edit', durationSec: aligned.reduce((n, s) => n + s.endSec - s.startSec, 0), ...opts });
      const actual = await probeMedia(output), expected = aligned.reduce((n, s) => n + s.endSec - s.startSec, 0);
      if (Math.abs((actual.video_duration ?? actual.duration) - expected) > 1 / probe.fps + .05) throw new Error('Selected duration does not match the frame-aligned cut list.');
    }
    if (sourceSha !== await timelineDigest(input) || transcriptSha !== await timelineDigest(transcript)) throw new Error('Selection input changed during the cut; output was not published.');
    const result = { ...view, output, selected_ids: keep, output_sha256: await timelineDigest(output), decision: decisionEvidence(complementIntervals(aligned, duration), aligned, 'explicit measured phrase selection') };
    await fs.writeFile(receiptPath, JSON.stringify(result, null, 2) + '\n'); return result;
  } catch (error) { if (claimed) await fs.rm(output, { force: true }); if (receiptClaimed) await fs.rm(receiptPath, { force: true }); throw error; }
}
