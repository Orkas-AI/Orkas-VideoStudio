import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  linePlaybacks, narrationPlaybackFindings, NARRATION_PLAYBACK_LIMITS, NARRATION_PLAYBACK_RATE, ORIGINAL_AUDIO_LIMITS,
  originalAudioComparable, originalAudioHeard, originalAudioUnverifiedIssue, resolveFfmpegTools, run,
  type DeliveryIssue, type LinePlayback, type PlaybackPcm,
} from '@orkas/video-studio-core';

const DECODE_TIMEOUT_MS = 2 * 60_000;

/** Mono PCM at the matching rate, up to `maxSec` plus one second so an overlong file shows, or
 *  `maxSec` from `startSec` when given; null when unreadable. */
async function decodeMono(file: string, maxSec: number, signal?: AbortSignal, startSec?: number): Promise<PlaybackPcm | null> {
  const pcm = join(tmpdir(), `ovs-narration-playback-${randomUUID()}.f32`);
  try {
    const range = startSec === undefined ? ['-t', String(maxSec + 1), '-i', file] : ['-ss', String(startSec), '-i', file, '-t', String(maxSec)];
    const decoded = await run(resolveFfmpegTools().ffmpeg, ['-v', 'error', '-nostdin', '-y', ...range,
      '-vn', '-ac', '1', '-ar', String(NARRATION_PLAYBACK_RATE), '-f', 'f32le', pcm], { signal, timeoutMs: DECODE_TIMEOUT_MS, maxBuffer: 1024 * 1024 });
    if (decoded.code !== 0) return null;
    const bytes = await fs.readFile(pcm);
    const samples = new Float32Array(Math.floor(bytes.length / 4));
    for (let index = 0; index < samples.length; index += 1) samples[index] = bytes.readFloatLE(index * 4);
    return { rate: NARRATION_PLAYBACK_RATE, samples };
  } catch (error) {
    if (signal?.aborted) throw error;
    return null;
  } finally {
    await fs.rm(pcm, { force: true }).catch(() => undefined);
  }
}

/**
 * Declared narration lines that play twice or stop before their end in the delivered file, found
 * by sound. Says nothing when the sound cannot be read or the work would be too large: an
 * unchecked delivery is not stopped. A file declared for several lines is matched once.
 */
export async function narrationPlaybackIssues(input: {
  video: string;
  lines: ReadonlyArray<{ path: string; text: string }>;
  signal?: AbortSignal;
}): Promise<DeliveryIssue[]> {
  const unique = new Map<string, string>();
  for (const line of input.lines) if (!unique.has(resolve(line.path))) unique.set(resolve(line.path), line.text);
  const voices = [...unique].slice(-NARRATION_PLAYBACK_LIMITS.maxLines);
  if (!voices.length) return [];
  const output = await decodeMono(input.video, NARRATION_PLAYBACK_LIMITS.maxDeliverySec, input.signal);
  if (!output || !output.samples.length) return [];
  const outputSec = output.samples.length / NARRATION_PLAYBACK_RATE;
  // The extra decoded second detects overlong soundtracks; a truncated prefix cannot establish delivery.
  if (outputSec > NARRATION_PLAYBACK_LIMITS.maxDeliverySec) return [];
  const lines: Array<{ text: string; playbacks: LinePlayback[] }> = [];
  let work = 0;
  for (const [file, text] of voices) {
    if (input.signal?.aborted) throw input.signal.reason ?? new Error('Narration playback check aborted.');
    const source = await decodeMono(file, NARRATION_PLAYBACK_LIMITS.maxLineSec, input.signal);
    if (!source || !source.samples.length) continue;
    const sourceSec = source.samples.length / NARRATION_PLAYBACK_RATE;
    if (sourceSec > NARRATION_PLAYBACK_LIMITS.maxLineSec) continue;
    work += outputSec * sourceSec;
    if (work > NARRATION_PLAYBACK_LIMITS.maxWork) return [];
    // Matching one line takes up to about 4 s at the allowed limits (180 s of sound, a 33 s line);
    // yield between lines so other work can run.
    await new Promise<void>((done) => setImmediate(done));
    lines.push({ text, playbacks: linePlaybacks(output, source) });
  }
  return narrationPlaybackFindings(lines);
}

/** Clip sound the timeline keeps: the source file, where the clip starts in it, and where and how
 *  long it plays in the delivery. */
export type KeptClipAudio = { source: string; sourceStartSec: number; startSec: number; durationSec: number };

/**
 * Kept clip sound that cannot be found in step in the delivered file, each as a warning naming
 * its stretch. Matches the source and delivered slices the timeline places, within a few seconds
 * in all; a clip too short, too long or without sound to compare says nothing.
 */
export async function originalClipAudioWarnings(input: {
  video: string;
  clips: readonly KeptClipAudio[];
  signal?: AbortSignal;
  /** The check's own time budget; ORIGINAL_AUDIO_LIMITS.timeoutMs unless a test shortens it. */
  deadlineMs?: number;
}): Promise<DeliveryIssue[]> {
  const deadline = AbortSignal.timeout(input.deadlineMs ?? ORIGINAL_AUDIO_LIMITS.timeoutMs);
  const signal = input.signal ? AbortSignal.any([input.signal, deadline]) : deadline;
  const warnings: DeliveryIssue[] = [];
  let workSec = 0;
  for (const clip of input.clips.slice(0, ORIGINAL_AUDIO_LIMITS.maxClips)) {
    const { durationSec, source: file, sourceStartSec, startSec } = clip;
    if (durationSec < ORIGINAL_AUDIO_LIMITS.minClipSec || durationSec > ORIGINAL_AUDIO_LIMITS.maxClipSec
      || workSec + durationSec > ORIGINAL_AUDIO_LIMITS.maxAudioSec) continue;
    workSec += durationSec;
    let source: PlaybackPcm | null, output: PlaybackPcm | null;
    try {
      source = await decodeMono(file, durationSec, signal, sourceStartSec);
      if (!source || !originalAudioComparable(source)) continue;
      output = await decodeMono(input.video, durationSec, signal, startSec);
    } catch (error) {
      // The caller's stop ends delivery; the check's own deadline only ends the check.
      if (input.signal?.aborted) throw error;
      break;
    }
    if (output && originalAudioHeard(output, source)) continue;
    warnings.push(originalAudioUnverifiedIssue(startSec, durationSec));
  }
  return warnings;
}
