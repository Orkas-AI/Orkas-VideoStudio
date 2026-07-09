import { describe, it, expect } from 'vitest';
import {
  buildTrimArgs,
  buildConcatArgs,
  buildBurnsubsArgs,
  buildNormalizeLoudnessArgs,
  buildMixFilter,
  finiteNum,
  secArg,
} from '../src/edit/args';

describe('edit arg builders', () => {
  it('builds trim args with output-side seek and re-encode', () => {
    const a = buildTrimArgs({ input: 'in.mp4', start_sec: 2, duration_sec: 5, output: 'out.mp4' });
    expect(a).toEqual(expect.arrayContaining(['-i', 'in.mp4', '-ss', '2.000', '-t', '5.000', '-c:v', 'libx264', 'out.mp4']));
    // -ss must come after -i for frame-accurate seeking
    expect(a.indexOf('-ss')).toBeGreaterThan(a.indexOf('-i'));
  });

  it('derives trim duration from end_sec', () => {
    const a = buildTrimArgs({ input: 'in.mp4', start_sec: 2, end_sec: 7, output: 'o.mp4' });
    expect(a[a.indexOf('-t') + 1]).toBe('5.000');
  });

  it('rejects a trim with no usable duration and with a bad start', () => {
    expect(() => buildTrimArgs({ input: 'i', start_sec: 2, output: 'o' })).toThrow();
    expect(() => buildTrimArgs({ input: 'i', start_sec: 2, end_sec: 1, output: 'o' })).toThrow();
    expect(() => buildTrimArgs({ input: 'i', start_sec: NaN, duration_sec: 1, output: 'o' })).toThrow();
  });

  it('builds concat demuxer args from a list file', () => {
    const a = buildConcatArgs('/tmp/list.txt', 'out.mp4');
    expect(a).toEqual(expect.arrayContaining(['-f', 'concat', '-safe', '0', '-i', '/tmp/list.txt', 'out.mp4']));
  });

  it('escapes the subtitles path in burnsubs', () => {
    const a = buildBurnsubsArgs('in.mp4', '/a/b:c.srt', 'out.mp4');
    const vf = a[a.indexOf('-vf') + 1] ?? '';
    expect(vf).toContain("subtitles='");
    expect(vf).toContain('\\:'); // colon escaped for the filter
  });

  it('builds normalize-loudness args that copy video and re-encode audio', () => {
    const a = buildNormalizeLoudnessArgs('in.mp4', 'out.mp4');
    expect(a).toEqual(expect.arrayContaining(['-map', '0:v?', '-map', '0:a:0', '-c:v', 'copy', '-c:a', 'aac', 'out.mp4']));
    expect(a.join(' ')).toContain('loudnorm=I=-14');
    expect(a.join(' ')).toContain('aresample=48000');
  });

  it('builds a mix filter that delays, mixes, and normalizes loudness', () => {
    const { filter, maps } = buildMixFilter({
      base: 'base.mp4',
      baseHasAudio: false,
      segments: [{ path: 'a.mp3', start_sec: 1, volume: 0.8 }],
      on_existing_audio: 'mix',
      output: 'out.mp4',
    });
    expect(filter).toContain('adelay=1000');
    expect(filter).toContain('volume=0.8');
    expect(filter).toContain('amix=inputs=1');
    expect(filter).toContain('loudnorm=I=-14');
    expect(maps).toEqual(['-map', '0:v', '-map', '[outa]']);
  });

  it('includes base audio in the mix only when policy is mix AND base has audio', () => {
    const withBase = buildMixFilter({
      base: 'b.mp4',
      baseHasAudio: true,
      segments: [{ path: 'a.mp3', start_sec: 0 }],
      on_existing_audio: 'mix',
      output: 'o.mp4',
    });
    expect(withBase.filter).toContain('[0:a]');
    expect(withBase.filter).toContain('amix=inputs=2');

    const replace = buildMixFilter({
      base: 'b.mp4',
      baseHasAudio: true,
      segments: [{ path: 'a.mp3', start_sec: 0 }],
      on_existing_audio: 'replace',
      output: 'o.mp4',
    });
    expect(replace.filter).not.toContain('[0:a]');
    expect(replace.filter).toContain('amix=inputs=1');
  });

  it('rejects mixing onto a base that already has audio under the reject policy', () => {
    expect(() =>
      buildMixFilter({
        base: 'b.mp4',
        baseHasAudio: true,
        segments: [{ path: 'a.mp3', start_sec: 0 }],
        on_existing_audio: 'reject',
        output: 'o.mp4',
      }),
    ).toThrow(/reject/);
  });

  it('finiteNum and secArg reject non-finite values', () => {
    expect(finiteNum(NaN)).toBe(false);
    expect(finiteNum(Infinity)).toBe(false);
    expect(finiteNum(3)).toBe(true);
    expect(secArg(NaN)).toBe('0.000');
    expect(secArg(-5)).toBe('0.000');
    expect(secArg(3.14159)).toBe('3.142');
  });
});
