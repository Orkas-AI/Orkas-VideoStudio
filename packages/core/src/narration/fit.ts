export type NarrationUnit = 'words' | 'characters';

export interface NarrationDurationEstimate {
  estimatedSec: number;
  unit: NarrationUnit;
  units: number;
  unitsPerSec: number;
  breakdown: {
    cjkCharacters: number;
    latinWords: number;
    numericDigits: number;
    numericSeparators: number;
    majorPauses: number;
    minorPauses: number;
    longPauses: number;
    speechSec: number;
    pauseSec: number;
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

const round2 = (value: number): number => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));

/** Choose a useful script-length unit for Latin and spaceless CJK narration. */
export function measureNarrationUnits(text: string): { unit: NarrationUnit; units: number } {
  const cjk = (text.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7a3\uf900-\ufaff]/g) || []).length;
  const words = text.split(/\s+/).filter(Boolean).length;
  return cjk >= words ? { unit: 'characters', units: cjk } : { unit: 'words', units: words };
}

/** Conservative, additive natural-pace estimate used before a paid TTS call. */
export function estimateNarrationDuration(text: string, speed = 1): NarrationDurationEstimate {
  const measured = measureNarrationUnits(text);
  const cjkCharacters = (text.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7a3\uf900-\ufaff]/g) || []).length;
  const latinTokens: string[] = text.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g) ?? [];
  const numericDigits = (text.match(/\d/g) || []).length;
  const numericSeparators = (text.match(/\d[.,](?=\d)/g) || []).length;
  const pauseText = text.replace(/(\d)[.,](?=\d)/g, '$1');
  const majorPauses = (pauseText.match(/[。！？!?；;.\n]+/g) || []).length;
  const minorPauses = (pauseText.match(/[，,、：:]+/g) || []).length;
  const longPauses = (pauseText.match(/[—–…]+/g) || []).length;

  const cjkSec = cjkCharacters / 4;
  const latinSec = latinTokens.reduce<number>((total, token) => {
    const tokenSec = /^[A-Z]{2,6}$/.test(token) ? Math.max(1 / 2.5, token.length * 0.18) : 1 / 2.5;
    return total + tokenSec;
  }, 0);
  const numericSec = numericDigits * 0.18 + numericSeparators * 0.15;
  const speechSec = cjkSec + latinSec + numericSec;
  const pauseSec = majorPauses * 0.28 + minorPauses * 0.12 + longPauses * 0.18;
  const safeSpeed = Number.isFinite(speed) && speed > 0 ? clamp(speed, 0.5, 2) : 1;
  const unitsPerSec = measured.unit === 'characters' ? 4 : 2.5;
  return {
    estimatedSec: round2((speechSec + pauseSec) / safeSpeed),
    unit: measured.unit,
    units: measured.units,
    unitsPerSec,
    breakdown: {
      cjkCharacters,
      latinWords: latinTokens.length,
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
