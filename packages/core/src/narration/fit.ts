export type NarrationUnit = 'words' | 'characters';

/** Pure narration estimates shared by host speech callers and packaged writing scripts.
 * No provider, account, media production or filesystem dependency.
 * Estimates retain the existing natural-pace algorithm; they are not measured audio. */
function round2(n: number): number { return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100; }
function clamp(n: number, lo: number, hi: number): number { return Math.min(hi, Math.max(lo, n)); }

const CJK_CHARACTER = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7a3\uf900-\ufaff]/g;
const KANA_OR_HANGUL = /[\u3040-\u30ff\uac00-\ud7a3]/;
const THAI_CHARACTER = /\p{Script=Thai}/gu;
const LATIN_WORD = /\p{Script=Latin}+(?:['’]\p{Script=Latin}+)*/gu;
const NOT_OTHER_ALPHABET = /[\p{Script=Latin}\p{Script=Thai}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Bopomofo}\p{Script=Common}]/gu;
const OTHER_ALPHABET_WORD = /\p{L}[\p{L}\p{M}]*/gu;
// Letters no other language this estimate serves relies on. A Vietnamese word
// is one spoken syllable, so counting it as a word triples the estimate.
const VIETNAMESE_LETTER = /[ăđơưĂĐƠƯ\u1ea0-\u1ef9]/;
const VIETNAMESE_MIN_TOKEN_SHARE = 0.25;

// Natural-pace reference rates (2026-11-03; Chinese 2026-11-15). For Chinese,
// 4 per second ran 22% long on ten voices; 5 fit them but left a measured line
// heavy with English and digits 11.5% short, so 4.5 keeps both within 10%.
// English keeps the rate this estimate has always used. Pauses are counted
// separately below.
const HAN_CHARS_PER_SEC = 4.5;
const KANA_HANGUL_CHARS_PER_SEC = 5.2;
const THAI_CHARS_PER_SEC = 11.4;
const LATIN_WORDS_PER_SEC = 2.5;
const VIETNAMESE_WORDS_PER_SEC = 4.9;
const OTHER_ALPHABET_WORDS_PER_SEC = 2;
const MAJOR_PAUSE_SEC = 0.28;
const MINOR_PAUSE_SEC = 0.12;
const LONG_PAUSE_SEC = 0.18;
/** Languages written in an alphabet other than Latin, read at the other-alphabet rate. */
const OTHER_ALPHABET_LANGUAGES = new Set(['ar', 'be', 'bg', 'bn', 'el', 'fa', 'gu', 'he', 'hi', 'hy', 'ka', 'kk', 'km', 'kn', 'lo', 'mk', 'ml', 'mn', 'mr', 'my', 'ne', 'pa', 'ru', 'si', 'sr', 'ta', 'te', 'uk', 'ur']);

/** Pick the right length unit for a narration script: characters for a CJK
 *  (Chinese/Japanese/Korean) or Thai line, whitespace words otherwise. Feeds
 *  assessNarrationFit so its budget ("trim to ≈N …") is a usable number rather
 *  than a meaningless word count on spaceless Chinese. Pure → unit-tested. */
export function measureNarrationUnits(text: string): { unit: 'words' | 'characters'; units: number } {
  const spaceless = (text.match(CJK_CHARACTER) || []).length + (text.match(THAI_CHARACTER) || []).length;
  const words = text.split(/\s+/).filter(Boolean).length;
  // A spaceless line counts as ~1 word — count characters whenever the script
  // is dominated by one; otherwise count words.
  return spaceless >= words ? { unit: 'characters', units: spaceless } : { unit: 'words', units: words };
}


export interface NarrationDurationEstimate {
  estimatedSec: number;
  unit: 'words' | 'characters';
  units: number;
  unitsPerSec: number;
  breakdown: {
    cjkCharacters: number;
    thaiCharacters: number;
    latinWords: number;
    otherWords: number;
    numericDigits: number;
    numericSeparators: number;
    majorPauses: number;
    minorPauses: number;
    longPauses: number;
    speechSec: number;
    pauseSec: number;
  };
}


/** Conservative natural-pace estimate used before a paid synthesis request.
 *  Mixed-language scripts must be additive: choosing CJK characters OR Latin
 *  words drops model names, acronyms, versions, years, and punctuation from the
 *  budget. The rates below intentionally approximate a natural explainer read;
 *  the post-synthesis media probe remains the source of truth. */
export function estimateNarrationDuration(text: string, speed = 1): NarrationDurationEstimate {
  const measured = measureNarrationUnits(text);
  const composed = text.normalize('NFC');
  const cjkCharacters = (text.match(CJK_CHARACTER) || []).length;
  const thaiCharacters = (text.match(THAI_CHARACTER) || []).length;
  const latinTokens: string[] = composed.match(LATIN_WORD) ?? [];
  const otherWords = (composed.replace(NOT_OTHER_ALPHABET, ' ').match(OTHER_ALPHABET_WORD) || []).length;
  const vietnameseTokens = latinTokens.filter((token) => VIETNAMESE_LETTER.test(token)).length;
  const isVietnamese = vietnameseTokens > 0 && vietnameseTokens / latinTokens.length >= VIETNAMESE_MIN_TOKEN_SHARE;
  const latinWordsPerSec = isVietnamese ? VIETNAMESE_WORDS_PER_SEC : LATIN_WORDS_PER_SEC;
  const cjkCharsPerSec = KANA_OR_HANGUL.test(text) ? KANA_HANGUL_CHARS_PER_SEC : HAN_CHARS_PER_SEC;
  const numericDigits = (text.match(/\d/g) || []).length;
  // A decimal/thousands separator is spoken in versions and many quantities,
  // but must not also be counted as a sentence pause.
  const numericSeparators = (text.match(/\d[.,](?=\d)/g) || []).length;
  const pauseText = text.replace(/(\d)[.,](?=\d)/g, '$1');
  const majorPauses = (pauseText.match(/[。！？!?；;.\n؟؛۔।]+/g) || []).length;
  const minorPauses = (pauseText.match(/[，,、：:،]+/g) || []).length;
  const longPauses = (pauseText.match(/[—–…]+/g) || []).length;

  const cjkSec = cjkCharacters / cjkCharsPerSec;
  const latinSec = latinTokens.reduce<number>((total, token) => {
    // Initialisms such as GPT/MCP are commonly read letter by letter and take
    // longer than an ordinary one-syllable English word.
    const tokenSec = /^[A-Z]{2,6}$/.test(token)
      ? Math.max(1 / LATIN_WORDS_PER_SEC, token.length * 0.18)
      : 1 / latinWordsPerSec;
    return total + tokenSec;
  }, 0);
  const numericSec = numericDigits * 0.18 + numericSeparators * 0.15;
  const speechSec = cjkSec + latinSec + numericSec
    + thaiCharacters / THAI_CHARS_PER_SEC
    + otherWords / OTHER_ALPHABET_WORDS_PER_SEC;
  const pauseSec = majorPauses * MAJOR_PAUSE_SEC + minorPauses * MINOR_PAUSE_SEC + longPauses * LONG_PAUSE_SEC;
  const safeSpeed = Number.isFinite(speed) && speed > 0 ? clamp(speed, 0.5, 2) : 1;
  const unitsPerSec = measured.unit === 'characters'
    ? (thaiCharacters > cjkCharacters ? THAI_CHARS_PER_SEC : cjkCharsPerSec)
    : (otherWords > latinTokens.length ? OTHER_ALPHABET_WORDS_PER_SEC : latinWordsPerSec);
  return {
    estimatedSec: round2((speechSec + pauseSec) / safeSpeed),
    unit: measured.unit,
    units: measured.units,
    unitsPerSec,
    breakdown: {
      cjkCharacters,
      thaiCharacters,
      latinWords: latinTokens.length,
      otherWords,
      numericDigits,
      numericSeparators,
      majorPauses,
      minorPauses,
      longPauses,
      speechSec: round2(speechSec),
      pauseSec: round2(pauseSec),
    },
  };
}

export interface EstimatedNarrationFit {
  status: 'fits' | 'over' | 'under';
  genericEstimatedSec: number;
  estimatedSec: number;
  targetSec: number;
  durationScale: number;
  unit: NarrationUnit;
  units: number;
  suggestedUnits: number;
  /** The estimate runs past its target by more than the estimator's own error (see the ratios below). */
  exceedsEstimateError: boolean;
}

export interface MeasuredNarrationFit {
  status: 'fits' | 'over' | 'under';
  measuredSec: number;
  targetSec: number;
  deltaSec: number;
  ratio: number;
  unitsPerSec: number;
  suggestedUnits: number;
  suggestedSpeed: number;
  unit: NarrationUnit;
  message: string;
  /** A short line has already been filled the maximum number of times. */
  fillLimitReached: boolean;
  /** How the line's scene should take this measured audio. */
  timingAction: string;
}

/** How far an estimate not yet scaled to a measured voice may run past its target: the
 *  estimator's own error. A short span between two lines keeps this proportional; a fixed
 *  floor of seconds would let a line cover them. */
export const NARRATION_ESTIMATE_OVER_RATIO = 1.2;
/** The same allowance once the estimate is scaled to a voice's measured pace. */
export const NARRATION_CALIBRATED_OVER_RATIO = 1.05;
/** How many times a short line is generated again to fill its scene: the first take plus at
 *  most two fills, as other VideoStudio repairs are bounded. The capped message says "twice";
 *  change both together. */
export const NARRATION_FILL_RETRY_LIMIT = 2;

/** How fast a language's narration runs at speed 1, from the rates estimateNarrationDuration
 *  uses, so a line can be written to its scene before synthesis. Null for a value that is not
 *  a language tag. */
export function narrationPaceNote(language: string): string | null {
  const tag = language.trim();
  const primary = tag.toLowerCase().split(/[-_]/)[0];
  if (!primary || !/^[a-z]{2,3}$/.test(primary)) return null;
  const [perSec, unit] = primary === 'zh' ? [HAN_CHARS_PER_SEC, 'characters']
    : primary === 'ja' || primary === 'ko' ? [KANA_HANGUL_CHARS_PER_SEC, 'characters']
    : primary === 'th' ? [THAI_CHARS_PER_SEC, 'characters']
    : primary === 'vi' ? [VIETNAMESE_WORDS_PER_SEC, 'words']
    : OTHER_ALPHABET_LANGUAGES.has(primary) ? [OTHER_ALPHABET_WORDS_PER_SEC, 'words']
    : [LATIN_WORDS_PER_SEC, 'words'];
  const fiveSecond = Math.floor((5 - MAJOR_PAUSE_SEC - MINOR_PAUSE_SEC) * perSec);
  return `At speed 1, ${tag} narration runs about ${perSec} ${unit} a second, plus ${MAJOR_PAUSE_SEC} s at each full stop and ${MINOR_PAUSE_SEC} s at each comma, so a 5 s scene holds about ${fiveSecond} ${unit}. Write each line to fit its scene before ovs speak.`;
}

/** Reuse an observed voice's pace when checking a revised script. */
export function narrationDurationCalibrationScale(input: {
  genericEstimatedSec: number;
  measuredSec: number;
}): number | null {
  if (!(input.genericEstimatedSec > 0) || !(input.measuredSec > 0)) return null;
  return Math.round(clamp(input.measuredSec / input.genericEstimatedSec, 0.5, 2) * 10_000) / 10_000;
}

/** Apply the production delivery band before synthesis: up to 10% early, at most 150ms late. */
export function assessEstimatedNarrationFit(input: {
  estimate: NarrationDurationEstimate;
  targetSec: number;
  durationScale?: number;
}): EstimatedNarrationFit | null {
  if (!(input.targetSec > 0) || !(input.estimate.estimatedSec > 0)) return null;
  const calibrated = Number.isFinite(input.durationScale) && (input.durationScale || 0) > 0;
  const durationScale = calibrated ? clamp(input.durationScale!, 0.5, 2) : 1;
  const rawEstimatedSec = input.estimate.estimatedSec * durationScale;
  const errorRatio = calibrated ? NARRATION_CALIBRATED_OVER_RATIO : NARRATION_ESTIMATE_OVER_RATIO;
  return {
    status: rawEstimatedSec > input.targetSec + 0.15
      ? 'over'
      : rawEstimatedSec < input.targetSec * 0.9
        ? 'under'
        : 'fits',
    genericEstimatedSec: input.estimate.estimatedSec,
    estimatedSec: round2(rawEstimatedSec),
    targetSec: round2(input.targetSec),
    durationScale: Math.round(durationScale * 10_000) / 10_000,
    unit: input.estimate.unit,
    units: input.estimate.units,
    suggestedUnits: Math.max(1, Math.round(input.estimate.units * input.targetSec / rawEstimatedSec)),
    exceedsEstimateError: rawEstimatedSec > input.targetSec * errorRatio,
  };
}

export const MAX_NARRATION_PREFLIGHT_LINES = 50;
export const MAX_NARRATION_PREFLIGHT_CHARS = 4000;

/** Estimate only the remaining lines; callers may supply calibration from one saved take. */
export function preflightNarrationLines(value: unknown, opts: { speed?: number; durationScale?: number } = {}) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_NARRATION_PREFLIGHT_LINES) {
    throw new Error('Provide 1–50 timed narration lines.');
  }
  const lines = value.flatMap((line, index) => {
    const text = typeof line?.text === 'string' ? line.text.trim() : '';
    const targetSec = line?.target_duration;
    if (!text || text.length > MAX_NARRATION_PREFLIGHT_CHARS || !Number.isFinite(targetSec) || !(targetSec > 0)) {
      throw new Error('Each timed line needs nonempty text of at most 4000 characters and a positive target_duration.');
    }
    const fit = assessEstimatedNarrationFit({ estimate: estimateNarrationDuration(text, opts.speed), targetSec, durationScale: opts.durationScale });
    return fit?.exceedsEstimateError ? [{ index: index + 1, ...fit }] : [];
  });
  return { ok: lines.length === 0, calibrated: Number.isFinite(opts.durationScale) && opts.durationScale! > 0, lines, synthesis_sent: false };
}

