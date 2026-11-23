import { describe, expect, it } from 'vitest';
import { buildBurnsubsArgs, buildReframeFilter, buildMixArgs, buildMixFilter, buildConcatArgs } from '../src/edit/args.js';
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
