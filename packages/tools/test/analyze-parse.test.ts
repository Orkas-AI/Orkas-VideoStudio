import { describe, it, expect } from 'vitest';
import { parseSilence } from '../src/analyze/analyze';

describe('parseSilence', () => {
  it('pairs silence_start with the following silence_end', () => {
    const stderr = [
      '[silencedetect @ 0x1] silence_start: 1.23',
      '[silencedetect @ 0x1] silence_end: 2.5 | silence_duration: 1.27',
      'frame= 100 ...',
      '[silencedetect @ 0x1] silence_start: 4.0',
      '[silencedetect @ 0x1] silence_end: 5.75 | silence_duration: 1.75',
    ].join('\n');
    expect(parseSilence(stderr)).toEqual([
      { start: 1.23, end: 2.5 },
      { start: 4.0, end: 5.75 },
    ]);
  });

  it('ignores a dangling start with no matching end', () => {
    const stderr = '[silencedetect] silence_start: 3.0\nframe=...';
    expect(parseSilence(stderr)).toEqual([]);
  });

  it('returns an empty array when there is no silence', () => {
    expect(parseSilence('frame=1\nframe=2\n')).toEqual([]);
  });
});
