import { describe, expect, it } from 'vitest';
import { estimateNarrationDuration, storyboardTiming } from '../src/narration/index.js';

describe('read-only storyboard timing', () => {
  it('keeps exact text identities and reports crowded shots as advisory findings', () => {
    const result = storyboardTiming({ duration_sec: 10, segments: [
      { id: 'opening', text: 'Hello world', start_sec: 0, target_sec: 0.5 },
      { id: 'silent', text: '', start_sec: 1, target_sec: 2 },
    ] });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.kind).toBe('estimate');
    expect(result.timing_review).toMatchObject({ advisory: true, status: 'has_findings', crowded_segments: [{ id: 'opening', over_by_sec: 0.3 }] });
    expect(result.segments[0].text_sha256).toBe('64ec88ca00b268e5ba1a35678a1b5316d212f4f366b2477232534a8aeca37f3c');
    expect(result.segments[1].estimated_sec).toBe(0);
    expect(result.planned_end_sec).toBe(3);
  });
  it('rejects overlapping, ambiguous, unbounded and duplicate segment inputs', () => {
    const shot = { id: 'a', text: 'A', start_sec: 0, target_sec: 2 };
    for (const input of [
      { duration_sec: 3, segments: [shot, { ...shot, id: 'b', start_sec: 1 }] },
      { duration_sec: 3, segments: [shot, { ...shot, start_sec: 2 }] },
      { duration_sec: 3, segments: [{ ...shot, end_sec: 2 }] },
      { duration_sec: Infinity, segments: [shot] },
      { duration_sec: 3, speed: 3, segments: [shot] },
    ]) expect(storyboardTiming(input).ok).toBe(false);
  });
  it('counts Thai and other alphabets and normalizes composed Latin text', () => {
    expect(estimateNarrationDuration('สวัสดี').breakdown.thaiCharacters).toBe(6);
    expect(estimateNarrationDuration('Привет мир').breakdown.otherWords).toBe(2);
    expect(estimateNarrationDuration('Tiếng Việt rất đẹp').unitsPerSec).toBe(4.9);
    expect(estimateNarrationDuration('café')).toEqual(estimateNarrationDuration('cafe\u0301'));
    expect(estimateNarrationDuration('你好，GPT 3.5!').breakdown).toMatchObject({ cjkCharacters: 2, numericDigits: 2, numericSeparators: 1, minorPauses: 1, majorPauses: 1 });
  });
});
