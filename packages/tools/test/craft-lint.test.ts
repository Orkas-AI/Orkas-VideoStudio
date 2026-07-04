import { describe, it, expect } from 'vitest';
import { lintCompositionCraft, formatCraftFindings } from '../src/render/craft-lint';

const codes = (html: string, opts?: { canvasHeight?: number }) =>
  lintCompositionCraft(html, opts).map((f) => f.code);

describe('craft-lint: font legibility floor', () => {
  it('flags an explicit px font-size below the ~40px floor at 1080p', () => {
    expect(codes('<div style="font-size: 20px">hi</div>')).toContain('FONT_TOO_SMALL');
  });

  it('does NOT flag a size at or above the floor', () => {
    expect(codes('<div style="font-size: 40px">a</div><div style="font-size:64px">b</div>')).not.toContain('FONT_TOO_SMALL');
  });

  it('ignores non-px units (em/rem/vw/%/clamp) — not a hard pixel commitment', () => {
    const html = '<a style="font-size:1.2rem"></a><b style="font-size:2em"></b><i style="font-size:4vw"></i><u style="font-size:90%"></u>';
    expect(codes(html)).not.toContain('FONT_TOO_SMALL');
  });

  it('scales the floor with the declared canvas height', () => {
    // 60px is fine at 1080 (floor 40) but below the floor of a 1920-tall canvas (~71px).
    expect(codes('<x data-height="1920" style="font-size:60px"></x>')).toContain('FONT_TOO_SMALL');
    expect(codes('<x data-height="1080" style="font-size:60px"></x>')).not.toContain('FONT_TOO_SMALL');
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
