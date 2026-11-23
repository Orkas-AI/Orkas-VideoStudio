import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  linePlaybacks, narrationPlaybackFindings, NARRATION_PLAYBACK_LIMITS, NARRATION_PLAYBACK_RATE, resolveFfmpegTools, run,
  type DeliveryIssue, type LinePlayback, type PlaybackPcm,
} from '@orkas/video-studio-core';

const DECODE_TIMEOUT_MS = 2 * 60_000;

/** Mono PCM at the matching rate, up to `maxSec` plus one second so an overlong file shows; null when unreadable. */
async function decodeMono(file: string, maxSec: number, signal?: AbortSignal): Promise<PlaybackPcm | null> {
  const pcm = join(tmpdir(), `ovs-narration-playback-${randomUUID()}.f32`);
  try {
    const decoded = await run(resolveFfmpegTools().ffmpeg, ['-v', 'error', '-nostdin', '-y', '-t', String(maxSec + 1), '-i', file,
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
