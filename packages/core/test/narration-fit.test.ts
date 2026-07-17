import { describe, expect, it } from 'vitest';
import {
  assessEstimatedNarrationFit,
  assessMeasuredNarrationFit,
  estimateNarrationDuration,
  measureNarrationUnits,
  narrationDurationCalibrationScale,
} from '../src/narration/fit.js';

describe('narration duration preflight', () => {
  it('estimates Latin narration at a conservative natural pace', () => {
    const estimate = estimateNarrationDuration(Array.from({ length: 150 }, () => 'word').join(' '));
    expect(estimate).toMatchObject({ unit: 'words', units: 150, unitsPerSec: 2.5, estimatedSec: 60 });
  });

  it('adds CJK, Latin names, digits, and pauses instead of dropping mixed-language content', () => {
    const estimate = estimateNarrationDuration('2017年，Transformer 与 GPT-4 改变了 AI。下一步，是 Agent。');
    expect(estimate.breakdown.cjkCharacters).toBeGreaterThan(5);
    expect(estimate.breakdown.latinWords).toBeGreaterThan(2);
    expect(estimate.breakdown.numericDigits).toBeGreaterThan(4);
    expect(estimate.estimatedSec).toBeGreaterThan(3);
  });

  it('uses characters for spaceless CJK and words for Latin scripts', () => {
    expect(measureNarrationUnits('想要一支会配合的小队吗')).toEqual({ unit: 'characters', units: 11 });
    expect(measureNarrationUnits('want a team that actually cooperates')).toEqual({ unit: 'words', units: 6 });
  });

  it('applies the same delivery band before and after synthesis', () => {
    const estimate = estimateNarrationDuration(Array.from({ length: 150 }, () => 'word').join(' '));
    expect(assessEstimatedNarrationFit({ estimate, targetSec: 60 })?.status).toBe('fits');
    expect(assessEstimatedNarrationFit({ estimate: { ...estimate, estimatedSec: 60.16 }, targetSec: 60 })?.status).toBe('over');
    expect(assessEstimatedNarrationFit({ estimate: { ...estimate, estimatedSec: 53.99 }, targetSec: 60 })?.status).toBe('under');

    expect(assessMeasuredNarrationFit({ measuredSec: 60.16, targetSec: 60, units: 150 })?.status).toBe('over');
    expect(assessMeasuredNarrationFit({ measuredSec: 53.99, targetSec: 60, units: 135 })?.status).toBe('under');
  });

  it('calibrates a revised script against the observed voice pace', () => {
    const durationScale = narrationDurationCalibrationScale({ genericEstimatedSec: 56.96, measuredSec: 68.568 });
    expect(durationScale).toBeCloseTo(1.2038, 4);
    const revised = assessEstimatedNarrationFit({
      estimate: {
        estimatedSec: 48.06,
        unit: 'words',
        units: 98,
        unitsPerSec: 2.5,
        breakdown: {
          cjkCharacters: 0,
          latinWords: 98,
          numericDigits: 0,
          numericSeparators: 0,
          majorPauses: 0,
          minorPauses: 0,
          longPauses: 0,
          speechSec: 48.06,
          pauseSec: 0,
        },
      },
      targetSec: 60,
      durationScale: durationScale!,
    });
    expect(revised).toMatchObject({ status: 'fits', estimatedSec: 57.85, suggestedUnits: 102 });
  });
});
