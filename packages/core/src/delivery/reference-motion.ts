/**
 * A video made from a reference, set beside that reference at delivery. Pure: the tools layer
 * measures both files and draws the side-by-side sheet.
 *
 * Remakes kept coming out stiller than what they copied. This compares how much each quarter of
 * the delivered file moves against the same quarter of the reference (median luma change between
 * frames, sampled small), so a still picture standing in for moving footage is named with where it
 * is. It does not grade fidelity. Rows the reference itself barely moves in are not compared, and a
 * finding needs half or more of the compared rows to fall below half the reference's movement, so
 * one held shot or a changed order does not set it off.
 */
import type { DeliveryIssue } from './index.js';

/** Rows of the comparison: the middle of each quarter of each video. */
export const REFERENCE_COMPARE_ROWS = 4;
/** Longer videos are measured over this much from the start. */
export const REFERENCE_MOTION_MAX_SEC = 300;
/** Shorter than this, a quarter has too few samples to say how much it moves. */
export const REFERENCE_COMPARE_MIN_SEC = 2;
/** Median luma change (0-255, 160 px wide, 8 fps) a reference quarter needs before it is
 *  compared. Measured: moving footage 3-9, a moving viral-style edit 5.9-9.0, its static end
 *  card 0.0, interface animation 0.04-0.6. */
export const REFERENCE_MOTION_FLOOR = 1;
/** Below this share of the reference's movement, a row counts as much stiller. */
export const REFERENCE_MOTION_WEAK_RATIO = 0.5;
export const REFERENCE_MOTION_CODE = 'DELIVERY_MOTION_BELOW_REFERENCE' as const;

export type ReferenceMoment = { row: number; referenceSec: number; videoSec: number; share: number };

const round2 = (value: number) => Math.round(value * 100) / 100;

/** The same point of each video, as a share of its length: the middle of each quarter. */
export function referenceMoments(referenceSec: number, videoSec: number): ReferenceMoment[] {
  const span = (sec: number) => Math.min(sec, REFERENCE_MOTION_MAX_SEC);
  return Array.from({ length: REFERENCE_COMPARE_ROWS }, (_, index) => {
    const share = (index + 0.5) / REFERENCE_COMPARE_ROWS;
    return {
      row: index + 1,
      share,
      referenceSec: round2(span(referenceSec) * share),
      videoSec: round2(span(videoSec) * share),
    };
  });
}

/** `pts_time` and the YAVG that follows it, from ffmpeg's metadata print. */
export function parseMotionSamples(stderr: string): Array<{ atSec: number; change: number }> {
  const samples: Array<{ atSec: number; change: number }> = [];
  let at: number | null = null;
  for (const line of stderr.split(/\r?\n/)) {
    const time = /pts_time:(-?[\d.]+)/.exec(line);
    if (time) at = Number(time[1]);
    const value = /lavfi\.signalstats\.YAVG=([\d.]+)/.exec(line);
    if (value && at !== null && Number.isFinite(at)) {
      samples.push({ atSec: at, change: Number(value[1]) });
      at = null;
    }
  }
  return samples;
}

/** Median frame-to-frame change in each quarter, or null for a quarter with fewer than two samples. */
export function quarterMedians(samples: ReadonlyArray<{ atSec: number; change: number }>, spanSec: number): Array<number | null> {
  return Array.from({ length: REFERENCE_COMPARE_ROWS }, (_, index) => {
    const from = spanSec * index / REFERENCE_COMPARE_ROWS;
    const to = spanSec * (index + 1) / REFERENCE_COMPARE_ROWS;
    const values = samples
      .filter((sample) => sample.atSec >= from && (sample.atSec < to || index === REFERENCE_COMPARE_ROWS - 1))
      .map((sample) => sample.change)
      .sort((a, b) => a - b);
    if (values.length < 2) return null;
    const middle = Math.floor(values.length / 2);
    return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
  });
}

export type MotionRow = {
  row: number;
  reference: number | null;
  video: number | null;
  /** Share of the reference's movement, when the reference moves enough there to compare. */
  ratio: number | null;
};

export type MotionAssessment = {
  rows: MotionRow[];
  /** Rows compared and found much stiller than the reference. */
  weakRows: number[];
  /** Mean share of the reference's movement over the compared rows, capped at 1 each. */
  score: number | null;
  stiller: boolean;
};

export function assessMotionAgainstReference(
  reference: ReadonlyArray<number | null>,
  video: ReadonlyArray<number | null>,
): MotionAssessment {
  const rows: MotionRow[] = Array.from({ length: REFERENCE_COMPARE_ROWS }, (_, index) => {
    const ref = reference[index] ?? null;
    const own = video[index] ?? null;
    const compared = ref !== null && own !== null && ref >= REFERENCE_MOTION_FLOOR;
    return { row: index + 1, reference: ref, video: own, ratio: compared ? own / ref : null };
  });
  const compared = rows.filter((row) => row.ratio !== null);
  const weakRows = compared.filter((row) => (row.ratio as number) < REFERENCE_MOTION_WEAK_RATIO).map((row) => row.row);
  const score = compared.length
    ? compared.reduce((sum, row) => sum + Math.min(1, row.ratio as number), 0) / compared.length
    : null;
  return { rows, weakRows, score, stiller: compared.length > 0 && weakRows.length >= Math.ceil(compared.length / 2) };
}

/** The finding for a delivery much stiller than its reference, naming the rows. */
export function referenceMotionIssue(assessment: MotionAssessment, moments: readonly ReferenceMoment[]): (DeliveryIssue & { severity: 'warning' }) | null {
  if (!assessment.stiller) return null;
  const parts = assessment.weakRows.map((row) => {
    const moment = moments.find((entry) => entry.row === row);
    const ratio = assessment.rows.find((entry) => entry.row === row)?.ratio ?? 0;
    return `row ${row} (${Math.round((moment?.share ?? 0) * 100)}% through: ${Math.round(ratio * 100)}% of the reference's movement)`;
  });
  const listed = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  return {
    code: REFERENCE_MOTION_CODE,
    severity: 'warning',
    message: `Beside the reference at the same point of each, this video moves much less in ${listed} of the reference comparison.`
      + ' Make those parts move the way the reference does there, with footage, a camera move or animation instead of a held picture, then render.',
  };
}

/** What delivery reports about the comparison. */
export type ReferenceComparison = {
  rows: Array<{
    row: number;
    reference_at_sec: number;
    video_at_sec: number;
    /** Share of the reference's movement there; absent where the reference barely moves. */
    motion_vs_reference?: number;
  }>;
  motion_score: number | null;
};

export function referenceComparisonReport(moments: readonly ReferenceMoment[], assessment: MotionAssessment | null): ReferenceComparison {
  return {
    rows: moments.map((moment) => {
      const ratio = assessment?.rows.find((row) => row.row === moment.row)?.ratio;
      return {
        row: moment.row,
        reference_at_sec: moment.referenceSec,
        video_at_sec: moment.videoSec,
        ...(typeof ratio === 'number' ? { motion_vs_reference: round2(ratio) } : {}),
      };
    }),
    motion_score: assessment?.score === null || assessment?.score === undefined ? null : round2(assessment.score),
  };
}
