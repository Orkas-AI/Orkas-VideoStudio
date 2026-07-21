import { describe, it, expect } from 'vitest';
import {
  validateEdl,
  assessDelivery,
  summarizeEdl,
  type VideoEdl,
  type EdlSegment,
} from '../src/ir/edl';

// --- builders --------------------------------------------------------------

function seg(over: Partial<EdlSegment> & Pick<EdlSegment, 'id' | 'order' | 'source'>): EdlSegment {
  const specBySource: Record<string, Record<string, unknown>> = {
    edit: { input_id: 'clipA', in_sec: 0, out_sec: over.target_sec ?? 5 },
    generate: { prompt: 'a wide shot of a city at dawn', media_kind: 'video' },
    compose: { kind: 'title-card' },
    provided: { asset_id: 'asset1', kind: 'video' },
  };
  return {
    role: 'body',
    layer: 'primary',
    target_sec: 10,
    spec: specBySource[over.source] ?? {},
    ...over,
  } as EdlSegment;
}

function plan(over: Partial<VideoEdl> = {}): VideoEdl {
  return {
    aspect: '16:9',
    total_target_sec: 30,
    language: 'en',
    delivery_promise: { type: 'compose_led', source_required: false, motion_min_ratio: 0 },
    segments: [seg({ id: 's1', order: 1, role: 'hook', source: 'compose', target_sec: 30 })],
    tracks: {},
    ...over,
  };
}

const codes = (issues: { code: string }[]) => issues.map((i) => i.code);

// --- validateEdl: structural -----------------------------------------------

