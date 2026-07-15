import { describe, expect, it } from 'vitest';
import {
  buildPreviewSamplePlan,
  matchPreviewFrames,
  PREVIEW_MAX_FRAMES,
  type CompositionMeta,
  type PreviewSample,
} from '../src/render/composition-qa';

function meta(durationSec: number): CompositionMeta {
  return {
    htmlPath: '/tmp/x/index.html',
    html: '',
    rootAttrs: {},
    id: 'x',
    width: 1920,
    height: 1080,
    durationSec,
    audioTracks: [],
  };
}

const sceneMap = (scenes: unknown[]) => ({ scenes });

describe('buildPreviewSamplePlan', () => {
  it('captures the hook, each scene midpoint, and the payoff', () => {
    const plan = buildPreviewSamplePlan(meta(12), sceneMap([
      { id: 'intro', start: 0, duration: 4 },
      { id: 'body', start: 4, duration: 4 },
      { id: 'outro', start: 8, duration: 4 },
    ]));
    // Payoff lands on the last seekable tenth, never on the duration boundary.
    expect(plan.map((s) => s.timeSec)).toEqual([0, 2, 6, 10, 11.9]);
    expect(plan[0].label).toBe('hook-frame');
    expect(plan[plan.length - 1].label).toBe('payoff-frame');
  });

  it('reads scene_map fields in their alternate spellings', () => {
    const plan = buildPreviewSamplePlan(meta(10), sceneMap([{ id: 'a', start_sec: 0, duration_sec: 10 }]));
    expect(plan.some((s) => s.timeSec === 5)).toBe(true);
  });

  it('falls back to a midpoint when there is no scene map', () => {
    const plan = buildPreviewSamplePlan(meta(10), null);
    expect(plan.map((s) => s.timeSec)).toEqual([0, 5, 9.9]);
  });

  it('keeps hook and payoff while staying inside the frame budget', () => {
    const scenes = Array.from({ length: 30 }, (_, i) => ({ id: `s${i}`, start: i * 2, duration: 2 }));
    const plan = buildPreviewSamplePlan(meta(60), sceneMap(scenes));
    expect(plan.length).toBeLessThanOrEqual(PREVIEW_MAX_FRAMES);
    expect(plan[0].label).toBe('hook-frame');
    expect(plan[plan.length - 1].label).toBe('payoff-frame');
  });

  it('never seeks past the composition and dedupes collapsed times', () => {
    // Two scenes whose midpoints round to the same tenth must not produce two
    // captures — hyperframes would write one file for them.
    const plan = buildPreviewSamplePlan(meta(4), sceneMap([
      { id: 'a', start: 1.02, duration: 0.4 },
      { id: 'b', start: 1.04, duration: 0.4 },
    ]));
    expect(new Set(plan.map((s) => s.timeSec)).size).toBe(plan.length);
    for (const sample of plan) expect(sample.timeSec).toBeLessThan(4);
  });
});

describe('matchPreviewFrames', () => {
  const plan: PreviewSample[] = [
    { label: 'hook-frame', timeSec: 0 },
    { label: 'scene-a-mid', timeSec: 1.5 },
    { label: 'payoff-frame', timeSec: 3 },
  ];

  it('joins on the index prefix that hyperframes actually writes', () => {
    // Real shape observed from `hyperframes snapshot --at 0,1.5,3.0`.
    const matched = matchPreviewFrames(plan, [
      'frame-01-at-1.5s.png',
      'frame-00-at-0.0s.png',
      'contact-sheet.jpg',
      'frame-02-at-3.0s.png',
    ]);
    expect(matched.map((m) => m.file)).toEqual([
      'frame-00-at-0.0s.png',
      'frame-01-at-1.5s.png',
      'frame-02-at-3.0s.png',
    ]);
    expect(matched[0].label).toBe('hook-frame');
    expect(matched[2].time_seconds).toBe(3);
  });

  it('ignores stale frames left by a longer previous run', () => {
    const matched = matchPreviewFrames(plan, [
      'frame-00-at-0.0s.png',
      'frame-01-at-1.5s.png',
      'frame-02-at-3.0s.png',
      'frame-07-at-9.0s.png',
    ]);
    expect(matched).toHaveLength(3);
  });

  it('rejects look-alike names instead of mis-labelling them', () => {
    const matched = matchPreviewFrames(plan, [
      'frame-0-at-0.0s.jpg',
      'frame-at-0.0s.png',
      'my-frame-00-at-0.0s.png',
      'frame-00-at-0.0s.png.bak',
      'snapshot-00.png',
    ]);
    expect(matched).toEqual([]);
  });

  it('reports the frames that exist when a capture is missing', () => {
    const matched = matchPreviewFrames(plan, ['frame-00-at-0.0s.png', 'frame-02-at-3.0s.png']);
    expect(matched.map((m) => m.label)).toEqual(['hook-frame', 'payoff-frame']);
  });
});
