import { describe, expect, it } from 'vitest';
import {
  breakCaptionLine, buildBurnsubsArgs, buildReframeFilter, buildMixArgs, buildMixFilter, buildConcatArgs, captionEm, captionLineEm,
  VERTICAL_CAPTION_FONT_SIZE, wrapCaptionText,
} from '../src/edit/args.js';
import { reframe } from '../src/edit/edit.js';

describe('measured edit contracts', () => {
  it('switches the crop to a measured subject centre in source time', () => {
    const filter = buildReframeFilter({ mode: 'crop', width: 1080, height: 1920, plan: [{ startSec: 0, centreX: 0.2 }, { startSec: 3, centreX: 0.8 }] }).filter;
    expect(filter).toContain("x='clip(iw*if(lt(t,3.000),0.2000,0.8000)-ow/2,0,iw-ow)'");
    expect(filter).toContain('format=yuv420p');
  });
  it('rejects a moving crop on a pad mode before touching the files', async () => {
    await expect(reframe({ input: 'missing', output: 'out.mp4', aspect: '9:16', mode: 'pad', plan: [{ start: 0, centre_x: 0.5 }] })).rejects.toThrow(/plan needs mode crop/);
  });
  it('covers existing captions and places new plain captions within the covered band', () => {
    const args = buildBurnsubsArgs('input.mp4', 'translated.srt', 'out.mp4', undefined, { cover: { top: 0.75, bottom: 0.95 } });
    const vf = args[args.indexOf('-vf') + 1];
    expect(vf).toContain('drawbox=x=0:y=ih*0.7500:w=iw:h=ih*0.2000:color=black@1:t=fill,subtitles=');
    expect(vf).toContain('MarginV=33');
    expect(() => buildBurnsubsArgs('i', 'x.srt', 'o', undefined, { cover: { top: 0.2, bottom: 0.9 } })).toThrow(/cover/);
  });
});

it('keeps picture duration authoritative and can duck the existing bed under narration', () => {
  const args = buildMixArgs({ base: 'base', baseHasAudio: true, segments: [{ path: 'voice', start_sec: 1 }], on_existing_audio: 'mix', output: 'out', duration_sec: 6, duck: true });
  const filter = args[args.indexOf('-filter_complex') + 1];
  expect(filter).toContain('sidechaincompress');
  expect(filter).toContain('apad=whole_dur=6');
  expect(args).toContain('-shortest');
  expect(args).not.toContain('-t');
});
// sidechaincompress drained on a partial last frame and dropped the music after the
// release; whole frames on every branch keep it, and the known duration trims the padding.
it('aligns the ducked bed, its key and the base on whole audio frames before the compressor drains', () => {
  const plan = { base: 'base', baseHasAudio: true, segments: [{ path: 'voice', start_sec: 2 }], on_existing_audio: 'mix' as const, output: 'out', duck: true };
  const known = buildMixFilter({ ...plan, duration_sec: 6 }).filter;
  expect(known).toContain('[bed]asetnsamples=n=1024:p=1,asplit=2[bedmix][key0]');
  expect(known).toContain('[key0]apad=whole_dur=6.000,asetnsamples=n=1024:p=1[key]');
  expect(known).toContain('[0:a]aresample=48000,asetnsamples=n=1024:p=1[base0]');
  expect(known).toContain('[base0][key]sidechaincompress=threshold=0.02:ratio=10:attack=20:release=400[base]');
  expect(known).toMatch(/,atrim=duration=6\.000\[outa\]$/);
  const unknown = buildMixFilter(plan).filter;
  expect(unknown).toContain('[key0]apad,asetnsamples=n=1024:p=1[key]');
  expect(unknown).not.toContain('atrim');
  // Without duck nothing is split or keyed, so nothing is re-framed.
  expect(buildMixFilter({ ...plan, duck: false, duration_sec: 6 }).filter).not.toContain('asetnsamples');
});
it('preserves measured concat timestamps without frame duplication', () => {
  const args = buildConcatArgs('list', 'out');
  expect(args).toContain('passthrough');
  expect(args).toContain('setpts=PTS-STARTPTS');
});

const burnsubsFilter = (subtitles: string, fontName: string | undefined, options: { cover?: { top: number; bottom: number }; portrait?: boolean }): string => {
  const args = buildBurnsubsArgs('in.mp4', subtitles, 'out.mp4', fontName, options);
  return args[args.indexOf('-vf') + 1] ?? '';
};

describe('burnsubs caption size by frame shape', () => {
  it('sets plain captions on a vertical frame smaller and above the platform buttons', () => {
    expect(burnsubsFilter('/a/captions.srt', undefined, { portrait: true })).toMatch(/:force_style='FontSize=11,MarginV=60'$/);
    expect(burnsubsFilter('/a/captions.vtt', 'PingFang SC', { portrait: true })).toMatch(/:force_style='FontName=PingFang SC,FontSize=11,MarginV=60'$/);
  });

  it('keeps the default size on a landscape frame and an authored file at its own size', () => {
    expect(burnsubsFilter('/a/captions.srt', undefined, { portrait: false })).not.toContain('force_style');
    expect(burnsubsFilter('/a/styled.ASS', undefined, { portrait: true })).not.toContain('force_style');
    expect(burnsubsFilter('/a/styled.ssa', undefined, { portrait: true })).not.toContain('force_style');
  });

  it('keeps the vertical size inside a covered band', () => {
    const cover = { top: 0.75, bottom: 0.95 };
    expect(burnsubsFilter('translated.srt', undefined, { cover, portrait: true })).toMatch(/:force_style='FontSize=11,Alignment=2,MarginV=33'$/);
    expect(burnsubsFilter('translated.srt', undefined, { cover, portrait: false })).toMatch(/:force_style='Alignment=2,MarginV=33'$/);
    expect(burnsubsFilter('styled.ass', undefined, { cover, portrait: true })).not.toContain('force_style');
  });
});

