import { stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import {
  assessDeliveredNarration, assessDeliveredSpec, parseIntegratedLufs, parseVoicedSpan,
  resolveFfmpegTools, runOk,
  type DeliveryIssue, type DeliveryNarrationLine, type DeliveryVideoSpec, type VideoEdl,
} from '@orkas/video-studio-core';
import { resolveProducedPath } from '../plan-produced.js';

const PROBE_TIMEOUT_MS = 60_000;
const DECODE_TIMEOUT_MS = 600_000;

async function probe(file: string, signal?: AbortSignal) {
  const { ffprobe } = resolveFfmpegTools();
  const result = await runOk(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { signal, timeoutMs: PROBE_TIMEOUT_MS });
  const data = JSON.parse(result.stdout) as { streams?: Array<Record<string, unknown>>; format?: { duration?: string } };
  const duration = Number(data.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Media has no measurable duration: ${file}`);
  return { streams: data.streams ?? [], duration };
}

/** Verify the finished artifact regardless of which assembly route created it. */
export async function verifyProductionDelivery(plan: VideoEdl, planPath: string, videoPath: string, signal?: AbortSignal) {
  const videoFile = resolve(videoPath);
  const measured = await probe(videoFile, signal);
  const stream = measured.streams.find((entry) => entry.codec_type === 'video');
  if (!stream || !(Number(stream.width) > 0) || !(Number(stream.height) > 0)) throw new Error('Delivered media has no measurable video stream.');
  const [numerator, denominator] = String(stream.avg_frame_rate ?? stream.r_frame_rate ?? '').split('/').map(Number);
  const spec: DeliveryVideoSpec = {
    durationSec: measured.duration, width: Number(stream.width), height: Number(stream.height),
    fps: numerator > 0 && denominator > 0 ? numerator / denominator : null,
    hasAudio: measured.streams.some((entry) => entry.codec_type === 'audio'),
    subtitleStreams: measured.streams.filter((entry) => entry.codec_type === 'subtitle').length,
  };
  const { ffmpeg } = resolveFfmpegTools();
  const issues: DeliveryIssue[] = [];
  const lines: DeliveryNarrationLine[] = [];
  const declared = plan.tracks?.narration?.segments ?? [];
  for (const [index, line] of declared.entries()) {
    try {
      if (!line.produced_path || !Number.isFinite(line.start_sec) || Number(line.start_sec) < 0) throw new Error('produced_path and non-negative start_sec are required');
      const audioFile = resolveProducedPath(line.produced_path, planPath);
      const audio = await probe(audioFile, signal);
      if (!audio.streams.some((entry) => entry.codec_type === 'audio')) throw new Error('no audio stream');
      const decoded = await runOk(ffmpeg, ['-hide_banner', '-nostats', '-i', audioFile, '-vn', '-af', 'silencedetect=noise=-45dB:d=0.15', '-f', 'null', '-'], { signal, timeoutMs: DECODE_TIMEOUT_MS });
      const span = parseVoicedSpan(decoded.stderr, audio.duration);
      if (span.endSec <= span.startSec && line.text.trim()) throw new Error('no measurable voiced span');
      lines.push({ index, startSec: line.start_sec!, targetSec: line.target_sec ?? null, voicedStartSec: line.start_sec! + span.startSec, voicedEndSec: line.start_sec! + span.endSec, textHead: line.text.slice(0, 80) });
    } catch (error) {
      if (signal?.aborted) throw error;
      issues.push({ code: 'DELIVERY_NARRATION_UNVERIFIABLE', severity: 'error', message: `Narration line ${index} could not be verified: ${error instanceof Error ? error.message : String(error)}` });
    }
  }
  let integratedLufs: number | null = null;
  if (spec.hasAudio) {
    const decoded = await runOk(ffmpeg, ['-hide_banner', '-nostats', '-i', videoFile, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'], { signal, timeoutMs: DECODE_TIMEOUT_MS });
    integratedLufs = parseIntegratedLufs(decoded.stderr);
  }
  const stem = videoFile.slice(0, videoFile.length - extname(videoFile).length);
  const sidecars = await Promise.all(['srt', 'vtt', 'ass'].map((ext) => stat(`${stem}.${ext}`).then((s) => s.isFile() && s.size > 0).catch(() => false)));
  issues.push(...assessDeliveredNarration(lines, spec.durationSec), ...assessDeliveredSpec({
    spec, planTotalTargetSec: plan.total_target_sec, planAspect: plan.aspect,
    narrationLineCount: declared.length, captionLineCount: plan.tracks?.captions?.lines?.length ?? 0,
    integratedLufs, sidecarSubtitleFound: sidecars.some(Boolean),
  }));
  return { ok: !issues.some((issue) => issue.severity === 'error'), video_path: videoFile, spec, integrated_lufs: integratedLufs, narration_lines_measured: lines.length, issues };
}
