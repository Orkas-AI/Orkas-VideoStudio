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

  it('reports interior dead air that the reach-only ratio cannot see', () => {
    // Narration reaches 58s of a 60s clip (coverageRatio ≈ 0.97) but 30s of
    // the middle is silent — the exact half-silent-draft defect.
    const r = assessVoiceoverCoverage({
      referenceDurationSec: 60,
      voicedStartSec: 0,
      voicedEndSec: 58,
      audioEndSec: 58,
      voicedSpans: [
        { startSec: 0, endSec: 10 },
        { startSec: 40, endSec: 58 },
      ],
    });
    expect(r.status).toBe('gapped');
    expect(r.coverageRatio).toBeGreaterThan(0.9);
    expect(r.voicedRatio).toBeLessThan(0.5);
    expect(r.interiorGaps).toHaveLength(1);
    expect(r.maxInteriorGapSec).toBe(30);
    expect(r.warnings.join(' ')).toContain('dead air');
  });

  it('reports colliding line windows as double narration', () => {
    const r = assessVoiceoverCoverage({
      referenceDurationSec: 20,
      voicedStartSec: 0,
      voicedEndSec: 20,
      audioEndSec: 20,
      voicedSpans: [
        { startSec: 0, endSec: 12 },
        { startSec: 11, endSec: 20 },
      ],
    });
    expect(r.status).toBe('overlapped');
    expect(r.overlapCount).toBe(1);
    expect(r.maxOverlapSec).toBe(1);
    expect(r.warnings.join(' ')).toContain('two lines speak at once');
  });

  it('keeps head/tail assessment without spans (single-file callers)', () => {
    const r = assessVoiceoverCoverage({
      referenceDurationSec: 10,
      voicedStartSec: 0,
      voicedEndSec: 9.5,
      audioEndSec: 9.5,
    });
    expect(r.status).toBe('ok');
    expect(r.voicedRatio).toBeCloseTo(0.95, 2);
    expect(r.interiorGaps).toEqual([]);
    expect(r.overlapCount).toBe(0);
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
