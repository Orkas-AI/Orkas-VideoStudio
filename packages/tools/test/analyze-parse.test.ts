import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collapseOcrSegments, ocr, parseSilence, sampleTimecodes } from '../src/analyze/analyze';

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

describe('ocr helpers', () => {
  it('samples bounded timecodes across a video duration', () => {
    expect(sampleTimecodes(10, 2.5, 16)).toEqual([1.25, 3.75, 6.25, 8.75]);
    expect(sampleTimecodes(120, 1, 4)).toEqual([15, 45, 75, 105]);
  });

  it('collapses adjacent OCR frames with the same text into segments', () => {
    expect(collapseOcrSegments([
      { tSec: 1, text: 'Intro' },
      { tSec: 3, text: 'Intro' },
      { tSec: 5, text: 'Feature' },
      { tSec: 7, text: 'Feature' },
    ], 10)).toEqual([
      { startSec: 0, endSec: 5, text: 'Intro' },
      { startSec: 5, endSec: 10, text: 'Feature' },
    ]);
  });

  it('rejects unsupported OCR inputs before resolving the OCR runtime', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ovs-ocr-test-'));
    try {
      const input = join(dir, 'notes.txt');
      writeFileSync(input, 'not media', 'utf8');
      await expect(ocr({ input })).resolves.toMatchObject({ ok: false, errorCode: 'E_ANALYZE_ARG' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
