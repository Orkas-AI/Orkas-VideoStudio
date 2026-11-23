import * as fs from 'node:fs/promises';
import { extname, join } from 'node:path';
import {
  assessMotionAgainstReference, parseMotionSamples, quarterMedians, referenceComparisonReport, referenceMoments, referenceMotionIssue,
  REFERENCE_COMPARE_MIN_SEC, REFERENCE_MOTION_MAX_SEC, resolveFfmpegTools, run,
  type DeliveryIssue, type ReferenceComparison, type ReferenceMoment,
} from '@orkas/video-studio-core';
import { writeFrameContactSheet } from './composition-qa.js';

/** Sampled this small and this often, a minute of video decodes in about a second. */
const MOTION_SAMPLE_FPS = 8;
const MOTION_SAMPLE_WIDTH = 160;
const MOTION_TIMEOUT_MS = 90_000;
const PROBE_TIMEOUT_MS = 60_000;
const FRAME_TIMEOUT_MS = 30_000;
const SHEET_CELL = 360;

/** Explicit demuxing and local protocols keep reference reading confined to media; other
 *  containers are not compared. */
export function referenceVideoInput(file: string): string[] | null {
  const demuxer = ({ '.mp4': 'mov', '.mov': 'mov', '.m4v': 'mov', '.webm': 'matroska', '.mkv': 'matroska', '.ogv': 'ogg' } as Record<string, string>)[extname(file).toLowerCase()];
  return demuxer ? ['-protocol_whitelist', 'file,pipe', '-f', demuxer, '-i', file] : null;
}

function localDeliveryInput(file: string): string[] {
  return ['-protocol_whitelist', 'file,pipe', '-i', file];
}

async function referenceDuration(mediaInput: readonly string[], signal?: AbortSignal): Promise<number | null> {
  const probed = await run(resolveFfmpegTools().ffprobe, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', ...mediaInput], { signal, timeoutMs: PROBE_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 });
  if (probed.code !== 0) return null;
  const parsed = JSON.parse(probed.stdout) as { format?: { duration?: string }; streams?: Array<{ codec_type?: string }> };
  const duration = Number(parsed.format?.duration);
  return parsed.streams?.some((stream) => stream.codec_type === 'video') && Number.isFinite(duration) && duration > 0 ? duration : null;
}

/** Median frame-to-frame luma change in each quarter; null when the file cannot be read. */
async function measureMotionByQuarter(mediaInput: readonly string[], durationSec: number, signal?: AbortSignal): Promise<Array<number | null> | null> {
  if (!(durationSec >= REFERENCE_COMPARE_MIN_SEC)) return null;
  const span = Math.min(durationSec, REFERENCE_MOTION_MAX_SEC);
  const measured = await run(resolveFfmpegTools().ffmpeg, [
    '-hide_banner', '-nostats', '-t', span.toFixed(3), ...mediaInput,
    '-map', '0:v:0',
    '-vf', `fps=${MOTION_SAMPLE_FPS},scale=${MOTION_SAMPLE_WIDTH}:-2:flags=area,format=gray,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG`,
    '-f', 'null', '-',
  ], { signal, timeoutMs: MOTION_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 });
  if (measured.code !== 0) return null;
  return quarterMedians(parseMotionSamples(measured.stderr), span);
}

/**
 * The delivered file measured quarter by quarter against the reference it was made from. Null
 * when either cannot be read or is too short to compare, which says nothing about how the
 * delivery moves. It does not grade fidelity.
 */
export async function compareWithReference(input: { reference: string; video: string; videoSec: number | null; signal?: AbortSignal }): Promise<{
  report: ReferenceComparison; issue: DeliveryIssue | null; moments: ReferenceMoment[];
} | null> {
  try {
    const referenceInput = referenceVideoInput(input.reference);
    if (!referenceInput) return null;
    const referenceSec = await referenceDuration(referenceInput, input.signal);
    if (!referenceSec || !input.videoSec || referenceSec < REFERENCE_COMPARE_MIN_SEC || input.videoSec < REFERENCE_COMPARE_MIN_SEC) return null;
    const moments = referenceMoments(referenceSec, input.videoSec);
    const reference = await measureMotionByQuarter(referenceInput, referenceSec, input.signal);
    const own = await measureMotionByQuarter(localDeliveryInput(input.video), input.videoSec, input.signal);
    const assessment = reference && own ? assessMotionAgainstReference(reference, own) : null;
    return { report: referenceComparisonReport(moments, assessment), issue: assessment ? referenceMotionIssue(assessment, moments) : null, moments };
  } catch (error) {
    if (input.signal?.aborted) throw error;
    return null;
  }
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function frameAt(mediaInput: readonly string[], atSec: number, out: string, signal?: AbortSignal): Promise<string | null> {
  const taken = await run(resolveFfmpegTools().ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y', '-ss', Math.max(0, atSec).toFixed(3), ...mediaInput,
    '-frames:v', '1', '-vf', `scale=${SHEET_CELL}:${SHEET_CELL}:force_original_aspect_ratio=decrease`, out,
  ], { signal, timeoutMs: FRAME_TIMEOUT_MS, maxBuffer: 64 * 1024 });
  if (taken.code !== 0) return null;
  const head = await fs.readFile(out).then((bytes) => bytes.subarray(0, PNG_SIGNATURE.length)).catch(() => null);
  return head?.equals(PNG_SIGNATURE) ? out : null;
}

/** Reference left, delivery right, one row per moment. Null when no row could be drawn. */
export async function writeReferenceComparisonSheet(input: {
  reference: string; video: string; moments: readonly ReferenceMoment[]; directory: string; signal?: AbortSignal;
}): Promise<string | null> {
  const referenceInput = referenceVideoInput(input.reference);
  if (!referenceInput) return null;
  try {
    const cells: Array<{ label: string; time_seconds: number; path: string }> = [];
    for (const moment of input.moments) {
      const reference = await frameAt(referenceInput, moment.referenceSec, join(input.directory, `${moment.row}-reference.png`), input.signal);
      const own = await frameAt(localDeliveryInput(input.video), moment.videoSec, join(input.directory, `${moment.row}-video.png`), input.signal);
      // A row is drawn only whole: half a pair would compare a frame with nothing.
      if (!reference || !own) continue;
      cells.push({ label: `${moment.row} · reference ${moment.referenceSec.toFixed(1)}s`, time_seconds: moment.referenceSec, path: reference });
      cells.push({ label: `${moment.row} · this video ${moment.videoSec.toFixed(1)}s`, time_seconds: moment.videoSec, path: own });
    }
    return cells.length ? await writeFrameContactSheet(input.directory, cells, { columns: 2 }) : null;
  } catch (error) {
    if (input.signal?.aborted) throw error;
    return null;
  }
}
