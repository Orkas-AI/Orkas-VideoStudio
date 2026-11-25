// Portable delivery assessment. Measurements are supplied by the tools layer.
/** Same targets the assembly tier normalizes to (video-craft §7). */
export const DELIVERY_LOUDNESS_TARGET_I = -14;
/** Integrated loudness within this many LU of target is delivery-clean. Wider
 *  than a mastering tolerance on purpose: platforms renormalize, so this is
 *  meant to catch "nobody normalized at all", not to grade a mix. */
export const DELIVERY_LOUDNESS_TOLERANCE_LU = 2;
/** Duration agreement between the delivered file and the signed plan. */
export const DELIVERY_DURATION_TOLERANCE_SEC = 0.5;
/** Two lines closer than this are treated as touching, not overlapping —
 *  silencedetect boundaries are not frame-exact. */
export const DELIVERY_OVERLAP_TOLERANCE_SEC = 0.05;

export type DeliveryVideoSpec = {
  durationSec: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  hasAudio: boolean;
  audioStreams?: number;
  /** Read only by the legacy plan check; burned captions never show in the container. */
  subtitleStreams?: number;
  videoDurationSec?: number;
  audioDurationSec?: number;
  narrationMixExpected?: boolean;
};

export type DeliveryNarrationLine = {
  index: number;
  startSec: number;
  targetSec: number | null;
  /** Absolute seconds on the delivered timeline where this line's speech
   *  actually starts and stops — NOT the file's byte duration. A provider that
   *  pads silence would otherwise read as an overlap it does not cause. */
  voicedStartSec: number;
  voicedEndSec: number;
  textHead: string;
};

export type DeliveryIssue = {
  code:
    | 'DELIVERY_VIDEO_UNREADABLE'
    | 'DELIVERY_AV_DURATION_MISMATCH'
    | 'DELIVERY_NARRATION_OVERLAP'
    | 'DELIVERY_NARRATION_TRUNCATED'
    | 'DELIVERY_DURATION_DRIFT'
    | 'DELIVERY_REQUESTED_DURATION_DRIFT'
    | 'DELIVERY_ASPECT_MISMATCH'
    | 'DELIVERY_NO_AUDIO'
    | 'DELIVERY_AUDIO_SILENT'
    | 'DELIVERY_AUDIO_UNVERIFIABLE'
    | 'DELIVERY_SILENT_STRETCH'
    | 'DELIVERY_NARRATION_OVER_SPEECH'
    | 'DELIVERY_CUTS_OFF_BEAT'
    | 'DELIVERY_NO_CUTS'
    | 'DELIVERY_SHOT_HELD'
    | 'DELIVERY_HELD_STILLS'
    | 'DELIVERY_NARRATION_REPEATED'
    | 'DELIVERY_NARRATION_CUT_OFF'
    | 'DELIVERY_ORIGINAL_AUDIO_UNVERIFIED'
    | 'DELIVERY_MOTION_BELOW_REFERENCE'
    | 'DELIVERY_LOUDNESS_OFF_TARGET'
    | 'DELIVERY_CAPTIONS_MISSING'
    | 'DELIVERY_NARRATION_UNVERIFIABLE';
  severity: 'error' | 'warning';
  message: string;
};

export * from './narration-playback.js';
export * from './reference-motion.js';

/** Overlapping or truncated speech in the delivered timeline.
 *
 * Judged on voiced spans, the same way `assessVoiceoverCoverage` judges a mix,
 * because a file's duration is not its speech: the 2026-08-10 files happened to
 * carry no trailing silence, so duration math agreed by luck, and a provider
 * that pads would have produced false overlaps on every line. Interior gaps are
 * deliberately NOT reported as issues — a measured survey of 13 plans put a
 * usable gap threshold at 6 of 13 firing, so held silence stays the author's
 * call. */