/** Compare produced narration with the immutable target using observed speaking pace.
 *  `fills` counts how many times this line was already generated again to fill its scene. */
export function assessMeasuredNarrationFit(input: {
  measuredSec: number;
  targetSec: number;
  units: number;
  unit?: NarrationUnit;
  fills?: number;
}): MeasuredNarrationFit | null {
  if (!(input.measuredSec > 0) || !(input.targetSec > 0)) return null;
  const unit = input.unit ?? 'words';
  const ratio = input.measuredSec / input.targetSec;
  const unitsPerSec = input.units > 0 ? input.units / input.measuredSec : 0;
  const suggestedUnits = unitsPerSec > 0 ? Math.round(unitsPerSec * input.targetSec) : 0;
  const suggestedSpeed = round2(clamp(ratio, 0.5, 2));
  const deltaSec = round2(input.measuredSec - input.targetSec);
  const fillLimitReached = (input.fills ?? 0) >= NARRATION_FILL_RETRY_LIMIT;
  let status: MeasuredNarrationFit['status'] = 'fits';
  let message = `Narration is ${round2(input.measuredSec)}s for a ${round2(input.targetSec)}s target — fits.`;
  if (input.measuredSec > input.targetSec + 0.15) {
    status = 'over';
    const hint = suggestedUnits > 0 ? `trim the script to about ${suggestedUnits} ${unit}` : 'shorten the script';
    message = `Narration is ${round2(input.measuredSec)}s, ${deltaSec}s over the ${round2(input.targetSec)}s target — ${hint} rather than forcing an unnatural speed.`;
  } else if (input.measuredSec < input.targetSec * 0.9) {
    status = 'under';
    const add = Math.max(0, suggestedUnits - input.units);
    const hint = add > 0 ? `add about ${add} ${unit}` : 'lengthen the script';
    const gap = `Narration is ${round2(input.targetSec - input.measuredSec)}s short of the ${round2(input.targetSec)}s target`;
    message = fillLimitReached
      ? `${gap}. This line has already been generated again twice, the limit: keep this audio and let the scene finish early.`
      : `${gap} — to fill it, ${hint} and generate the longer line under a new file name, then point its scene at it.`;
  }
  // A short line is filled by a longer one, not by cutting its scene, when the user asked for a
  // length; otherwise the scene ends with its line instead of in silence.
  const timingAction = status !== 'under'
    ? 'This is the audio\'s real length. Its scene must be at least that long: lengthen the scene or shorten the line. When the user did not ask for this video\'s length, make the scene this audio plus about half a second. Reuse this audio; do not regenerate it just to change the timing.'
    : fillLimitReached
      ? 'This is the audio\'s real length. Keep this audio and the scene\'s planned length; do not generate this line again.'
      : 'This is the audio\'s real length. When the user asked for this video\'s length, keep the scene at its planned length: replace this line with the longer one rather than cutting the scene to this audio. Otherwise make the scene this audio plus about half a second and keep this audio.';
  return {
    status,
    measuredSec: round2(input.measuredSec),
    targetSec: round2(input.targetSec),
    deltaSec,
    ratio: round2(ratio),
    unitsPerSec: round2(unitsPerSec),
    suggestedUnits,
    suggestedSpeed,
    unit,
    message,
    fillLimitReached: status === 'under' && fillLimitReached,
    timingAction,
  };
}
