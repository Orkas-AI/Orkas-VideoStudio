import { describe, expect, it } from 'vitest';
import {
  assessEstimatedNarrationFit,
  assessMeasuredNarrationFit,
  estimateNarrationDuration,
  measureNarrationUnits,
  narrationDurationCalibrationScale,
  NARRATION_FILL_RETRY_LIMIT,
  type NarrationDurationEstimate,
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

describe('estimated narration against the estimator\'s own error', () => {
  const estimate = (estimatedSec: number): NarrationDurationEstimate => ({ ...estimateNarrationDuration('一二三四五'), estimatedSec });
  const exceeds = (estimatedSec: number, targetSec: number, durationScale?: number) =>
    assessEstimatedNarrationFit({ estimate: estimate(estimatedSec), targetSec, ...(durationScale === undefined ? {} : { durationScale }) })?.exceedsEstimateError;

  it('allows a first line estimated up to a fifth over its target, and flags one past that', () => {
    expect([exceeds(11.5, 10), exceeds(12, 10), exceeds(12.1, 10)]).toEqual([false, false, true]);
    // The delivery band itself is unchanged: 12 s for a 10 s target is still `over`.
    expect(assessEstimatedNarrationFit({ estimate: estimate(12), targetSec: 10 })).toMatchObject({ status: 'over', exceedsEstimateError: false });
  });

  it('judges a later line by the pace this voice was measured at', () => {
    // A voice measured faster than estimated lets a longer retry through.
    const fast = narrationDurationCalibrationScale({ genericEstimatedSec: 10, measuredSec: 6.5 })!;
    expect(exceeds(15, 10, fast)).toBe(false);
    // A voice measured slower than estimated flags a line the generic estimate would allow.
    const slow = narrationDurationCalibrationScale({ genericEstimatedSec: 10, measuredSec: 13 })!;
    expect(exceeds(10, 10)).toBe(false);
    expect(exceeds(10, 10, slow)).toBe(true);
  });

  it('weighs a voice\'s lines by length, so a short line\'s silence does not swing its pace', () => {
    // 10 s estimated read in 6 s, then 1 s estimated read in 1.9 s: the voice's pace is 7.9 / 11.
    const scale = narrationDurationCalibrationScale({ genericEstimatedSec: 10 + 1, measuredSec: 6 + 1.9 })!;
    expect(exceeds(13, 10, scale)).toBe(false);
    // Without a measured line the generic allowance applies.
    expect(exceeds(13, 10)).toBe(true);
  });
});

describe('measured narration timing actions', () => {
  it('asks for a longer line under a new file name when a narration is short, not an early finish', () => {
    expect(assessMeasuredNarrationFit({ measuredSec: 16.25, targetSec: 23.9, units: 41 })).toMatchObject({
      status: 'under',
      fillLimitReached: false,
      message: 'Narration is 7.65s short of the 23.9s target — to fill it, add about 19 words and generate the longer line under a new file name, then point its scene at it.',
    });
    // 40 characters read in 9.2s fill a 15s clip with about 25 more.
    expect(assessMeasuredNarrationFit({ measuredSec: 9.2, targetSec: 15, units: 40, unit: 'characters' })!.message)
      .toBe('Narration is 5.8s short of the 15s target — to fill it, add about 25 characters and generate the longer line under a new file name, then point its scene at it.');
  });

  it('stops asking for another take once a short line has been filled twice, and leaves long and fitting lines alone', () => {
    expect(NARRATION_FILL_RETRY_LIMIT).toBe(2);
    expect(assessMeasuredNarrationFit({ measuredSec: 9.2, targetSec: 15, units: 40, unit: 'characters', fills: 1 })!.fillLimitReached).toBe(false);
    expect(assessMeasuredNarrationFit({ measuredSec: 9.2, targetSec: 15, units: 40, unit: 'characters', fills: 2 })).toMatchObject({
      fillLimitReached: true,
      message: 'Narration is 5.8s short of the 15s target. This line has already been generated again twice, the limit: keep this audio and let the scene finish early.',
    });
    for (const measuredSec of [30, 23.9]) {
      expect(assessMeasuredNarrationFit({ measuredSec, targetSec: 23.9, units: 60, fills: 2 })!.message)
        .toBe(assessMeasuredNarrationFit({ measuredSec, targetSec: 23.9, units: 60 })!.message);
    }
  });

  it('keeps a short line\'s scene when the user asked for a length, else ends each scene with its line', () => {
    expect(assessMeasuredNarrationFit({ measuredSec: 1.25, targetSec: 6, units: 3 })!.timingAction).toBe(
      'This is the audio\'s real length. When the user asked for this video\'s length, keep the scene at its planned length: '
      + 'replace this line with the longer one rather than cutting the scene to this audio. Otherwise make the scene this audio plus about half a second and keep this audio.',
    );
    const longOrFitting = 'This is the audio\'s real length. Its scene must be at least that long: '
      + 'lengthen the scene or shorten the line. When the user did not ask for this video\'s length, make the scene this audio plus about half a second. '
      + 'Reuse this audio; do not regenerate it just to change the timing.';
    expect(assessMeasuredNarrationFit({ measuredSec: 8.4, targetSec: 6, units: 20 })!.timingAction).toBe(longOrFitting);
    expect(assessMeasuredNarrationFit({ measuredSec: 6, targetSec: 6, units: 15 })!.timingAction).toBe(longOrFitting);
    expect(assessMeasuredNarrationFit({ measuredSec: 1.25, targetSec: 6, units: 3, fills: 2 })!.timingAction).toBe(
      'This is the audio\'s real length. Keep this audio and the scene\'s planned length; do not generate this line again.',
    );
  });
});