export function assessDeliveredNarration(
  lines: readonly DeliveryNarrationLine[],
  videoDurationSec: number | null,
): DeliveryIssue[] {
  const issues: DeliveryIssue[] = [];
  const ordered = [...lines].sort((a, b) => a.voicedStartSec - b.voicedStartSec);
  let furthest = ordered[0];
  for (let i = 1; i < ordered.length; i += 1) {
    const prev = furthest;
    const line = ordered[i];
    const overlap = Math.min(prev.voicedEndSec, line.voicedEndSec) - line.voicedStartSec;
    if (line.voicedEndSec > furthest.voicedEndSec) furthest = line;
    if (overlap > DELIVERY_OVERLAP_TOLERANCE_SEC) {
      issues.push({
        code: 'DELIVERY_NARRATION_OVERLAP',
        severity: 'error',
        message: `Narration lines ${prev.index} and ${line.index} both speak for ${overlap.toFixed(2)}s`
          + ` — line ${prev.index} runs to ${prev.voicedEndSec.toFixed(2)}s and line ${line.index} starts at`
          + ` ${line.voicedStartSec.toFixed(2)}s. Shorten line ${prev.index} and re-synthesize it, or move line`
          + ` ${line.index} later in the plan.`,
      });
    }
  }
  const last = furthest;
  if (last && typeof videoDurationSec === 'number' && videoDurationSec > 0) {
    const past = last.voicedEndSec - videoDurationSec;
    if (past > DELIVERY_OVERLAP_TOLERANCE_SEC) {
      issues.push({
        code: 'DELIVERY_NARRATION_TRUNCATED',
        severity: 'error',
        message: `Narration line ${last.index} still speaks ${past.toFixed(2)}s after the ${videoDurationSec.toFixed(2)}s`
          + ' video ends, so that much of it is missing from the deliverable. Shorten that line and re-synthesize it,'
          + ' or extend the video to cover it.',
      });
    }
  }
  return issues;
}

/** Delivered file against the signed plan: length, canvas, audio presence,
 *  loudness, and declared captions. */
export function assessDeliveredSpec(input: {
  spec: DeliveryVideoSpec;
  planTotalTargetSec: number | null;
  planAspect: string | null;
  narrationLineCount: number;
  captionLineCount: number;
  integratedLufs: number | null;
  sidecarSubtitleFound: boolean;
}): DeliveryIssue[] {
  const issues: DeliveryIssue[] = [];
  const { spec } = input;
  if (typeof spec.durationSec === 'number' && typeof input.planTotalTargetSec === 'number'
    && input.planTotalTargetSec > 0) {
    const drift = Math.abs(spec.durationSec - input.planTotalTargetSec);
    if (drift > DELIVERY_DURATION_TOLERANCE_SEC) {
      issues.push({
        code: 'DELIVERY_DURATION_DRIFT',
        severity: 'error',
        message: `The delivered video is ${spec.durationSec.toFixed(2)}s but the approved plan is`
          + ` ${input.planTotalTargetSec}s (off by ${drift.toFixed(2)}s). Everything timed against the plan —`
          + ' narration placement, captions — is judged against the plan length, so this has to agree before delivery.',
      });
    }
  }
  const aspect = parseAspectRatio(input.planAspect);
  if (aspect && spec.width && spec.height) {
    const delivered = spec.width / spec.height;
    if (Math.abs(delivered - aspect) / aspect > 0.02) {
      issues.push({
        code: 'DELIVERY_ASPECT_MISMATCH',
        severity: 'error',
        message: `The delivered video is ${spec.width}x${spec.height} but the approved plan is ${input.planAspect}.`,
      });
    }
  }
  if (input.narrationLineCount > 0 && !spec.hasAudio) {
    issues.push({
      code: 'DELIVERY_NO_AUDIO',
      severity: 'error',
      message: `The plan carries ${input.narrationLineCount} narration line(s) but the delivered file has no audio track.`,
    });
  }
  if (spec.hasAudio && typeof input.integratedLufs === 'number') {
    const off = input.integratedLufs - DELIVERY_LOUDNESS_TARGET_I;
    if (Math.abs(off) > DELIVERY_LOUDNESS_TOLERANCE_LU) {
      issues.push({
        code: 'DELIVERY_LOUDNESS_OFF_TARGET',
        severity: 'warning',
        message: `The delivered audio measures ${input.integratedLufs.toFixed(1)} LUFS against a`
          + ` ${DELIVERY_LOUDNESS_TARGET_I} LUFS target (${off > 0 ? 'louder' : 'quieter'} by`
          + ` ${Math.abs(off).toFixed(1)} LU). Run the assembly loudness step on the final file.`,
      });
    }
  }
  if (input.captionLineCount > 0 && spec.subtitleStreams === 0 && !input.sidecarSubtitleFound) {
    issues.push({
      code: 'DELIVERY_CAPTIONS_MISSING',
      severity: 'warning',
      message: `The plan declares ${input.captionLineCount} caption line(s), and the delivered file has no subtitle`
        + ' stream and no sidecar subtitle file beside it. Burned-in captions cannot be detected from the container,'
        + ' so if they were burned in say so; otherwise the captions track was not produced.',
    });
  }
  return issues;
}

