import { describe, it, expect } from 'vitest';
import {
  parseFfmpegProgressTimeSec,
  parseProgressClock,
  withFfmpegProgress,
  mapWithConcurrencyLimit,
  runFfmpeg,
} from '../src/progress';
import { validateTrimRequest, trimShortfallWarning } from '../src/edit/edit';

describe('ffmpeg -progress parsing', () => {
  it('reads out_time_us microseconds', () => {
    expect(parseFfmpegProgressTimeSec({ out_time_us: '2500000' })).toBe(2.5);
  });

  it('reads out_time_ms (ffmpeg emits microseconds under this key too)', () => {
    expect(parseFfmpegProgressTimeSec({ out_time_ms: '1000000' })).toBe(1);
  });

  it('falls back to the HH:MM:SS.ms clock when counters are absent', () => {
    expect(parseFfmpegProgressTimeSec({ out_time: '00:01:02.50' })).toBeCloseTo(62.5, 3);
  });

  it('returns null when nothing usable is present (incl. N/A)', () => {
    expect(parseFfmpegProgressTimeSec({})).toBeNull();
    expect(parseFfmpegProgressTimeSec({ out_time: 'N/A' })).toBeNull();
  });

  it('parseProgressClock accepts a well-formed clock and rejects a malformed one', () => {
    expect(parseProgressClock('00:00:10')).toBe(10);
    expect(parseProgressClock('1:02:03')).toBe(3723);
    expect(parseProgressClock('1:2:3')).toBeNull(); // mm/ss must be two digits
    expect(parseProgressClock('')).toBeNull();
    expect(parseProgressClock(undefined)).toBeNull();
  });
});

describe('withFfmpegProgress', () => {
  it('prepends `-progress pipe:2` when absent', () => {
    expect(withFfmpegProgress(['-i', 'in.mp4'])).toEqual(['-progress', 'pipe:2', '-i', 'in.mp4']);
  });

  it('is idempotent when -progress is already present', () => {
    const args = ['-progress', 'pipe:1', '-i', 'in.mp4'];
    expect(withFfmpegProgress(args)).toBe(args);
  });
});

describe('runFfmpeg progress completion', () => {
  it('reports 100 percent when ffmpeg declares progress=end', async () => {
    const events: Array<{ status: string; percent?: number }> = [];
    const script = [
      "process.stderr.write('out_time_us=5000000\\n');",
      "process.stderr.write('progress=end\\n');",
    ].join('');
    // `--` lets Node accept the ffmpeg marker as a script argument; including
    // it also keeps runFfmpeg from prepending the marker as a Node option.
    const result = await runFfmpeg(process.execPath, ['-e', script, '--', '-progress'], {
      op: 'test',
      phase: 'edit',
      durationSec: 10,
      onProgress: (event) => events.push(event),
    });

    expect(result.code).toBe(0);
    expect(events.at(-1)).toMatchObject({ status: 'completed', percent: 100 });
  });
});

describe('mapWithConcurrencyLimit', () => {
  it('preserves order/length and never exceeds the concurrency width', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const out = await mapWithConcurrencyLimit([1, 2, 3, 4, 5, 6, 7], 2, async (n) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14]);
    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(maxInFlight).toBeGreaterThan(0);
  });

  it('handles an empty list', async () => {
    expect(await mapWithConcurrencyLimit([], 4, async (x) => x)).toEqual([]);
  });
});

describe('validateTrimRequest', () => {
  it('accepts a usable window', () => {
    expect(validateTrimRequest(30, 2, 5)).toBeNull();
  });

  it('rejects a sub-0.1s duration', () => {
    expect(validateTrimRequest(30, 2, 0.05)).toMatch(/at least 0\.1s/);
  });

  it('rejects a start at/after the end of the input', () => {
    expect(validateTrimRequest(10, 10, 5)).toMatch(/too close to the end/);
    expect(validateTrimRequest(10, 9.95, 5)).toMatch(/too close to the end/);
  });

  it('skips the against-input check when the input duration is unknown', () => {
    expect(validateTrimRequest(0, 999, 5)).toBeNull();
    expect(validateTrimRequest(NaN, 999, 5)).toBeNull();
  });
});

// Six ~4s clips cut at their places in the music (start 3.005s and on): three came back short
// as a plain success and the joined montage was 12.5s instead of 14.4s.
describe('trimShortfallWarning', () => {
  const frame = 1 / 30;
  const warn = (over: Partial<Parameters<typeof trimShortfallWarning>[0]>) => trimShortfallWarning({
    inputSec: 4, startSec: 1.6, requestedSec: 2.4, cutSec: 2.4, toleranceSec: frame / 2, ...over,
  });

  it('stays quiet within half a frame of the request and speaks just past it', () => {
    expect(warn({ cutSec: 2.4 - frame / 3 })).toBeNull();
    expect(warn({ cutSec: 2.4 - frame })).toContain('not the 2.40s asked for');
  });

  it('points at the start when a later start is what cut the piece short', () => {
    const text = warn({ startSec: 3.005, cutSec: 0.967 });
    expect(text).toContain('from 3.005s this cut is 0.97s');
    expect(text).toContain('--start (start_sec) is a time inside the input');
    expect(text).toContain('start at or before 1.60s');
  });

  it('does not blame the start when the request fit and the picture still stopped', () => {
    const text = warn({ startSec: 1, cutSec: 1.5 });
    expect(text).toContain('stops or skips');
    expect(text).toContain('ovs edit probe');
    expect(text).not.toContain('start at or before');
  });

  it('says the input is too short when no start would give the length', () => {
    expect(warn({ startSec: 0, requestedSec: 5, cutSec: 4 })).toContain('The input is only 4.00s long');
  });

  it('still reports the shortfall when the input length is unknown', () => {
    expect(warn({ inputSec: 0, cutSec: 1 })).toContain('picture stops early: this cut is 1.00s');
  });
});