describe('validateEdl — structural', () => {
  it('accepts a minimal valid compose plan with zero errors and warnings', () => {
    const r = validateEdl(plan());
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('rejects a non-object plan', () => {
    expect(validateEdl(null).ok).toBe(false);
    expect(codes(validateEdl(42).errors)).toContain('E_NOT_OBJECT');
  });

  it('flags missing top-level scalars', () => {
    const r = validateEdl({ delivery_promise: { type: 'compose_led' }, segments: [] });
    const c = codes(r.errors);
    expect(c).toContain('E_ASPECT_MISSING');
    expect(c).toContain('E_TOTAL_SEC');
    expect(c).toContain('E_LANGUAGE_MISSING');
    expect(c).toContain('E_SEGMENTS_EMPTY');
    expect(c).toContain('E_TRACKS_NOT_OBJECT');
  });

  it('requires the tracks container but accepts an empty object', () => {
    const missing = plan() as Partial<VideoEdl>;
    delete missing.tracks;
    expect(codes(validateEdl(missing).errors)).toContain('E_TRACKS_NOT_OBJECT');
    expect(validateEdl(plan({ tracks: {} })).ok).toBe(true);
  });

  it('requires at least one primary segment', () => {
    const r = validateEdl(
      plan({
        segments: [seg({ id: 'o1', order: 1, source: 'compose', layer: 'overlay', over: 's1' })],
      }),
    );
    expect(codes(r.errors)).toContain('E_NO_PRIMARY');
  });

  it('flags duplicate segment ids', () => {
    const r = validateEdl(
      plan({
        total_target_sec: 20,
        segments: [
          seg({ id: 'dup', order: 1, source: 'compose', target_sec: 10 }),
          seg({ id: 'dup', order: 2, source: 'compose', target_sec: 10 }),
        ],
      }),
    );
    expect(codes(r.errors)).toContain('E_SEG_ID_DUP');
  });
});

// --- validateEdl: references & specs ---------------------------------------

describe('validateEdl — references and specs', () => {
  it('resolves a valid `over` reference and rejects an unknown one', () => {
    const good = validateEdl(
      plan({
        segments: [
          seg({ id: 's1', order: 1, source: 'compose', target_sec: 30 }),
          seg({ id: 'o1', order: 2, source: 'compose', layer: 'overlay', over: 's1', target_sec: 5 }),
        ],
      }),
    );
    expect(codes(good.errors)).not.toContain('E_OVER_UNKNOWN');

    const bad = validateEdl(
      plan({
        segments: [
          seg({ id: 's1', order: 1, source: 'compose', target_sec: 30 }),
          seg({ id: 'o1', order: 2, source: 'compose', layer: 'overlay', over: 'ghost', target_sec: 5 }),
        ],
      }),
    );
    expect(codes(bad.errors)).toContain('E_OVER_UNKNOWN');
  });

  it('rejects an edit spec whose out_sec <= in_sec', () => {
    const r = validateEdl(
      plan({
        delivery_promise: { type: 'source_led', source_required: true, motion_min_ratio: 0.3 },
        segments: [
          { id: 's1', order: 1, role: 'body', layer: 'primary', source: 'edit', target_sec: 30, spec: { input_id: 'a', in_sec: 5, out_sec: 5 } },
        ],
      }),
    );
    expect(codes(r.errors)).toContain('E_SPEC_EDIT_RANGE');
  });
});

// --- validateEdl: promise consistency --------------------------------------

describe('validateEdl — promise consistency', () => {
  it('errors when source_required but no source footage is present', () => {
    const r = validateEdl(
      plan({ delivery_promise: { type: 'source_led', source_required: true, motion_min_ratio: 0.3 } }),
    );
    expect(r.ok).toBe(false);
    expect(codes(r.errors)).toContain('E_PROMISE_NO_SOURCE');
  });

  it('warns (does not block) on a motion_led promise with no motion segment', () => {
    const r = validateEdl(
      plan({ delivery_promise: { type: 'motion_led', source_required: false, motion_min_ratio: 0.7 } }),
    );
    expect(r.ok).toBe(true);
    expect(codes(r.warnings)).toContain('W_PROMISE_TYPE_MISMATCH');
  });

  it('does NOT warn type-mismatch when compose_led actually has a compose segment (look-alike)', () => {
    const r = validateEdl(plan());
    expect(codes(r.warnings)).not.toContain('W_PROMISE_TYPE_MISMATCH');
  });

  it('blocks when Gate C billable count does not exactly match generate segments', () => {
    const r = validateEdl(
      plan({
        delivery_promise: { type: 'motion_led', source_required: false, motion_min_ratio: 0.7 },
        segments: [seg({ id: 's1', order: 1, source: 'generate', target_sec: 30 })],
      }),
    );
    expect(r.ok).toBe(false);
    expect(codes(r.errors)).toContain('E_COST_COUNT_MISMATCH');
  });

  it('validates exact executable video-generation settings and rejects aliases', () => {
    const valid = validateEdl(plan({
      delivery_promise: { type: 'motion_led', source_required: false, motion_min_ratio: 0.7 },
      segments: [seg({
        id: 's1', order: 1, source: 'generate', target_sec: 5,
        spec: {
          prompt: 'a wide shot of a city at dawn',
          media_kind: 'video',
          generation_duration_sec: 5,
          ratio: '16:9',
          resolution: '720p',
          generate_audio: false,
        },
      })],
      cost_estimate: { billable_generations: 1 },
    }));
    expect(valid.ok).toBe(true);

    const aliased = validateEdl(plan({
      segments: [seg({
        id: 's1', order: 1, source: 'generate', target_sec: 5,
        spec: { prompt: 'city', media_kind: 'video', duration_sec: 5, audio: true },
      })],
      cost_estimate: { billable_generations: 1 },
    }));
    expect(codes(aliased.errors)).toContain('E_SPEC_GENERATE_SETTINGS_ALIAS');
  });

  it('requires provided media to declare video versus image', () => {
    const r = validateEdl(plan({
      segments: [seg({ id: 's1', order: 1, source: 'provided', spec: { asset_id: 'asset1' } })],
    }));
    expect(codes(r.errors)).toContain('E_SPEC_PROVIDED_KIND');
  });
});

// --- assessDelivery: the deterministic slideshow guard ---------------------

describe('assessDelivery', () => {
  it('fails a motion_led promise rendered as a compose-only slideshow', () => {
    const a = assessDelivery(
      plan({
        delivery_promise: { type: 'motion_led', source_required: false } as VideoEdl['delivery_promise'],
        segments: [seg({ id: 's1', order: 1, source: 'compose', target_sec: 30 })],
      }),
    );
    expect(a.verdict).toBe('fail');
    expect(a.motion_ratio).toBe(0);
  });

  it('passes a motion_led promise carried by real footage', () => {
    const a = assessDelivery(
      plan({
        delivery_promise: { type: 'motion_led', source_required: true } as VideoEdl['delivery_promise'],
        segments: [seg({ id: 's1', order: 1, source: 'edit', target_sec: 30 })],
      }),
    );
    expect(a.verdict).toBe('pass');
    expect(a.motion_ratio).toBe(1);
    expect(a.source_present).toBe(true);
  });

  it('fails when source is required but the primary track has none', () => {
    const a = assessDelivery(
      plan({ delivery_promise: { type: 'source_led', source_required: true, motion_min_ratio: 0.3 } }),
    );
    expect(a.verdict).toBe('fail');
    expect(a.source_ok).toBe(false);
  });

  it('warns on a long run of identical-source primary segments', () => {
    const a = assessDelivery(
      plan({
        total_target_sec: 30,
        delivery_promise: { type: 'compose_led', source_required: false, motion_min_ratio: 0 },
        segments: [
          seg({ id: 'a', order: 1, source: 'compose', target_sec: 10 }),
          seg({ id: 'b', order: 2, source: 'compose', target_sec: 10 }),
          seg({ id: 'c', order: 3, source: 'compose', target_sec: 10 }),
        ],
      }),
    );
    expect(a.verdict).toBe('warn');
  });

  it('uses producedSec over planned target_sec when provided', () => {
    const a = assessDelivery(
      plan({
        delivery_promise: { type: 'motion_led', source_required: true } as VideoEdl['delivery_promise'],
        segments: [seg({ id: 's1', order: 1, source: 'edit', target_sec: 30 })],
      }),
      { producedSec: { s1: 12.5 } },
    );
    expect(a.total_primary_sec).toBe(12.5);
  });

  it('does not count generated or provided still images as motion', () => {
    const a = assessDelivery(plan({
      delivery_promise: { type: 'motion_led', source_required: false, motion_min_ratio: 0.7 },
      segments: [
        seg({ id: 'image-gen', order: 1, source: 'generate', target_sec: 15, spec: { prompt: 'still', media_kind: 'image' } }),
        seg({ id: 'image-provided', order: 2, source: 'provided', target_sec: 15, spec: { asset_id: 'still', kind: 'image' } }),
      ],
      cost_estimate: { billable_generations: 1 },
    }));
    expect(a.motion_ratio).toBe(0);
    expect(a.verdict).toBe('fail');
  });
});

// --- summarizeEdl ----------------------------------------------------------

describe('summarizeEdl', () => {
  it('renders a deterministic header, timeline, and cost line', () => {
    const out = summarizeEdl(
      plan({
        total_target_sec: 15,
        tracks: { narration: { voice: 'demo-voice', segments: [{ text: 'hello' }] } },
        cost_estimate: { billable_generations: 0 },
      }),
    );
    expect(out).toContain('Plan: 16:9');
    expect(out).toContain('Timeline:');
    expect(out).toContain('Narration: voice=legacy:demo-voice');
    expect(out).toContain('Cost: 0 billable generation(s)');
  });

  it('summarizes the exact reviewed narration profile and ignores disabled tracks', () => {
    const edl = plan({
      tracks: {
        narration: {
          synthesis: {
            route_ref: 'openai-compatible',
            voice: 'nova',
            language: 'en-US',
            speed: 1,
            model: 'tts-1',
          },
          segments: [{ text: 'hello' }],
        },
        music: null,
        captions: null,
      },
    });
    const validated = validateEdl(edl);
    expect(validated.ok).toBe(true);
    expect(summarizeEdl(edl)).toContain('voice=nova (openai-compatible) · language=en-US · speed=1');
  });
});