/** `16:9` -> 1.777…; anything unparseable -> null (no aspect claim to check). */
export function parseAspectRatio(value: string | null | undefined): number | null {
  const match = /^\s*(\d+(?:\.\d+)?)\s*[:x/]\s*(\d+(?:\.\d+)?)\s*$/i.exec(String(value ?? ''));
  if (!match) return null;
  const w = Number(match[1]);
  const h = Number(match[2]);
  if (!(w > 0) || !(h > 0)) return null;
  return w / h;
}

/** Voiced span of one audio file, in file-relative seconds.
 *
 * Trailing silence exists only when the final `silence_start` has no matching
 * `silence_end`; the pairs in between are ordinary phrase pauses. Reading the
 * last `silence_start` as the end of speech reports a 4.26s file as 1.47s of
 * audio. */
export function parseVoicedSpan(stderr: string, durationSec: number): { startSec: number; endSec: number } {
  const starts = [...stderr.matchAll(/(?:silence_start:\s*|^lavfi\.silence_start=)(-?[\d.]+)/gm)].map((m) => Number(m[1]));
  const ends = [...stderr.matchAll(/(?:silence_end:\s*|^lavfi\.silence_end=)(-?[\d.]+)/gm)].map((m) => Number(m[1]));
  const leading = starts.length && ends.length && starts[0] <= 0.001 ? ends[0] : 0;
  const trailing = starts.length > ends.length ? Math.max(0, durationSec - starts[starts.length - 1]) : 0;
  const startSec = Math.min(Math.max(0, leading), durationSec);
  const endSec = Math.max(startSec, durationSec - trailing);
  return { startSec, endSec };
}

/** Integrated LUFS of a delivered file, or null when it cannot be measured.
 *
 * Reads the ebur128 SUMMARY, never the running log: that log carries its own
 * `I:` and the first line always reads the -70 LUFS gate floor. */
