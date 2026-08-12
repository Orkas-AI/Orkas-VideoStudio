import { describe, it, expect } from 'vitest';
import {
  buildBurnsubsArgs,
  buildConformArgs,
  buildMixFilter,
  buildNormalizeLoudnessArgs,
  captionFontForText,
  chooseConcatTarget,
  concatDurationDriftError,
  overlayWouldEraseBase,
  pixFmtHasAlpha,
} from '../src/edit/args';

describe('captionFontForText', () => {
  it('names a Simplified-coverage family for Han-only text per platform', () => {
    expect(captionFontForText('指挥官与协作', 'darwin')).toBe('PingFang SC');
    expect(captionFontForText('指挥官与协作', 'win32')).toBe('Microsoft YaHei');
    expect(captionFontForText('指挥官与协作', 'linux')).toBe('Noto Sans CJK SC');
  });

  it('lets kana win over Han because Japanese text contains both', () => {
    expect(captionFontForText('東京へようこそ', 'darwin')).toBe('Hiragino Sans');
    expect(captionFontForText('東京へようこそ', 'win32')).toBe('Yu Gothic UI');
    expect(captionFontForText('東京へようこそ', 'linux')).toBe('Noto Sans CJK JP');
  });

  it('keeps the platform default for Latin-only captions', () => {
    expect(captionFontForText('1\n00:00:00,000 --> 00:00:01,000\nHello world', 'darwin')).toBe('');
  });
});

describe('burnsubs font style', () => {
  it('appends force_style only when a font is chosen', () => {
    const plain = buildBurnsubsArgs('in.mp4', 'subs.srt', 'out.mp4');
    expect(plain.join(' ')).not.toContain('force_style');
    const styled = buildBurnsubsArgs('in.mp4', 'subs.srt', 'out.mp4', 'PingFang SC');
    const vf = styled[styled.indexOf('-vf') + 1] ?? '';
    expect(vf).toContain("force_style='FontName=PingFang SC'");
  });
});

describe('overlayWouldEraseBase', () => {
  const base = { width: 1920, height: 1080 };
  it('flags an opaque overlay covering the whole base', () => {
    expect(overlayWouldEraseBase(base, { width: 1920, height: 1080, hasAlpha: false })).toBe(true);
    expect(overlayWouldEraseBase(base, { width: 2560, height: 1440, hasAlpha: false })).toBe(true);
  });
  it('allows alpha-capable and sub-frame overlays', () => {
    expect(overlayWouldEraseBase(base, { width: 1920, height: 1080, hasAlpha: true })).toBe(false);
    expect(overlayWouldEraseBase(base, { width: 480, height: 120, hasAlpha: false })).toBe(false);
  });
  it('fails open on missing or degenerate probe data', () => {
    expect(overlayWouldEraseBase(null, { width: 1920, height: 1080, hasAlpha: false })).toBe(false);
    expect(overlayWouldEraseBase(base, null)).toBe(false);
    expect(overlayWouldEraseBase({ width: 0, height: 0 }, { width: 1920, height: 1080, hasAlpha: false })).toBe(false);
  });
});

describe('pixFmtHasAlpha', () => {
  it('recognizes alpha-capable pixel formats', () => {
    expect(pixFmtHasAlpha('yuva420p')).toBe(true);
    expect(pixFmtHasAlpha('rgba')).toBe(true);
    expect(pixFmtHasAlpha('gbrap10le')).toBe(true);
  });
  it('rejects opaque formats and missing data', () => {
    expect(pixFmtHasAlpha('yuv420p')).toBe(false);
    expect(pixFmtHasAlpha(null)).toBe(false);
    expect(pixFmtHasAlpha(undefined)).toBe(false);
  });
});

describe('chooseConcatTarget', () => {
  it('returns null for a uniform set (nothing to conform)', () => {
    const s = { width: 1920, height: 1080, fps: 24 };
    expect(chooseConcatTarget([s, { ...s }])).toBeNull();
  });

  it('fails open when any input spec is unknown', () => {
    expect(chooseConcatTarget([{ width: 1920, height: 1080, fps: 24 }, null])).toBeNull();
    expect(chooseConcatTarget([])).toBeNull();
  });

  it('targets the largest canvas at the highest rate, rounded up to even', () => {
    const target = chooseConcatTarget([
      { width: 1918, height: 1080, fps: 24 },
      { width: 1920, height: 1080, fps: 15 },
      { width: 1280, height: 720, fps: 15 },
    ]);
    expect(target).toEqual({ width: 1920, height: 1080, fps: 24 });
  });

  it('rounds an odd max dimension up to the next even value', () => {
    const target = chooseConcatTarget([
      { width: 1919, height: 1079, fps: 30 },
      { width: 640, height: 480, fps: 30 },
    ]);
    expect(target).toEqual({ width: 1920, height: 1080, fps: 30 });
  });
});

describe('buildConformArgs', () => {
  it('letterboxes onto the target canvas and resamples the frame rate', () => {
    const a = buildConformArgs('in.mp4', { width: 1920, height: 1080, fps: 24 }, 'out.mp4');
    const vf = a[a.indexOf('-vf') + 1] ?? '';
    expect(vf).toContain('scale=1920:1080:force_original_aspect_ratio=decrease');
    expect(vf).toContain('pad=1920:1080:(ow-iw)/2:(oh-ih)/2');
    expect(vf).toContain('setsar=1');
    expect(vf).toContain('fps=24');
    expect(a).toContain('out.mp4');
  });
});

describe('concatDurationDriftError', () => {
  it('accepts drift within max(0.5s, 2%)', () => {
    expect(concatDurationDriftError(60, 60.4)).toBeNull();
    expect(concatDurationDriftError(60, 61.1)).toBeNull(); // 2% of 60 = 1.2s tolerance
    expect(concatDurationDriftError(10, 10.4)).toBeNull(); // 0.5s floor beats 2%
  });

  it('names both durations when the joined output does not match its parts', () => {
    const msg = concatDurationDriftError(60.03, 75.04);
    expect(msg).toContain('75.04');
    expect(msg).toContain('60.03');
    expect(msg).toContain('drift');
  });

  it('fails open when either duration is unknown', () => {
    expect(concatDurationDriftError(null, 75)).toBeNull();
    expect(concatDurationDriftError(60, 0)).toBeNull();
  });
});

describe('stereo layout pinning', () => {
  it('pins a stereo layout in the normalize-loudness chain (mono inputs must not die in layout negotiation)', () => {
    expect(buildNormalizeLoudnessArgs('in.mp4', 'out.mp4').join(' ')).toContain('aformat=channel_layouts=stereo');
  });

  it('pins a stereo layout and resamples after loudnorm in the mix filter', () => {
    const { filter } = buildMixFilter({
      base: 'b.mp4',
      baseHasAudio: false,
      segments: [{ path: 'a.mp3', start_sec: 0 }],
      on_existing_audio: 'replace',
      output: 'o.mp4',
    });
    expect(filter).toContain('aresample=48000,aformat=channel_layouts=stereo');
  });
});
