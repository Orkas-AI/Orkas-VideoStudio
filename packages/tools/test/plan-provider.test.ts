import { describe, it, expect } from 'vitest';
import type { OvsConfig } from '@orkas/video-studio-core';
import { checkPlanVideoProvider, validatePlanWithProvider } from '../src/plan-provider';

const MUAPI: OvsConfig = { video: { provider: 'muapi', api_key: 'mu-key' } };
const ATLAS: OvsConfig = { video: { provider: 'atlas', api_key: 'k' } };
const NONE: OvsConfig = {};

function generatePlan(spec: Record<string, unknown>, segmentOverrides: Record<string, unknown> = {}) {
  return {
    aspect: '16:9',
    total_target_sec: 5,
    language: 'en',
    delivery_promise: { type: 'compose_led', source_required: false, motion_min_ratio: 0 },
    segments: [{
      id: 's1', order: 1, role: 'body', layer: 'primary', source: 'generate', target_sec: 5,
      spec: { prompt: 'a wide shot of a city at dawn', media_kind: 'video', ...spec },
      ...segmentOverrides,
    }],
    tracks: {},
    cost_estimate: { billable_generations: 1 },
  };
}

const paths = (issues: { path: string }[]) => issues.map((i) => i.path);

describe('checkPlanVideoProvider', () => {
  it('rejects ratio, duration, and operation the configured MuAPI endpoints cannot run', () => {
    const issues = checkPlanVideoProvider(generatePlan({ ratio: '4:3', generation_duration_sec: 8, operation: 'edit' }), MUAPI);
    expect(paths(issues)).toEqual([
      'segments[0].spec.ratio',
      'segments[0].spec.generation_duration_sec',
      'segments[0].spec.operation',
    ]);
    expect(issues.every((i) => i.level === 'error' && i.code === 'E_SPEC_GENERATE_PROVIDER')).toBe(true);
    expect(issues[0].message).toMatch(/"muapi" supports ratios 16:9, 9:16, 1:1, not 4:3/);
    expect(issues[1].message).toMatch(/5 or 10 seconds, not 8/);
    expect(issues[2].message).toMatch(/generate operation only/);
  });

  it('accepts a plan inside the MuAPI limits and leaves unset fields to the adapter defaults', () => {
    expect(checkPlanVideoProvider(generatePlan({ ratio: '9:16', generation_duration_sec: 10 }), MUAPI)).toEqual([]);
    expect(checkPlanVideoProvider(generatePlan({}), MUAPI)).toEqual([]);
  });

  it('matches the neutral plan contract for Doubao (default) and Atlas, except Atlas has no edit', () => {
    const wide = generatePlan({ ratio: '4:3', generation_duration_sec: 8 });
    expect(checkPlanVideoProvider(wide, NONE)).toEqual([]);
    expect(checkPlanVideoProvider(wide, ATLAS)).toEqual([]);
    expect(paths(checkPlanVideoProvider(generatePlan({ operation: 'edit' }), ATLAS))).toEqual(['segments[0].spec.operation']);
    expect(checkPlanVideoProvider(generatePlan({ operation: 'edit' }), NONE)).toEqual([]);
  });

  it('ignores image generation and plans without video generation', () => {
    expect(checkPlanVideoProvider(generatePlan({ media_kind: 'image', ratio: '4:3' }), MUAPI)).toEqual([]);
    const compose = { segments: [{ id: 'c', order: 1, layer: 'primary', source: 'compose', spec: { kind: 'title-card' } }] };
    expect(checkPlanVideoProvider(compose, { video: { provider: 'nope' as never } })).toEqual([]);
    expect(checkPlanVideoProvider(null, MUAPI)).toEqual([]);
  });

  it('reports an unsupported configured provider once, only when the plan generates video', () => {
    const issues = checkPlanVideoProvider(generatePlan({}), { video: { provider: 'seedance' as never, api_key: 'k' } });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ level: 'error', path: '$', code: 'E_VIDEO_PROVIDER' });
    expect(issues[0].message).toMatch(/unsupported provider "seedance"/);
  });
});

describe('validatePlanWithProvider', () => {
  it('fails a structurally valid plan that the configured provider cannot run', () => {
    const plan = generatePlan({ ratio: '4:3', generation_duration_sec: 5 });
    expect(validatePlanWithProvider(plan, NONE).ok).toBe(true);
    const r = validatePlanWithProvider(plan, MUAPI);
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.code)).toEqual(['E_SPEC_GENERATE_PROVIDER']);
  });

  it('does not report a field twice when the neutral validator already rejected it', () => {
    const r = validatePlanWithProvider(generatePlan({ ratio: '2:1' }), MUAPI);
    expect(r.ok).toBe(false);
    expect(r.errors.filter((e) => e.path === 'segments[0].spec.ratio').map((e) => e.code)).toEqual(['E_SPEC_GENERATE_SETTINGS']);
  });
});
