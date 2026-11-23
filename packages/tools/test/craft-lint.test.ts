import { describe, it, expect } from 'vitest';
import { lintCompositionCraft, formatCraftFindings } from '../src/render/craft-lint';

const codes = (html: string, opts?: { canvasWidth?: number; canvasHeight?: number }) =>
  lintCompositionCraft(html, opts).map((f) => f.code);
const sized = (width: number, height: number, px: string) =>
  codes(`<main data-width="${width}" data-height="${height}"><p style="font-size:${px}">Read me</p></main>`);

describe('craft-lint: font legibility floor', () => {
  it('flags an explicit px font-size below the ~42px floor on a 1080px short side', () => {
    expect(codes('<div style="font-size: 20px">hi</div>')).toContain('FONT_TOO_SMALL');
  });

  it('does NOT flag a size at or above the floor', () => {
    expect(codes('<div style="font-size: 42px">a</div><div style="font-size:64px">b</div>')).not.toContain('FONT_TOO_SMALL');
  });

  // 2026-11-17: a fixed floor let text a phone shows at 6 px through. Text must reach about
  // 14 px where it is watched: a phone showing the video full screen, 360 CSS px on its short side.
  it('asks for about 14 px on a phone: 42 px on a 1080 px wide upright video', () => {
    expect(sized(1080, 1920, '36px')).toContain('FONT_TOO_SMALL');
    expect(sized(1080, 1920, '42px')).not.toContain('FONT_TOO_SMALL');
    const [finding] = lintCompositionCraft('<main data-width="1080" data-height="1920"><p style="font-size:36px">x</p></main>');
    expect(finding.message).toContain('under 42px, about 14px when the video fills a phone screen');
  });

  it('measures a wide video by its short side, as it fills a phone held sideways', () => {
    expect(sized(1920, 1080, '38px')).toContain('FONT_TOO_SMALL');
    expect(sized(1920, 1080, '48px')).not.toContain('FONT_TOO_SMALL');
  });

  it('scales with a smaller canvas', () => {
    expect(sized(720, 1280, '30px')).not.toContain('FONT_TOO_SMALL');
    expect(sized(720, 1280, '24px')).toContain('FONT_TOO_SMALL');
  });

  it('still catches 16 px text on an upright video', () => {
    expect(sized(1080, 1920, '16px')).toContain('FONT_TOO_SMALL');
  });

  it('ignores non-px units (em/rem/vw/%/clamp) — not a hard pixel commitment', () => {
    const html = '<a style="font-size:1.2rem"></a><b style="font-size:2em"></b><i style="font-size:4vw"></i><u style="font-size:90%"></u>';
    expect(codes(html)).not.toContain('FONT_TOO_SMALL');
  });

  it('takes the floor from the canvas short side, not its height alone', () => {
    // 60px reads on a phone from an upright 1080x1920 video (floor 42) and from a wide 1920x1080 one.
    expect(sized(1080, 1920, '60px')).not.toContain('FONT_TOO_SMALL');
    expect(sized(1920, 1080, '60px')).not.toContain('FONT_TOO_SMALL');
    expect(codes('<x style="font-size:60px"></x>', { canvasWidth: 2160, canvasHeight: 3840 })).toContain('FONT_TOO_SMALL');
  });
});

describe('craft-lint: palette restraint', () => {
  const chroma = (n: number) =>
    Array.from({ length: n }, (_, i) => `<s style="color:hsl(${i * 24 + 12},80%,50%)"></s>`).join('');

  it('flags a composition with more than the soft palette max of distinct chromatic colors', () => {
    expect(codes(chroma(10))).toContain('PALETTE_LARGE');
  });

  it('does NOT flag a restrained multi-scene palette', () => {
    expect(codes(chroma(5))).not.toContain('PALETTE_LARGE');
  });

  it('does not count neutrals (black/white/gray/transparent/0%-sat) toward the budget', () => {
    // Many neutrals, zero chromatic colors — must not trip PALETTE_LARGE.
    const neutrals =
      '#000 #fff #888 #cccccc rgb(20,20,20) rgba(200,200,200,0.5) hsl(210,0%,40%) transparent'.repeat(3);
    expect(codes(`<div>${neutrals}</div>`)).not.toContain('PALETTE_LARGE');
  });

  it('collapses hex shorthands and case so #F00 and #ff0000 are one color', () => {
    const html = ('<a style="color:#F00"></a><b style="color:#ff0000"></b><c style="color:#FF0000"></c>').repeat(4);
    // Still just one distinct chromatic color — nowhere near the max.
    expect(codes(html)).not.toContain('PALETTE_LARGE');
  });
});

describe('craft-lint: output shape', () => {
  it('returns an empty array for empty/clean html', () => {
    expect(lintCompositionCraft('')).toEqual([]);
    expect(lintCompositionCraft('<div style="font-size:48px;color:#3366ff">clean</div>')).toEqual([]);
  });

  it('formatCraftFindings is empty for no findings and a labeled block otherwise', () => {
    expect(formatCraftFindings([])).toBe('');
    const text = formatCraftFindings(lintCompositionCraft('<x style="font-size:12px"></x>'));
    expect(text).toContain('[craft]');
    expect(text).toContain('FONT_TOO_SMALL');
  });
});
