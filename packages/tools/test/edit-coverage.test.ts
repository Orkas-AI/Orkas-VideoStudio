import { describe, expect, it } from 'vitest';
import { assessVoiceoverCoverage, parseSilenceDetect } from '../src/edit/edit';

describe('edit coverage helpers', () => {
  it('parses leading and trailing silence into voiced timing', () => {
    const timing = parseSilenceDetect([
      '[silencedetect] silence_start: 0',
      '[silencedetect] silence_end: 0.8 | silence_duration: 0.8',
      '[silencedetect] silence_start: 3.2',
    ].join('\n'), 5);

    expect(timing.leadingSilenceSec).toBe(0.8);
    expect(timing.trailingSilenceSec).toBeCloseTo(1.8);
    expect(timing.voicedStartSec).toBe(0.8);
    expect(timing.voicedEndSec).toBe(3.2);
  });

  it('flags an uncovered tail and overshoot', () => {
    const under = assessVoiceoverCoverage({
      referenceDurationSec: 10,
      voicedStartSec: 0,
      voicedEndSec: 6.5,
      audioEndSec: 6.5,
    });
    expect(under.status).toBe('under');
    expect(under.trailingGapSec).toBe(3.5);

    const over = assessVoiceoverCoverage({
      referenceDurationSec: 10,
      voicedStartSec: 0,
      voicedEndSec: 10,
      audioEndSec: 11,
    });
    expect(over.status).toBe('over');
    expect(over.overshootSec).toBe(1);
  });
});

it('measures interior gaps and overlap instead of hiding them behind the outer span', () => {
  const base = { referenceDurationSec: 10, voicedStartSec: 0, voicedEndSec: 10, audioEndSec: 10 };
  const gapped = assessVoiceoverCoverage({ ...base, voicedSpans: [{ startSec: 0, endSec: 2 }, { startSec: 6, endSec: 10 }] });
  expect(gapped.status).toBe('gapped');
  expect(gapped.maxInteriorGapSec).toBe(4);
  expect(gapped.voicedRatio).toBe(0.6);
  const overlap = assessVoiceoverCoverage({ ...base, voicedSpans: [{ startSec: 0, endSec: 6 }, { startSec: 5, endSec: 10 }] });
  expect(overlap.status).toBe('overlapped');
  expect(overlap.overlapCount).toBe(1);
});
