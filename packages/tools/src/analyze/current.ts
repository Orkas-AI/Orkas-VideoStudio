import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ACTIVITY_SAMPLE_RATE, activityWindowCount, beatStrengths, cutsAgainstBeats,
  formatPhraseLines, normalizeActivityRegions, normalizeTranscriptWords, packTranscriptPhrases,
  parseQualityFrames, resolveFfmpegTools, rhythm, runOk, STEADY_BEAT_CONFIDENCE,
  summarizeActivity, tempoOf,
} from '@orkas/video-studio-core';
import { probeMedia } from '../edit/edit.js';
import { runFfmpeg, type EditRunOptions } from '../progress.js';
import { readTranscript, scenes, silence } from './analyze.js';

export async function phrases(p: { input: string; transcript: string; break_sec?: number; noise_db?: number }, opts?: EditRunOptions, includeUntranscribed = false) {
  const json = await readTranscript(p.transcript);
  let units = normalizeTranscriptWords(json);
  let timing: 'word' | 'segment' = 'word';
  // Unlabeled external arrays retain segment precision for compatibility.
  if (!units.length && json && typeof json === 'object' && 'segments' in json) {
    units = normalizeTranscriptWords(json.segments);
    timing = 'segment';
  } else if (Array.isArray(json)) timing = 'segment';
  if (!units.length) throw new Error('Transcript has no timed words or segments.');
  const quiet = await silence({ input: p.input, noise_db: p.noise_db, min_sec: 0.15 }, opts);
  const lines = packTranscriptPhrases(units, quiet.spans.map(s => ({ startSec: s.start, endSec: s.end })), { breakSec: p.break_sec, segments: timing === 'segment', includeUntranscribed });
  return {
    durationSec: (await probeMedia(p.input)).duration,
    timing, lines: lines.length, measuredPauses: quiet.spans.length, phrases: lines,
    text: formatPhraseLines(lines),
    note: 'Times and pauses are measured; speech recognition can place words near a neighboring line. Cut at line edges or marked pauses, and verify the finished cut.',
  };
}

/** A bounded disk decode keeps binary audio out of the text process transport. */
export async function decodeMonoPcm(input: string, rate: number, signal?: AbortSignal): Promise<Float32Array> {
  const probe = await probeMedia(input);
  if (!(probe.duration > 0) || probe.duration > 600) throw new Error('Beat analysis needs 0–600 seconds of readable sound; analyze a shorter excerpt.');
  const directory = await mkdtemp(join(tmpdir(), 'ovs-pcm-'));
  const output = join(directory, 'sound.f32');
  try {
    await runOk(resolveFfmpegTools().ffmpeg, ['-hide_banner', '-nostats', '-y', '-i', input, '-vn', '-ac', '1', '-ar', String(rate), '-t', '600', '-fs', '64000004', '-f', 'f32le', output], { signal, timeoutMs: 120_000, maxBuffer: 1024 * 1024 });
    if ((await stat(output)).size > 64_000_000) throw new Error('Decoded audio exceeds the analysis limit.');
    const bytes = await readFile(output);
    if (!bytes.length || bytes.length > 64_000_000) throw new Error('Sound could not be decoded within the analysis limit.');
    const samples = new Float32Array(Math.floor(bytes.length / 4));
    for (let i = 0; i < samples.length; i++) samples[i] = bytes.readFloatLE(i * 4);
    return samples;
  } finally { await rm(directory, { recursive: true, force: true }); }
}

export async function beats(p: { input: string; fps?: number }, opts?: EditRunOptions) {
  if (p.fps !== undefined && (!Number.isFinite(p.fps) || p.fps <= 0 || p.fps > 240)) throw new Error('fps must be between 0 and 240.');
  const rate = 22050;
  const samples = await decodeMonoPcm(p.input, rate, opts?.signal);
  const found = rhythm({ sampleRate: rate, channels: [samples] });
  const times = found.beats.times;
  const probe = await probeMedia(p.input);
  const fps = p.fps ?? (probe.fps || 30);
  const durationSec = Math.round(samples.length / rate * 100) / 100;
  if (!times.length) return { durationSec, steady: false, confidence: found.beats.confidence ?? 0, reason: found.beats.reason ?? 'no steady beat', note: 'Cut on phrases or strong moments, or hold.' };
  const strengths = beatStrengths(samples, rate, times);
  const cuts = probe.width ? cutsAgainstBeats((await scenes({ input: p.input }, opts)).candidates.map(c => c.tSec), times, fps) : [];
  return {
    durationSec, steady: (found.beats.confidence ?? 0) >= STEADY_BEAT_CONFIDENCE,
    confidence: found.beats.confidence ?? 0, bpm: tempoOf(times).value, fps, beatCount: times.length,
    beats: times.slice(0, 600).map((t, i) => ({ t, frame: Math.round(t * fps), strength: strengths[i] })),
    downbeats: { times: found.downbeats.times.slice(0, 200), meter: found.downbeats.meter, confidence: 'low' },
    cuts: { count: cuts.length, off_beat: cuts.filter(c => Math.abs(c.offsetFrames) > 1).length, list: cuts.slice(0, 200) },
  };
}

export async function activity(p: { input: string; regions: unknown; window_sec?: number; lead_ratio?: number; min_turn_sec?: number }, opts?: EditRunOptions) {
  if (p.window_sec !== undefined && (!Number.isFinite(p.window_sec) || p.window_sec <= 0 || !Number.isFinite(1 / p.window_sec))) throw new Error('window_sec must be a positive finite number.');
  const regions = normalizeActivityRegions(p.regions);
  if (typeof regions === 'string') throw new Error(regions);
  const probe = await probeMedia(p.input);
  activityWindowCount(probe.duration, p.window_sec ?? 0.5);
  const series: Record<string, Array<{ tSec: number; value: number }>> = Object.create(null);
  for (const region of regions) {
    const [l, t, r, b] = region.box;
    const crop = `crop=iw*${(r - l).toFixed(4)}:ih*${(b - t).toFixed(4)}:iw*${l.toFixed(4)}:ih*${t.toFixed(4)}`;
    const vf = `fps=${ACTIVITY_SAMPLE_RATE},${crop},scale=160:-2,format=gray,tblend=all_mode=difference,signalstats,metadata=print`;
    const result = await runFfmpeg(resolveFfmpegTools().ffmpeg, ['-hide_banner', '-nostats', '-i', p.input, '-vf', vf, '-an', '-f', 'null', '-'], { op: 'activity_scan', phase: 'analyze', durationSec: probe.duration, ...opts });
    if (result.code !== 0) throw new Error('Region activity scan failed.');
    series[region.id] = parseQualityFrames(`${result.stdout}\n${result.stderr}`).filter(f => typeof f.brightness === 'number').map(f => ({ tSec: f.tSec, value: f.brightness! }));
  }
  const measured = summarizeActivity(series, { durationSec: probe.duration, windowSec: p.window_sec, leadRatio: p.lead_ratio, minTurnSec: p.min_turn_sec });
  const centre = Object.fromEntries(regions.map(r => [r.id, { x: (r.box[0] + r.box[2]) / 2, y: (r.box[1] + r.box[3]) / 2 }]));
  return {
    durationSec: probe.duration, regions, turns: measured.turns,
    plan: measured.turns.map(t => ({ start: t.startSec, centre_x: centre[t.regionId].x, centre_y: centre[t.regionId].y })),
    windowCount: measured.windows.length,
    ...(measured.windows.length <= 240 ? { windows: measured.windows } : {}),
    caution: 'Region motion is a proxy for speech on a still camera; check a frame at every turn before cutting.',
  };
}
