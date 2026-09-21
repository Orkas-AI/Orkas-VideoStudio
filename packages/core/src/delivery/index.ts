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
  subtitleStreams: number;
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
    | 'DELIVERY_NARRATION_OVERLAP'
    | 'DELIVERY_NARRATION_TRUNCATED'
    | 'DELIVERY_DURATION_DRIFT'
    | 'DELIVERY_ASPECT_MISMATCH'
    | 'DELIVERY_NO_AUDIO'
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
  const starts = [...stderr.matchAll(/silence_start:\s*(-?[\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...stderr.matchAll(/silence_end:\s*(-?[\d.]+)/g)].map((m) => Number(m[1]));
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
