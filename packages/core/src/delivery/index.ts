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
  subtitleStreams: number;
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
    | 'DELIVERY_ASPECT_MISMATCH'
    | 'DELIVERY_NO_AUDIO'
    | 'DELIVERY_AUDIO_SILENT'
    | 'DELIVERY_AUDIO_UNVERIFIABLE'
    | 'DELIVERY_SILENT_STRETCH'
    | 'DELIVERY_NARRATION_OVER_SPEECH'
    | 'DELIVERY_CUTS_OFF_BEAT'
    | 'DELIVERY_LOUDNESS_OFF_TARGET'
    | 'DELIVERY_CAPTIONS_MISSING'
    | 'DELIVERY_NARRATION_UNVERIFIABLE';
  severity: 'error' | 'warning';
  message: string;
};

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
  expectedDurationSec: number | null;
  /** Where the expected length came from: the video's timeline, or the length the Agent passed
   *  for a file it made itself. Only the first has narration and captions timed against it. */
  durationSource?: 'timeline' | 'requested';
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
  if (typeof spec.durationSec === 'number' && typeof input.expectedDurationSec === 'number'
    && input.expectedDurationSec > 0) {
    const drift = Math.abs(spec.durationSec - input.expectedDurationSec);
    if (drift > DELIVERY_DURATION_TOLERANCE_SEC) {
      // A file the Agent cut itself was once slowed down to match a rounded "about 15 s"
      // (2026-11-14 montage run), changing the music it was cut to.
      issues.push({
        code: 'DELIVERY_DURATION_DRIFT',
        severity: 'error',
        message: input.durationSource === 'requested'
          ? `The delivered video is ${spec.durationSec.toFixed(2)}s but expect_duration_sec says`
            + ` ${input.expectedDurationSec}s (off by ${drift.toFixed(2)}s). If you made it this length on purpose,`
            + ' deliver it again with its real length as expect_duration_sec. Do not speed up, slow down or pad'
            + ' a finished cut to reach a number: that changes its music and the timing it was cut to.'
          : `The delivered video is ${spec.durationSec.toFixed(2)}s but it should be`
            + ` ${input.expectedDurationSec}s (off by ${drift.toFixed(2)}s). Narration and captions are timed against`
            + ' that length, so the two have to agree before delivery.',
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
  if (spec.hasAudio && typeof spec.audioDurationSec === 'number' && typeof spec.videoDurationSec === 'number' && Math.abs(spec.audioDurationSec - spec.videoDurationSec) > .5) issues.push({ code: 'DELIVERY_AV_DURATION_MISMATCH', severity: 'error', message: `The picture runs ${spec.videoDurationSec.toFixed(2)}s and the sound ${spec.audioDurationSec.toFixed(2)}s, so one stops early.` });
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


export type DeliverySpan = { startSec: number; endSec: number };
