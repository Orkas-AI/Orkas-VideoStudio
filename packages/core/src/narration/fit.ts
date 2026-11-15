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

// Natural-pace reference rates (2026-11-03); Chinese and
// English keep the rates this estimate has always used.
const HAN_CHARS_PER_SEC = 4;
const KANA_HANGUL_CHARS_PER_SEC = 5.2;
const THAI_CHARS_PER_SEC = 11.4;
const LATIN_WORDS_PER_SEC = 2.5;
const VIETNAMESE_WORDS_PER_SEC = 4.9;
const OTHER_ALPHABET_WORDS_PER_SEC = 2;

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
  const pauseSec = majorPauses * 0.28 + minorPauses * 0.12 + longPauses * 0.18;
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
  const durationScale = Number.isFinite(input.durationScale) && (input.durationScale || 0) > 0
    ? clamp(input.durationScale!, 0.5, 2)
    : 1;
  const rawEstimatedSec = input.estimate.estimatedSec * durationScale;
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
  };
}

/** Compare produced narration with the immutable target using observed speaking pace. */
export function assessMeasuredNarrationFit(input: {
  measuredSec: number;
  targetSec: number;
  units: number;
  unit?: NarrationUnit;
}): MeasuredNarrationFit | null {
  if (!(input.measuredSec > 0) || !(input.targetSec > 0)) return null;
  const unit = input.unit ?? 'words';
  const ratio = input.measuredSec / input.targetSec;
  const unitsPerSec = input.units > 0 ? input.units / input.measuredSec : 0;
  const suggestedUnits = unitsPerSec > 0 ? Math.round(unitsPerSec * input.targetSec) : 0;
  const suggestedSpeed = round2(clamp(ratio, 0.5, 2));
  const deltaSec = round2(input.measuredSec - input.targetSec);
  let status: MeasuredNarrationFit['status'] = 'fits';
  let message = `Narration is ${round2(input.measuredSec)}s for a ${round2(input.targetSec)}s target — fits.`;
  if (input.measuredSec > input.targetSec + 0.15) {
    status = 'over';
    const hint = suggestedUnits > 0 ? `trim the script to about ${suggestedUnits} ${unit}` : 'shorten the script';
    message = `Narration is ${round2(input.measuredSec)}s, ${deltaSec}s over the ${round2(input.targetSec)}s target — ${hint} rather than forcing an unnatural speed.`;
  } else if (input.measuredSec < input.targetSec * 0.9) {
    status = 'under';
    const add = Math.max(0, suggestedUnits - input.units);
    const hint = add > 0 ? `add about ${add} ${unit}` : 'lengthen the script or approve the silent tail';
    message = `Narration is ${round2(input.targetSec - input.measuredSec)}s short of the ${round2(input.targetSec)}s target — ${hint}.`;
  }
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
  };
}