export function parseIntegratedLufs(stderr: string): number | null {
  const at = stderr.toLowerCase().lastIndexOf('summary:');
  if (at < 0) return null;
  const match = /\bI:\s*(-?(?:inf|[\d.]+))\s*LUFS/i.exec(stderr.slice(at));
  if (!match || /inf/i.test(match[1])) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export function assessDeliveredExpectations(input: {
  spec: DeliveryVideoSpec;
  /** The length that narration and captions in the current timeline or plan use. */
  expectedDurationSec: number | null;
  /** The caller's editorial length target, when known: a difference is advice, not a block. */
  requestedDurationSec?: number;
  expectedAspect: string | null;
  expectsAudio: boolean;
  expectsCaptions: boolean;
  integratedLufs: number | null;
  /** Full successful decode: true only when every sample in every audio stream is zero. */
  digitalSilence?: boolean | null;
  sidecarSubtitleFound: boolean;
}): DeliveryIssue[] {
  const issues: DeliveryIssue[] = [];
  const { spec } = input;
  const { expectedDurationSec, requestedDurationSec } = input;
  if (typeof spec.durationSec === 'number' && typeof expectedDurationSec === 'number' && expectedDurationSec > 0) {
    const drift = Math.abs(spec.durationSec - expectedDurationSec);
    if (drift > DELIVERY_DURATION_TOLERANCE_SEC) {
      issues.push({
        code: 'DELIVERY_DURATION_DRIFT',
        severity: 'error',
        message: `The delivered video is ${spec.durationSec.toFixed(2)}s but it should be`
          + ` ${expectedDurationSec}s (off by ${drift.toFixed(2)}s). Narration and captions are timed against`
          + ' that length, so the two have to agree before delivery.',
      });
    }
  }
  // 2026-11-24: the length asked for can change on the way, or a shorter cut can serve the brief
  // better, so a difference is reported for the caller to judge rather than stopping delivery.
  if (typeof spec.durationSec === 'number' && typeof requestedDurationSec === 'number'
    && Number.isFinite(requestedDurationSec) && requestedDurationSec > 0) {
    const drift = Math.abs(spec.durationSec - requestedDurationSec);
    if (drift > DELIVERY_DURATION_TOLERANCE_SEC) {
      issues.push({
        code: 'DELIVERY_REQUESTED_DURATION_DRIFT',
        severity: 'warning',
        message: `The delivered video is ${spec.durationSec.toFixed(2)}s. The requested length was ${requestedDurationSec}s`
          + ` (a difference of ${drift.toFixed(2)}s). Use the editing context to decide whether to keep this cut or revise it.`,
      });
    }
  }
  const aspect = parseAspectRatio(input.expectedAspect);
  if (aspect && spec.width && spec.height) {
    const delivered = spec.width / spec.height;
    if (Math.abs(delivered - aspect) / aspect > 0.02) {
      issues.push({
        code: 'DELIVERY_ASPECT_MISMATCH',
        severity: 'error',
        message: `The delivered video is ${spec.width}x${spec.height} but it should be ${input.expectedAspect}.`,
      });
    }
  }
  if (spec.hasAudio && typeof spec.audioDurationSec === 'number' && typeof spec.videoDurationSec === 'number' && Math.abs(spec.audioDurationSec - spec.videoDurationSec) > .5) issues.push({ code: 'DELIVERY_AV_DURATION_MISMATCH', severity: 'error', message: avDurationMismatchMessage(spec.videoDurationSec, spec.audioDurationSec) });
  if (input.expectsAudio && !spec.hasAudio) {
    issues.push({
      code: 'DELIVERY_NO_AUDIO',
      severity: 'error',
      message: 'This video should have sound, but the delivered file has no audio track.',
    });
  }
  if (input.expectsAudio && spec.hasAudio && input.digitalSilence === true) {
    issues.push({
      code: 'DELIVERY_AUDIO_SILENT',
      severity: 'error',
      message: 'This video should have sound, but every decoded audio sample in the final file is zero. Check the source audio and mix gains, repair the mix, then render and ship again.',
    });
  } else if (input.expectsAudio && spec.hasAudio && input.digitalSilence === null) {
    issues.push({
      code: 'DELIVERY_AUDIO_UNVERIFIABLE',
      severity: 'warning',
      message: 'The final file has audio, but a complete audio measurement was unavailable. Its sound has not been verified; listen to the final file before using it.',
    });
  }
  if (spec.hasAudio && input.digitalSilence !== true && typeof input.integratedLufs === 'number' && Number.isFinite(input.integratedLufs)) {
    const off = input.integratedLufs - DELIVERY_LOUDNESS_TARGET_I;
    if (Math.abs(off) > DELIVERY_LOUDNESS_TOLERANCE_LU) {
      issues.push({
        code: 'DELIVERY_LOUDNESS_OFF_TARGET',
        severity: 'warning',
        message: `The delivered audio measures ${input.integratedLufs.toFixed(1)} LUFS against a`
          + ` ${DELIVERY_LOUDNESS_TARGET_I} LUFS target (${off > 0 ? 'louder' : 'quieter'} by`
          + ` ${Math.abs(off).toFixed(1)} LU). Run ovs edit normalize-loudness on the final file.`,
      });
    }
  }
  if (input.expectsCaptions && spec.subtitleStreams === 0 && !input.sidecarSubtitleFound) {
    issues.push({
      code: 'DELIVERY_CAPTIONS_MISSING',
      severity: 'warning',
      message: 'Captions were asked for, and the delivered file has no subtitle stream and no sidecar subtitle file'
        + ' beside it. Burned-in captions cannot be detected from the container, so if they were burned in say so;'
        + ' otherwise the captions were not produced.',
    });
  }
  return issues;
}


export type DeliveredAudioMeasurement = {
  integratedLufs: number | null;
  digitalSilence: boolean | null;
  /** Stretches of at least DELIVERY_SILENT_STRETCH_SEC with no sound; null when not measured. */
  silences?: DeliverySpan[] | null;
};

/** A stretch this long with no sound, in a video that should have sound, is reported. */
export const DELIVERY_SILENT_STRETCH_SEC = 3;
/** Quieter than this is no sound to a viewer. */
const DELIVERY_SILENCE_FLOOR_DB = -50;

/** Overall astats covers all channels without downmixing (opposite-phase channels
 *  must not cancel). A missing stream, empty decode or incomplete summary is unknown,
 *  never silence. LUFS has a gate floor, so cannot prove zero samples. */
export function parseDeliveredAudioMeasurement(stderr: string, audioStreams: number): DeliveredAudioMeasurement {
  const summaries = new Map<string, { peak?: number; samples?: number }>();
  for (const match of stderr.matchAll(/^\[(Parsed_astats_\d+ @ [^\]]+)\]\s*(.*)$/gm)) {
    const [, id, line] = match;
    if (line === 'Overall') summaries.set(id, {});
    const summary = summaries.get(id);
    if (!summary) continue;
    if (line.startsWith('Peak level dB: ')) {
      const value = line.slice('Peak level dB: '.length).trim();
      summary.peak = value === '-inf' ? Number.NEGATIVE_INFINITY : Number(value);
    }
    if (line.startsWith('Number of samples: ')) summary.samples = Number(line.slice('Number of samples: '.length));
  }
  const complete = audioStreams > 0 && summaries.size === audioStreams && [...summaries.values()].every((summary) => (
    (Number.isFinite(summary.peak) || summary.peak === Number.NEGATIVE_INFINITY)
    && Number.isFinite(summary.samples) && summary.samples! > 0
  ));
  return {
    // Separate audio programs have no single integrated loudness. Do not report
    // whichever stream happened to print its summary last as the whole mix.
    integratedLufs: complete && audioStreams === 1 ? parseIntegratedLufs(stderr) : null,
    digitalSilence: complete ? [...summaries.values()].every((summary) => summary.peak === Number.NEGATIVE_INFINITY) : null,
  };
}


