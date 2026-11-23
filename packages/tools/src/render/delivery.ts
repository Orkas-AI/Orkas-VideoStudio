import { stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import {
  assessDeliveredNarration, assessDeliveredExpectations, assessSilentStretches, parseDeliveredAudioMeasurement, parseVoicedSpan,
  resolveFfmpegTools, runOk, videoProductionIsGeneration,
  type DeliveryIssue, type DeliveryNarrationLine, type DeliveryVideoSpec, type VideoEdl, parseSilenceLog,
} from '@orkas/video-studio-core';
import { narrationOverSpeechIssues } from './mix-evidence.js';
import { narrationPlaybackIssues } from './narration-playback.js';
import { dirname } from 'node:path';
import { resolveProducedPath } from '../plan-produced.js';

const PROBE_TIMEOUT_MS = 60_000;
const DECODE_TIMEOUT_MS = 600_000;

async function probe(file: string, signal?: AbortSignal) {
  const { ffprobe } = resolveFfmpegTools();
  const result = await runOk(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { signal, timeoutMs: PROBE_TIMEOUT_MS });
  const data = JSON.parse(result.stdout) as { streams?: Array<Record<string, unknown>>; format?: { duration?: string; tags?: { comment?: string } } };
  const duration = Number(data.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Media has no measurable duration: ${file}`);
  return { streams: data.streams ?? [], duration, narrationMixExpected: (data.format?.tags?.comment ?? '').split('\n').includes('ORKAS_NARRATION_MIX_V1') };
}

type DeliveryExpectations = { durationSec?: number; aspect?: string; audio?: boolean; captions?: boolean };
/** Which checks the caller can act on; never how the file was made. */
type DeliveryChecks = {
  /** Match each declared narration file against the delivered sound (needs a caller that can accept findings). */
  narrationPlayback?: boolean;
  /** Look for captions in the container: only a sidecar or subtitle stream shows there, never burned captions. */
  containerCaptions?: boolean;
  /** Receives each measured narration line, as voiced on the delivered timeline. */
  heard?: Array<{ startSec: number; endSec: number; text: string }>;
};

/** Verify actual delivered bytes independently of the generation or assembly route. */
export function verifyProductionDelivery(plan: VideoEdl, planPath: string, videoPath: string, signal?: AbortSignal, expectations?: DeliveryExpectations) {
  return verifyDelivery(plan, planPath, videoPath, signal, expectations, { containerCaptions: true });
}

/** The delivery check `timeline ship` runs: narration must play once and whole, and captions are
 *  not looked for in the container, since they are burned in. Also returns the measured lines. */
export async function verifyTimelineDelivery(plan: VideoEdl, planPath: string, videoPath: string, signal?: AbortSignal, expectations?: DeliveryExpectations) {
  const heard: NonNullable<DeliveryChecks['heard']> = [];
  const checked = await verifyDelivery(plan, planPath, videoPath, signal, expectations, { narrationPlayback: true, containerCaptions: false, heard });
  return { checked, heard };
}

async function verifyDelivery(plan: VideoEdl, planPath: string, videoPath: string, signal: AbortSignal | undefined, expectations: DeliveryExpectations | undefined, checks: DeliveryChecks) {
  const videoFile = resolve(videoPath);
  const isGeneration = videoProductionIsGeneration(plan);
  let measured: Awaited<ReturnType<typeof probe>> | null = null;
  try {
    measured = await probe(videoFile, signal);
  } catch (error) {
    if (!isGeneration || signal?.aborted) throw error;
  }
  if (!measured) {
    return {
      ok: false,
      is_generation: true,
      video_path: videoFile,
      spec: null,
      integrated_lufs: null,
      narration_lines_measured: 0,
      issues: [{
        code: 'DELIVERY_VIDEO_UNREADABLE' as const,
        severity: 'error' as const,
        message: 'The output has no readable video stream. Delivery failed; retain provider transaction evidence before deciding recovery.',
      }],
      note: 'Direct model output: readable video stream checked; creative, reference fidelity and audio mastering checks were not run.',
    };
  }
  const stream = measured.streams.find((entry) => entry.codec_type === 'video');
  if (!stream || !(Number(stream.width) > 0) || !(Number(stream.height) > 0)) {
    if (!isGeneration) throw new Error('Delivered media has no measurable video stream.');
    return {
      ok: false,
      is_generation: true,
      video_path: videoFile,
      spec: null,
      integrated_lufs: null,
      narration_lines_measured: 0,
      issues: [{
        code: 'DELIVERY_VIDEO_UNREADABLE' as const,
        severity: 'error' as const,
        message: 'The output has no readable video stream. Delivery failed; retain provider transaction evidence before deciding recovery.',
      }],
      note: 'Direct model output: readable video stream checked; creative, reference fidelity and audio mastering checks were not run.',
    };
  }
  const [numerator, denominator] = String(stream.avg_frame_rate ?? stream.r_frame_rate ?? '').split('/').map(Number);
  const spec: DeliveryVideoSpec = {
    durationSec: measured.duration, width: Number(stream.width), height: Number(stream.height),
    fps: numerator > 0 && denominator > 0 ? numerator / denominator : null,
    videoDurationSec: Number(stream.duration) || undefined,
    audioDurationSec: Math.max(0, ...measured.streams.filter(s => s.codec_type === 'audio').map(s => Number(s.duration) || 0)) || undefined,
    hasAudio: measured.streams.some((entry) => entry.codec_type === 'audio'),
    subtitleStreams: measured.streams.filter((entry) => entry.codec_type === 'subtitle').length,
  };
  const { ffmpeg } = resolveFfmpegTools();
  const issues: DeliveryIssue[] = [];
  const lines: DeliveryNarrationLine[] = [];
  const voices: Array<{ path: string; text: string }> = [];
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
      voices.push({ path: audioFile, text: line.text });
      checks.heard?.push({ startSec: line.start_sec! + span.startSec, endSec: line.start_sec! + span.endSec, text: line.text.length > 200 ? `${line.text.slice(0, 200)}…` : line.text });
    } catch (error) {
      if (signal?.aborted) throw error;
      issues.push({ code: 'DELIVERY_NARRATION_UNVERIFIABLE', severity: 'error', message: `Narration line ${index} could not be verified: ${error instanceof Error ? error.message : String(error)}` });
    }
  }
  let measurement = { integratedLufs: null, digitalSilence: null } as ReturnType<typeof parseDeliveredAudioMeasurement>;
  let silences: Array<{ startSec: number; endSec: number }> | null = null;
  if (spec.hasAudio) {
    try {
      const count = measured.streams.filter(s => s.codec_type === 'audio').length;
      const silence = count === 1 ? ',silencedetect=noise=-50dB:d=3' : '';
      const decoded = await runOk(ffmpeg, ['-hide_banner', '-nostats', '-nostdin', '-xerror', '-i', videoFile, '-map', '0:a', '-vn', '-sn', '-dn', '-af', `astats=measure_perchannel=none:measure_overall=Peak_level+Number_of_samples,ebur128=peak=true:framelog=verbose${silence}`, '-f', 'null', '-'], { signal, timeoutMs: DECODE_TIMEOUT_MS });
      measurement = parseDeliveredAudioMeasurement(decoded.stderr, count);
      if (silence) silences = parseSilenceLog(decoded.stderr, measured.duration);
    } catch (error) { if (signal?.aborted) throw error; }
  }
  issues.push(...await narrationOverSpeechIssues(videoFile, dirname(resolve(planPath)), signal, measured.narrationMixExpected));
  // Each declared line plays once and whole in the delivered sound.
  if (checks.narrationPlayback && spec.hasAudio) issues.push(...await narrationPlaybackIssues({ video: videoFile, lines: voices, signal }));
  const integratedLufs = measurement.integratedLufs;
  const expectsAudio = expectations?.audio ?? (declared.length > 0 || Boolean(plan.tracks?.music) || spec.hasAudio);
  const expectsCaptions = checks.containerCaptions === true && (expectations?.captions ?? Boolean(plan.tracks?.captions?.lines?.length));
  const stem = videoFile.slice(0, videoFile.length - extname(videoFile).length);
  const sidecars = expectsCaptions ? await Promise.all(['srt', 'vtt', 'ass'].map((ext) => stat(`${stem}.${ext}`).then((s) => s.isFile() && s.size > 0).catch(() => false))) : [];
  issues.push(...assessDeliveredNarration(lines, spec.durationSec), ...assessSilentStretches(silences, expectsAudio), ...assessDeliveredExpectations({
    spec, expectedDurationSec: expectations?.durationSec ?? plan.total_target_sec, expectedAspect: expectations?.aspect ?? plan.aspect,
    expectsAudio, expectsCaptions, digitalSilence: measurement.digitalSilence,
    integratedLufs, sidecarSubtitleFound: sidecars.some(Boolean),
  }));
  return { ok: !issues.some((issue) => issue.severity === 'error'), is_generation: isGeneration, video_path: videoFile, spec, integrated_lufs: integratedLufs, narration_lines_measured: lines.length, issues };
}
