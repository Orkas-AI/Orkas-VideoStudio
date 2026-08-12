/**
 * The whole-video production preview: ONE contact sheet of the assembled
 * draft, segments in playback order — media segments included as an extracted
 * still. An assembled production is reviewed as one video; presenting one
 * sheet per child segment is four links to four children, not a look at the
 * video, and it multiplies the user's stops by the segment count.
 */
import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { extractFrame, probeMedia } from './edit/edit.js';
import { writeFrameContactSheet, type FrameSampleEvidence } from './render/composition-qa.js';

/** Sheet-size sanity cap; a plan longer than this reports the truncation. */
const PREVIEW_MAX_SEGMENTS = 24;

export interface ProductionPreviewSample {
  segment_id: string;
  order: number;
  label: string;
  time_seconds: number;
}

export interface ProductionPreviewResult {
  ok: true;
  video: string;
  video_duration_sec: number;
  contact_sheet: string;
  frames: Array<ProductionPreviewSample & { path: string }>;
  warnings: string[];
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

/**
 * Pure: one sample per primary segment — the midpoint of its window on the
 * assembled timeline — plus the cover at t=0. Windows come from the plan's
 * `target_sec` proportions scaled to the REAL video duration, so drift between
 * planned and produced lengths shifts every midpoint proportionally instead of
 * sampling past the end.
 */
export function buildProductionPreviewPlan(
  segments: unknown,
  videoDurationSec: number,
): { samples: ProductionPreviewSample[]; warnings: string[] } {
  const warnings: string[] = [];
  const duration = Number.isFinite(videoDurationSec) && videoDurationSec > 0 ? videoDurationSec : 0;
  const lastSeekable = Math.max(0, round1(duration - 0.1));
  const samples: ProductionPreviewSample[] = [
    { segment_id: 'cover', order: 0, label: 'cover', time_seconds: 0 },
  ];
  const primaries = (Array.isArray(segments) ? segments : [])
    .filter((seg): seg is Record<string, unknown> => !!seg && typeof seg === 'object' && !Array.isArray(seg))
    .filter((seg) => seg.layer === 'primary' && Number.isFinite(Number(seg.target_sec)) && Number(seg.target_sec) > 0)
    .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
  if (!primaries.length || duration <= 0) return { samples, warnings };

  const kept = primaries.slice(0, PREVIEW_MAX_SEGMENTS);
  if (kept.length < primaries.length) {
    warnings.push(`Sheet covers the first ${PREVIEW_MAX_SEGMENTS} of ${primaries.length} primary segments.`);
  }
  const totalTarget = primaries.reduce((sum, seg) => sum + Number(seg.target_sec), 0);
  const scale = duration / totalTarget;
  let startSec = 0;
  kept.forEach((seg, index) => {
    const windowSec = Number(seg.target_sec) * scale;
    const mid = Math.min(lastSeekable, round1(startSec + windowSec / 2));
    const id = String(seg.id ?? `segment-${index + 1}`);
    samples.push({
      segment_id: id,
      order: Number(seg.order ?? index + 1),
      label: `${index + 1}-${id}`,
      time_seconds: mid,
    });
    startSec += windowSec;
  });
  return { samples, warnings };
}

/** Build the production contact sheet from the assembled draft/final file. */
export async function productionPreview(
  planPath: string,
  videoPath: string,
  outDir: string,
): Promise<ProductionPreviewResult> {
  const video = resolve(videoPath);
  const dir = resolve(outDir);
  let plan: unknown;
  try {
    plan = JSON.parse(readFileSync(resolve(planPath), 'utf8'));
  } catch (error) {
    throw new Error(`production preview: could not read/parse plan "${planPath}": ${(error as Error).message}`);
  }
  const segments = plan && typeof plan === 'object' && !Array.isArray(plan)
    ? (plan as Record<string, unknown>).segments
    : undefined;
  const probe = await probeMedia(video);
  if (!(probe.duration > 0)) throw new Error('production preview: the assembled video has no measurable duration.');
  const { samples, warnings } = buildProductionPreviewPlan(segments, probe.duration);

  await mkdir(dir, { recursive: true });
  const frames: ProductionPreviewResult['frames'] = [];
  const sheetSamples: FrameSampleEvidence[] = [];
  for (const sample of samples) {
    const framePath = join(dir, `${sample.label}.png`);
    await extractFrame(video, sample.time_seconds, framePath);
    frames.push({ ...sample, path: framePath });
    sheetSamples.push({
      label: sample.label,
      time_seconds: sample.time_seconds,
      frame_index: Math.round(sample.time_seconds * (probe.fps || 30)),
      path: framePath,
      hash: '',
      brightness: 0,
      contrast: 0,
      width: probe.width,
      height: probe.height,
    });
  }
  const contactSheet = await writeFrameContactSheet(dir, sheetSamples);
  return {
    ok: true,
    video,
    video_duration_sec: probe.duration,
    contact_sheet: contactSheet,
    frames,
    warnings,
  };
}