export function assessSilentStretches(silences: DeliverySpan[] | null | undefined, expectsAudio: boolean): DeliveryIssue[] {
  if (!expectsAudio || !silences) return [];
  const long = silences.filter((s) => s.endSec - s.startSec >= DELIVERY_SILENT_STRETCH_SEC - 0.05);
  if (!long.length) return [];
  const listed = long.slice(0, 4).map((s) => `${s.startSec.toFixed(1)}–${s.endSec.toFixed(1)}s (${(s.endSec - s.startSec).toFixed(1)}s)`).join(', ');
  return [{
    code: 'DELIVERY_SILENT_STRETCH',
    severity: 'warning',
    message: `This video should have sound but is silent at ${listed}${long.length > 4 ? ` and ${long.length - 4} more` : ''}.`
      + ' This is a low-level audio measurement; it does not establish missing narration or whether the silence is intended.',
  }];
}

/** Narration overlapping the clip's own speech by at least this much is reported. */
export const NARRATION_OVER_SPEECH_MIN_SEC = 0.5;

/** Where the clip's people speak: recognized words joined across gaps under 0.3 s. */
export function speechSpansFromWords(words: Array<{ startSec: number; endSec: number }>): DeliverySpan[] {
  const spans: DeliverySpan[] = [];
  for (const w of [...words].sort((a, b) => a.startSec - b.startSec)) {
    if (!(w.endSec > w.startSec)) continue;
    const last = spans[spans.length - 1];
    if (last && w.startSec - last.endSec < 0.3) last.endSec = Math.max(last.endSec, w.endSec);
    else spans.push({ startSec: w.startSec, endSec: w.endSec });
  }
  return spans;
}

