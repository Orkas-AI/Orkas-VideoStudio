import { describe, it, expect } from 'vitest';
import {
  buildTrimArgs,
  buildConcatArgs,
  buildBurnsubsArgs,
  escapeFfmpegFilterValue,
  buildNormalizeLoudnessArgs,
  buildMixFilter,
  finiteNum,
  secArg,
  loudnormMeasuredOptions,
  loudnormSecondPassOptions,
  normalizeLoudnessAudioFilter,
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
    expect(vf).toBe('subtitles=filename=/a/b\\\\:c.srt');
  });

  it('escapes special subtitle paths through both ffmpeg filter parsers', () => {
    expect(escapeFfmpegFilterValue("/a/字幕 [1], it's; final.srt"))
      .toBe(String.raw`/a/字幕\\\ \[1\]\,\\\ it\\\'s\;\\\ final.srt`);
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

// A single loudnorm pass left a -18.4 LUFS ad at -16.6, outside the delivery's 2 LU;
// normalization now applies a measurement of the same audio as loudnorm's second pass.
describe('measured loudnorm second pass', () => {
  it('turns a loudnorm measurement into second-pass options, and refuses an incomplete one', () => {
    const measured = '{"input_i":"-28.25","input_tp":"-6.16","input_lra":"11.00","input_thresh":"-38.57","target_offset":"4.43"}';
    expect(loudnormMeasuredOptions(`[Parsed_loudnorm_0 @ 0x1]\n${measured}\n`)).toBe('measured_I=-28.25:measured_TP=-6.16:measured_LRA=11:measured_thresh=-38.57:offset=4.43:linear=true');
    expect(loudnormMeasuredOptions('{"input_i":"-inf","input_tp":"-inf","input_lra":"0.00","input_thresh":"-70.00","target_offset":"0.00"}')).toBeNull();
    expect(loudnormMeasuredOptions('no json here')).toBeNull();
    expect(normalizeLoudnessAudioFilter('measured_I=-28.25:linear=true')).toMatch(/^loudnorm=I=-14:TP=-1:LRA=11:measured_I=-28\.25:linear=true,aresample=/);
    expect(normalizeLoudnessAudioFilter()).toMatch(/^loudnorm=I=-14:TP=-1:LRA=11,aresample=/);
  });

  it('takes the second pass only from a complete measurement', () => {
    expect(loudnormSecondPassOptions({ input_i: -28.25, input_tp: -6.16, input_lra: 11, input_thresh: -38.57, target_offset: 4.43 }))
      .toBe('measured_I=-28.25:measured_TP=-6.16:measured_LRA=11:measured_thresh=-38.57:offset=4.43:linear=true');
    expect(loudnormSecondPassOptions({ input_i: -Infinity, input_tp: -Infinity, input_lra: 0, input_thresh: -70, target_offset: 0 })).toBeNull();
    expect(loudnormSecondPassOptions({ input_i: -20, input_tp: -3, input_lra: 5 })).toBeNull();
    expect(loudnormSecondPassOptions(null)).toBeNull();
    const args = buildNormalizeLoudnessArgs('in.mp4', 'out.mp4', 'measured_I=-20:linear=true');
    expect(args[args.indexOf('-filter:a:0') + 1]).toMatch(/^loudnorm=I=-14:TP=-1:LRA=11:measured_I=-20:linear=true,/);
  });
});