// On 1080x1920, plain captions at libass's default size fit about ten Chinese characters per
// line, and libass breaks only at spaces, so a 15-character line ran off both edges.
describe('caption lines fit the frame', () => {
  it('measures wide characters as a whole em and the rest as about half, markup as none', () => {
    expect(captionEm('想吃的朋友')).toBe(5);
    expect(captionEm('Hello')).toBeCloseTo(3);
    expect(captionEm('<i>好</i>{\\b1}吧')).toBe(2);
  });

  it('gives a vertical frame at the vertical size about thirteen characters, a wide one about twenty-eight', () => {
    expect(captionLineEm({ width: 1080, height: 1920 }, VERTICAL_CAPTION_FONT_SIZE)).toBe(13);
    expect(captionLineEm({ width: 1080, height: 1920 }, 16)).toBe(9);
    expect(captionLineEm({ width: 1920, height: 1080 }, 16)).toBe(28);
  });

  it('breaks a long line in even parts at punctuation, else between wide characters, and never before a closing mark', () => {
    const parts = breakCaptionLine('想吃的朋友，可以提前在群里跟我说，帮你留着。', 13);
    expect(parts.join('')).toBe('想吃的朋友，可以提前在群里跟我说，帮你留着。');
    for (const part of parts) expect(captionEm(part)).toBeLessThanOrEqual(13);
    expect(parts.length).toBe(2);
    // A comma near the middle is taken over a break between two characters.
    expect(breakCaptionLine('今天说三个坑，第一个是规则太复杂', 13)).toEqual(['今天说三个坑，', '第一个是规则太复杂']);
    expect(breakCaptionLine('大家好这周我们店上了一款新品抹茶红豆卷', 13).map(captionEm).every((em) => em <= 13)).toBe(true);
    expect(breakCaptionLine('一二三四五六七八九十十一。', 12).some((part) => part.startsWith('。'))).toBe(false);
    expect(breakCaptionLine('The quick brown fox jumps over the lazy dog', 10)).toEqual(['The quick brown', 'fox jumps over', 'the lazy dog']);
    expect(breakCaptionLine('短句', 13)).toEqual(['短句']);
  });

  it('preserves VTT blocks, cue identifiers and CRLF while wrapping numeric and keyword-leading dialogue', () => {
    const header = ['WEBVTT', 'Language: a-long-header-value', '', 'STYLE', '::cue { color: lime; }', '',
      'NOTE a multi-line annotation', '00:00.000 --> 00:05.000', 'comment text remains intact', '',
      'REGION', 'id:a-very-long-region-name', '', 'cue-identifier-with-long-name',
      '00:00.000 --> 00:05.000 align:start'].join('\r\n');
    const result = wrapCaptionText(header + '\r\n12345678901234567890\r\nNOTE this is dialogue\r\n', 6);
    expect(result.startsWith(header + '\r\n')).toBe(true);
    const lines = result.slice(header.length + 2).trimEnd().split('\r\n');
    expect(lines.join('').replace(/ /g, '')).toBe('12345678901234567890NOTEthisisdialogue');
    expect(lines.every((line) => captionEm(line) <= 6)).toBe(true);
    expect(wrapCaptionText(header + '\r\n短\r\n', 6)).toBe(header + '\r\n短\r\n');
    const nextCue = 'STYLE example identifier\n00:01.000 --> 00:03.000\n';
    expect(wrapCaptionText('WEBVTT\n\n' + nextCue + '12345678901234567890', 6))
      .toBe('WEBVTT\n\n' + nextCue + '1234567890\n1234567890');
  });

  it('retains every character of a long unbroken cue', () => {
    const line = '长'.repeat(10_000);
    const parts = breakCaptionLine(line, 13);
    expect(parts.join('')).toBe(line);
    expect(parts.every((part) => part.length <= 13)).toBe(true);
  });

  it('wraps only the text lines of a caption file and leaves short ones as they are', () => {
    const srt = '1\n00:00:00,000 --> 00:00:05,000\n想吃的朋友，可以提前在群里跟我说，帮你留着。\n\n2\n00:00:05,000 --> 00:00:07,000\n甜度调低了\n';
    const wrapped = wrapCaptionText(srt, 13);
    expect(wrapped.split('\n').slice(0, 2)).toEqual(['1', '00:00:00,000 --> 00:00:05,000']);
    expect(wrapped).toContain('甜度调低了');
    expect(wrapped.split('\n').filter((line) => line && !/-->|^\d+$/.test(line)).every((line) => captionEm(line) <= 13)).toBe(true);
    expect(wrapCaptionText('WEBVTT\n\n00:00.000 --> 00:01.000\n短\n', 13)).toBe('WEBVTT\n\n00:00.000 --> 00:01.000\n短\n');
  });
});