/** Lines that speak while someone in the clip is speaking. Pure. */
export function assessNarrationOverSpeech(
  lines: Array<{ index: number; start: number; end: number }>,
  speech: DeliverySpan[],
): DeliveryIssue[] {
  const hits: string[] = [];
  for (const line of lines) {
    let overlap = 0;
    let from = Infinity;
    let to = -Infinity;
    for (const s of speech) {
      const a = Math.max(line.start, s.startSec);
      const b = Math.min(line.end, s.endSec);
      if (b <= a) continue;
      overlap += b - a;
      from = Math.min(from, a);
      to = Math.max(to, b);
    }
    if (overlap >= NARRATION_OVER_SPEECH_MIN_SEC) {
      hits.push(`line ${line.index} (${line.start.toFixed(1)}–${line.end.toFixed(1)}s) over speech at ${from.toFixed(1)}–${to.toFixed(1)}s`);
    }
  }
  if (!hits.length) return [];
  return [{
    code: 'DELIVERY_NARRATION_OVER_SPEECH',
    severity: 'warning',
    message: `Narration plays while someone in the clip is talking, so two voices speak at once: ${hits.slice(0, 4).join('; ')}${hits.length > 4 ? `; and ${hits.length - 4} more` : ''}.`
      + ' Move each line to where nobody speaks, shorten it, or cut that stretch of the clip silent, then mix again.',
  }];
}

export const BEAT_CUT_TOLERANCE_FRAMES = 1;
const BEAT_CUTS_NAMED = 4;

/** Cuts more than a frame from their nearest beat, counted as the music-cut beat check
 *  counts them. Pure. */
export function assessCutsOffBeat(cuts: readonly number[], beats: readonly number[], fps: number): DeliveryIssue[] {
  if (!cuts.length || !beats.length || !(fps > 0)) return [];
  const off = cuts.map((t) => {
    let beat = beats[0];
    for (const b of beats) if (Math.abs(b - t) < Math.abs(beat - t)) beat = b;
    const offsetSec = Math.round((t - beat) * 1000) / 1000;
    return { t, beat, frames: Math.round(offsetSec * fps) };
  }).filter((cut) => Math.abs(cut.frames) > BEAT_CUT_TOLERANCE_FRAMES);
  if (!off.length) return [];
  const named = off.slice(0, BEAT_CUTS_NAMED).map((cut) => `${cut.t.toFixed(2)}s (beat ${cut.beat.toFixed(2)}s)`).join(', ');
  return [{
    code: 'DELIVERY_CUTS_OFF_BEAT',
    severity: 'warning',
    message: `${off.length} of ${cuts.length} cuts are more than a frame off the beat: ${named}${off.length > BEAT_CUTS_NAMED ? `, and ${off.length - BEAT_CUTS_NAMED} more` : ''}.`
      + " Take each cut's frame from the beat list rather than adding up a beat length, then render and deliver again.",
  }];
}

/** What a picture and sound of different lengths should do next. A tutorial told only that "one
 *  of them stops early" (picture 30.6 s, sound 22.2 s) stopped to ask for narration to be
 *  recorded again. */
export function avDurationMismatchMessage(videoSec: number, audioSec: number): string {
  const lengths = `The picture runs ${videoSec.toFixed(2)}s and the sound ${audioSec.toFixed(2)}s`;
  const gap = Math.abs(videoSec - audioSec).toFixed(2);
  return audioSec < videoSec
    ? `${lengths}, so the last ${gap}s have no sound. Give that stretch sound, such as another narration line or music under the end, or cut the picture to ${audioSec.toFixed(2)}s, then deliver again.`
    : `${lengths}, so the sound runs ${gap}s past the picture. Cut the sound to ${videoSec.toFixed(2)}s or extend the picture, then deliver again.`;
}

/** A video cut to its music whose picture does not change: no cut at all, or one shot
 *  holding more than half of it. Cuts are the delivered file's own, in seconds. Pure. */
