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