export function assessHeldShot(cuts: readonly number[], durationSec: number): DeliveryIssue[] {
  if (!(durationSec > 0)) return [];
  const length = durationSec.toFixed(2);
  if (!cuts.length) {
    return [{
      code: 'DELIVERY_NO_CUTS',
      severity: 'warning',
      message: `The delivered file has no cut: one picture runs the whole ${length}s. Check how long each shot was made to last, then render and deliver again.`,
    }];
  }
  const bounds = [0, ...cuts, durationSec];
  let held = { start: 0, end: 0 };
  for (let index = 1; index < bounds.length; index += 1) {
    const start = bounds[index - 1];
    const end = Math.max(start, bounds[index]);
    if (end - start > held.end - held.start) held = { start, end };
  }
  if (held.end - held.start <= durationSec / 2) return [];
  return [{
    code: 'DELIVERY_SHOT_HELD',
    severity: 'warning',
    message: `One shot runs from ${held.start.toFixed(2)}s to ${held.end.toFixed(2)}s, more than half of this ${length}s video, so the picture does not change on the beat there. Check how long each shot was made to last, then render and deliver again.`,
  }];
}

/** Share of the file that holds still, shots counted from scene changes, and each held stretch,
 *  from the delivery's freezedetect/showinfo pass. Pure. */
export function parseVisualHints(stderr: string, durationSec: number): {
  staticShare: number; shots: number; frozen: DeliverySpan[];
} {
  const starts = [...stderr.matchAll(/freeze_start:\s*(-?[\d.]+)/g)].map((match) => Number(match[1]));
  const ends = [...stderr.matchAll(/freeze_end:\s*(-?[\d.]+)/g)].map((match) => Number(match[1]));
  let staticSec = 0;
  const frozen: DeliverySpan[] = [];
  for (const [index, start] of starts.entries()) {
    const end = ends[index] ?? durationSec;
    staticSec += Math.max(0, end - start);
    if (end > start) frozen.push({ startSec: Math.max(0, start), endSec: end });
  }
  const shots = 1 + [...stderr.matchAll(/Parsed_showinfo.*\bn:\s*\d+/g)].length;
  return { staticShare: durationSec > 0 ? Math.min(1, staticSec / durationSec) : 0, shots, frozen };
}

/** A delivery stops when the still pictures in its scenes, outside the time footage plays, stand still for more
 *  than this share of it. Three of eleven users who got a video called it a set of pictures and
 *  cards, one at 82% still; counting pictures alone stops promotions and adverts and no explainer,
 *  whose diagrams are drawn in the page and held while the voice explains. */
export const HELD_STILLS_BLOCK = 0.5;
/** Scenes named in the message, most still first; the rest are counted. */
const HELD_STILLS_NAMED = 4;

/** Seconds of `from`..`to` that none of `spans` covers. */
function uncovered(from: number, to: number, spans: readonly DeliverySpan[]): number {
  let left = to - from;
  let reach = from;
  for (const span of [...spans].sort((a, b) => a.startSec - b.startSec)) {
    const start = Math.max(span.startSec, reach);
    const end = Math.min(span.endSec, to);
    if (end > start) { left -= end - start; reach = end; }
  }
  return Math.max(0, left);
}

/** Seconds each scene that places a still picture stands still, most first. The time footage
 *  plays is left out: a recording may hold still, as a screen does between steps. Only that
 *  time: on 2026-11-23 a promotion put one stock clip and four screenshots in a single scene, so
 *  a scene-wide exemption delivered it 69% still. A scene drawn in the page alone is left out
 *  too: an explainer's diagram holds while the voice explains it. Pure. */
export function heldStillScenes(
  frozen: readonly DeliverySpan[],
  scenes: ReadonlyArray<{ id: string; startSec: number; endSec: number; footage: readonly DeliverySpan[]; pictures: boolean }>,
): Array<{ id: string; seconds: number }> {
  return scenes
    .filter((scene) => scene.pictures)
    .map((scene) => ({
      id: scene.id,
      seconds: frozen.reduce((sum, span) => {
        const from = Math.max(span.startSec, scene.startSec);
        const to = Math.min(span.endSec, scene.endSec);
        return to > from ? sum + uncovered(from, to, scene.footage) : sum;
      }, 0),
    }))
    .filter((scene) => scene.seconds > 0.001)
    .sort((a, b) => b.seconds - a.seconds);
}

/** A held-stills stop as the canvas shows it when a user's own update meets it: the share of the
 *  video held and the scenes the message names. */
export type HeldStillsFinding = { percent: number; scenes: Array<{ id: string; seconds: number }> };

export function heldStillsFinding(share: number, scenes: ReadonlyArray<{ id: string; seconds: number }>): HeldStillsFinding {
  return { percent: Math.min(100, Math.round(share * 100)), scenes: scenes.slice(0, HELD_STILLS_NAMED).map((scene) => ({ ...scene })) };
}

function heldStillsWhere(scenes: ReadonlyArray<{ id: string; seconds: number }>): string {
  const named = scenes.slice(0, HELD_STILLS_NAMED).map((scene) => `"${scene.id}" (${scene.seconds.toFixed(1)} s)`);
  const more = scenes.length - named.length;
  return `${scenes.length === 1 ? 'scene' : 'scenes'} ${named.join(', ')}${more > 0 ? ` and ${more} more` : ''}`;
}

/** What a video built from held stills should do next. */
export function heldStillsMessage(share: number, scenes: ReadonlyArray<{ id: string; seconds: number }>): string {
  return `${Math.round(share * 100)}% of this video is a still frame held for a second or more, so it plays as a slideshow. It stands still in ${heldStillsWhere(scenes)}. Make those scenes move, then render and deliver again: where the shot need not be the user's own, such as a place or people using this kind of thing, put in footage the user supplies or a generated clip; where it is the user's own product or photo, move across it with a slow push in, pan or scroll; on a screen of a site or app, show the step the line names done on it with ./assets/vendor/screen-demo.js (timeline.md).`;
}

/** Said when a video stopped once for held stills comes back still held: it is delivered, so
 *  changes cannot go round and round. */
export function heldStillsDeliveredMessage(share: number, scenes: ReadonlyArray<{ id: string; seconds: number }>): string {
  return `${Math.round(share * 100)}% of this video still stands still after one round of changes, in ${heldStillsWhere(scenes)}. It is delivered as it is: say in your reply which scenes still hold still, so the user can ask for more movement.`;
}

/** Keeps the first and last of `count` items and spreads the rest evenly, up to `max`. Pure. */
export function spreadIndexes(count: number, max: number): number[] {
  if (count <= max) return Array.from({ length: count }, (_item, index) => index);
  if (max <= 1) return [0];
  return [...new Set(Array.from({ length: max }, (_item, index) => Math.round(index * (count - 1) / (max - 1))))];
}

/** Lines of a narrated delivery shown, each with its frame, before its last frame. */
const HEARD_FRAME_LINES = 16;
/** A line's frame is taken this long before it ends, so a cut right after it does not show instead. */
const LINE_END_LOOK_SEC = 0.1;
/** The last frame gets a cell of its own unless the last line's frame is this close to it. */
const LAST_FRAME_SEPARATE_SEC = 0.5;

/** Where to look at a delivery under its narration: one frame just before each line ends (up to
 *  sixteen lines), then its last frame. A tutorial ended on the export spinner while its last line
 *  said the file was saved, and evenly spaced frames showed the spinner beside nothing that claimed
 *  otherwise. Empty without lines. Pure. */
export function heardFrameSamples(
  durationSec: number,
  lines: ReadonlyArray<{ startSec: number; endSec: number; text: string }>,
): Array<{ atSec: number; label: string; heard?: string }> {
  if (!lines.length || !(durationSec > 0)) return [];
  const lastSec = Math.max(0, Math.round((durationSec - 0.1) * 1000) / 1000);
  const samples: Array<{ atSec: number; label: string; heard?: string }> = spreadIndexes(lines.length, HEARD_FRAME_LINES).map((index, order) => {
    const line = lines[index];
    const atSec = Math.round(Math.min(lastSec, Math.max(line.startSec, line.endSec - LINE_END_LOOK_SEC)) * 1000) / 1000;
    return { atSec, label: `#${order + 1} ${atSec.toFixed(1)}s`, heard: line.text };
  });
  if (lastSec - samples[samples.length - 1].atSec > LAST_FRAME_SEPARATE_SEC) {
    samples.push({ atSec: lastSec, label: `#${samples.length + 1} ${lastSec.toFixed(1)}s (last frame)` });
  }
  return samples;
}

export type DeliverySpan = { startSec: number; endSec: number };
