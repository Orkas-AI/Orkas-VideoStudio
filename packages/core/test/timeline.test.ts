import { describe, expect, it } from 'vitest';

import {
  buildTimelineSceneKey,
  captionCues,
  deriveVideoTimeline,
  dominantFlatShare,
  sheetLayoutFor,
  summarizeCheckWarnings,
  parseVideoManifest,
  timelineAudioTracks,
  validateVideoTimeline,
  type VideoAssetRecord,
  type VideoManifestV3,
  type VideoProduct,
} from '../src/composition/timeline-v3.js';

// One video is one array of scenes. These cases protect the promises the rest of
// the product leans on: reordering only moves array items, editing one scene's
// words touches only that scene, and text the user typed cannot become markup.

function video(overrides: Partial<VideoManifestV3> = {}): VideoManifestV3 {
  return {
    schema_version: 3,
    id: 'main',
    label: 'Lamp ad',
    canvas: { width: 1080, height: 1920, fps: 30 },
    scenes: [
      { id: 'hook', clips: [{ id: 'c1', asset: 'shot', in: 0, dur: 2 }], text: { headline: { value: 'No flicker' } } },
      { id: 'price', duration: 3, text: { amount: { value: '$19' }, headline: { value: 'Today only' } } },
    ],
    ...overrides,
  };
}

const ASSETS: VideoAssetRecord[] = [
  { id: 'shot', kind: 'video', label: 'Shot', path: 'assets/shot.mp4', origin: 'generated' },
  { id: 'photo', kind: 'image', label: 'Photo', path: 'assets/photo.jpg', origin: 'upload' },
  { id: 'song', kind: 'audio', label: 'Song', path: 'assets/song.mp3', origin: 'generated' },
  { id: 'voice', kind: 'audio', label: 'Voice', path: 'assets/voice.mp3', origin: 'generated' },
];

function codes(issues: Array<{ code: string; severity: string }>, severity = 'error'): string[] {
  return issues.filter((issue) => issue.severity === severity).map((issue) => issue.code);
}

function check(manifest: VideoManifestV3, extra: Partial<Parameters<typeof validateVideoTimeline>[0]> = {}): string[] {
  return codes(validateVideoTimeline({ manifest, assets: ASSETS, product: null, ...extra }));
}

describe('parseVideoManifest', () => {
  it('accepts the documented shape and rejects a misspelled field instead of ignoring it', () => {
    expect(parseVideoManifest(video()).manifest?.scenes).toHaveLength(2);
    const typo = video() as unknown as Record<string, unknown>;
    (typo.scenes as Array<Record<string, unknown>>)[1].durration = 3;
    const parsed = parseVideoManifest(typo);
    expect(parsed.manifest).toBeNull();
    expect(codes(parsed.issues)).toContain('TIMELINE_SCHEMA_INVALID');
  });

  it('rejects older schema versions so they go through the upgrader', () => {
    expect(parseVideoManifest({ ...video(), schema_version: 2 }).manifest).toBeNull();
  });
});

describe('deriveVideoTimeline', () => {
  it('derives start, length and total from array order alone', () => {
    const timeline = deriveVideoTimeline(video());
    expect(timeline.fps).toBe(30);
    expect(timeline.scenes.map((scene) => [scene.id, scene.startFrame, scene.frameCount])).toEqual([
      ['hook', 0, 60],
      ['price', 60, 90],
    ]);
    expect(timeline.totalFrames).toBe(150);
    expect(timeline.durationSec).toBe(5);
  });

  it('moves start times and nothing else when scenes are reordered', () => {
    const original = deriveVideoTimeline(video());
    const reordered = deriveVideoTimeline(video({ scenes: [...video().scenes].reverse() }));
    expect(reordered.scenes.map((scene) => [scene.id, scene.startFrame, scene.frameCount])).toEqual([
      ['price', 0, 90],
      ['hook', 90, 60],
    ]);
    expect(reordered.totalFrames).toBe(original.totalFrames);
  });

  it('plays sequential clips back to back without accumulating rounding drift', () => {
    const timeline = deriveVideoTimeline(video({
      scenes: [{
        id: 'long',
        clips: Array.from({ length: 7 }, (_item, index) => ({ id: `c${index}`, asset: 'shot', in: index, dur: 1.37 })),
      }],
    }));
    const [scene] = timeline.scenes;
    // 7 x 1.37s = 9.59s = 287.7 frames at 30fps; independent of per-clip rounding.
    expect(scene.frameCount).toBe(288);
    let cursor = 0;
    for (const clip of scene.clips) {
      expect(clip.startFrame).toBe(cursor);
      cursor += clip.frameCount;
    }
    expect(cursor).toBe(288);
  });

  it('keeps an overlay clip from lengthening its scene', () => {
    const timeline = deriveVideoTimeline(video({
      scenes: [{
        id: 'pip',
        clips: [
          { id: 'main-clip', asset: 'shot', in: 0, dur: 4 },
          { id: 'corner', asset: 'shot', in: 10, dur: 1, at: 2 },
        ],
      }],
    }));
    const [scene] = timeline.scenes;
    expect(scene.frameCount).toBe(120);
    expect(scene.clips.find((clip) => clip.id === 'corner')).toMatchObject({ startFrame: 60, frameCount: 30, overlay: true });
  });

  it('honours a requested frame rate over the declared one', () => {
    const timeline = deriveVideoTimeline(video(), 15);
    expect(timeline.fps).toBe(15);
    expect(timeline.totalFrames).toBe(75);
  });
});

describe('validateVideoTimeline', () => {
  it('rejects a sequential clip that cumulative frame rounding would erase', () => {
    const clips = [0, 1].map((n) => ({ id: `c${n}`, asset: 'shot', in: 0, dur: 0.02 }));
    const manifest = video({ scenes: [{ id: 'a', clips }] });
    expect(deriveVideoTimeline(manifest).scenes[0].clips.map(c => c.frameCount)).toEqual([1, 0]);
    expect(check(manifest)).toContain('TIMELINE_CLIP_TOO_SHORT');
    expect(check(video({ scenes: [{ id: 'a', clips: clips.map(c => ({ ...c, dur: 1 / 30 })) }] }))).toEqual([]);
  });

  it('applies the duration limit to rendered frames as well as nominal seconds', () => {
    const manifest = video({ canvas: { width: 1080, height: 1920, fps: 1 },
      scenes: Array.from({ length: 601 }, (_, n) => ({ id: `s${n}`, duration: 0.99 })) });
    expect(deriveVideoTimeline(manifest).durationSec).toBe(601);
    expect(check(manifest)).toContain('TIMELINE_TOO_LONG');
    expect(check({ ...manifest, scenes: manifest.scenes.slice(0, 600) })).toEqual([]);
  });

  it('passes a well-formed video', () => {
    expect(check(video())).toEqual([]);
  });

  it('accepts exactly the 600 second limit and rejects anything past it', () => {
    const at = video({ scenes: [{ id: 'a', duration: 600 }] });
    const over = video({ scenes: [{ id: 'a', duration: 600.5 }] });
    expect(check(at)).toEqual([]);
    expect(check(over)).toContain('TIMELINE_TOO_LONG');
  });

  it('requires a length for scenes without sequential clips and refuses a second source of length', () => {
    expect(check(video({ scenes: [{ id: 'a' }] }))).toContain('TIMELINE_SCENE_LENGTH_MISSING');
    expect(check(video({
      scenes: [{ id: 'a', duration: 2, clips: [{ id: 'c', asset: 'shot', in: 0, dur: 2 }] }],
    }))).toContain('TIMELINE_SCENE_LENGTH_CONFLICT');
    expect(check(video({
      scenes: [{ id: 'a', duration: 2, clips: [{ id: 'c', asset: 'shot', in: 0, dur: 1, at: 0 }] }],
    }))).toEqual([]);
  });

  it('refuses ids a page could not address unambiguously', () => {
    expect(check(video({
      scenes: [{ id: 'a', duration: 1 }, { id: 'a', duration: 1 }],
    }))).toContain('TIMELINE_SCENE_ID_DUPLICATE');
    expect(check(video({
      scenes: [
        { id: 'a', clips: [{ id: 'c', asset: 'shot', in: 0, dur: 1 }] },
        { id: 'b', clips: [{ id: 'c', asset: 'shot', in: 1, dur: 1 }] },
      ],
    }))).toContain('TIMELINE_CLIP_ID_DUPLICATE');
  });

  it('names unknown and unusable assets', () => {
    expect(check(video({
      scenes: [{ id: 'a', clips: [{ id: 'c', asset: 'nope', in: 0, dur: 1 }] }],
    }))).toContain('TIMELINE_ASSET_UNKNOWN');
    expect(check(video({
      scenes: [{ id: 'a', clips: [{ id: 'c', asset: 'song', in: 0, dur: 1 }] }],
    }))).toContain('TIMELINE_CLIP_NOT_VISUAL');
    expect(check(video({
      scenes: [{ id: 'a', duration: 1, narration: { text: 'Hi', asset: 'shot' } }],
    }))).toContain('TIMELINE_AUDIO_ASSET_NOT_AUDIO');
    expect(check(video({
      scenes: [{ id: 'a', duration: 1 }],
      tracks: [{ kind: 'music', asset: 'missing', volume: 0.3 }],
    }))).toContain('TIMELINE_ASSET_UNKNOWN');
  });

  it('checks clip ranges against the measured media at the boundary', () => {
    const manifest = (dur: number) => video({
      scenes: [{ id: 'a', clips: [{ id: 'c', asset: 'shot', in: 3, dur }] }],
    });
    const mediaDurations = new Map([['shot', 5]]);
    expect(check(manifest(2), { mediaDurations })).toEqual([]);
    expect(check(manifest(2.5), { mediaDurations })).toContain('TIMELINE_CLIP_PAST_MEDIA_END');
  });

  it('refuses a clip too short to occupy one frame', () => {
    expect(check(video({
      scenes: [{ id: 'a', clips: [{ id: 'c', asset: 'shot', in: 0, dur: 0.01 }] }],
    }))).toContain('TIMELINE_CLIP_TOO_SHORT');
  });

  it('refuses an overlay that runs past its scene', () => {
    expect(check(video({
      scenes: [{ id: 'a', duration: 2, clips: [{ id: 'c', asset: 'shot', in: 0, dur: 1.5, at: 1 }] }],
    }))).toContain('TIMELINE_OVERLAY_PAST_SCENE');
  });

  it('refuses a canvas the encoder cannot produce', () => {
    expect(check(video({ canvas: { width: 1081, height: 1920, fps: 30 } }))).toContain('TIMELINE_CANVAS_ODD');
  });

  it('refuses a price bound to a fact that does not exist', () => {
    const manifest = video({ scenes: [{ id: 'a', duration: 1, text: { amount: { fact_id: 'price' } } }] });
    const product: VideoProduct = { name: 'Lamp', facts: [{ id: 'price', text: '$19', source: 'user' }], images: [] };
    expect(check(manifest, { product })).toEqual([]);
    expect(check(manifest, { product: null })).toContain('TIMELINE_FACT_UNKNOWN');
  });

  it('warns when narration cannot fit in its scene instead of silently overlapping the next', () => {
    const manifest = video({
      scenes: [{ id: 'a', duration: 2, narration: { text: 'Hello', asset: 'voice' } }, { id: 'b', duration: 2 }],
    });
    const fits = validateVideoTimeline({ manifest, assets: ASSETS, product: null, mediaDurations: new Map([['voice', 2]]) });
    const over = validateVideoTimeline({ manifest, assets: ASSETS, product: null, mediaDurations: new Map([['voice', 2.6]]) });
    expect(codes(fits)).toEqual([]);
    expect(codes(over)).toContain('TIMELINE_NARRATION_OVERRUNS_SCENE');
  });

  // On 2026-11-07 a launch video cut 23–30s of the site's demo into one scene and 26–33s into the
  // next, so the same four seconds played twice in a row. Nothing said so.
  describe('the same footage in two scenes in a row', () => {
    const cut = (id: string, start: number, dur: number, asset = 'shot', at?: number) => ({ id, asset, in: start, dur, ...(at === undefined ? {} : { at }) });
    const pair = (first: ReturnType<typeof cut>, second: ReturnType<typeof cut>, between: VideoManifestV3['scenes'] = []) => video({
      scenes: [{ id: 'intro', clips: [first] }, ...between, { id: 'team', clips: [second] }],
    });
    const assets: VideoAssetRecord[] = [...ASSETS, { id: 'other-shot', kind: 'video', label: 'Other', path: 'assets/other.mp4', origin: 'page' }];
    const repeats = (manifest: VideoManifestV3) => validateVideoTimeline({ manifest, assets, product: null })
      .filter((issue) => issue.code === 'TIMELINE_ADJACENT_FOOTAGE_OVERLAP');

    it('warns, saying which scenes, which seconds and what to change, without blocking', () => {
      const manifest = pair(cut('a', 23, 7), cut('b', 26, 7));
      expect(repeats(manifest)).toEqual([expect.objectContaining({
        severity: 'warning',
        sceneId: 'team',
        message: 'Scenes "intro" and "team" both show 26.0–30.0s of "shot", so the same footage plays twice in a row. Move one of them to a part of the clip the other does not use, or use another clip.',
      })]);
      expect(check(manifest)).toEqual([]);
    });

    it('says nothing about cuts that only meet, or overlap by less than half a second', () => {
      expect(repeats(pair(cut('a', 23, 7), cut('b', 30, 7)))).toEqual([]);
      expect(repeats(pair(cut('a', 23, 7), cut('b', 29.6, 7)))).toEqual([]);
      expect(repeats(pair(cut('a', 23, 7), cut('b', 29.5, 7)))).toHaveLength(1);
    });

    it('leaves scenes apart, other clips and stills alone', () => {
      expect(repeats(pair(cut('a', 23, 7), cut('b', 26, 7), [{ id: 'logo', duration: 2 }]))).toEqual([]);
      expect(repeats(video({
        scenes: [{ id: 'intro', clips: [cut('a', 0, 4)] }, { id: 'team', clips: [{ id: 'b', asset: 'other-shot', in: 0, dur: 4 }] }],
      }))).toEqual([]);
      expect(repeats(pair(cut('a', 0, 3, 'photo'), cut('b', 0, 3, 'photo')))).toEqual([]);
    });

    it('counts a clip shown over the scene as footage too', () => {
      const manifest = video({
        scenes: [
          { id: 'intro', clips: [cut('a', 10, 4)] },
          { id: 'team', duration: 4, clips: [cut('b', 12, 2, 'shot', 1)] },
        ],
      });
      expect(repeats(manifest)).toHaveLength(1);
    });
  });
});

describe('buildTimelineSceneKey', () => {
  const key = (overrides: Partial<Parameters<typeof buildTimelineSceneKey>[0]> = {}) => buildTimelineSceneKey({
    subtree: '<section data-scene-id="a"></section>',
    motion: '',
    shared: '<html></html>',
    sceneAssetsSha256: 'scene-assets',
    sharedAssetsSha256: 'shared-assets',
    clips: [{ id: 'c', assetSha256: 'aaa', inSec: 1, startFrame: 0, frameCount: 30 }],
    captions: [],
    frameCount: 30,
    fps: 30,
    width: 1080,
    height: 1920,
    quality: 'high',
    format: 'mp4',
    ...overrides,
  });

  it.each([
    ['the words', { subtree: '<section data-scene-id="a">x</section>' }],
    ['the motion', { motion: 'tl.to()' }],
    ['the shared page', { shared: '<html>x</html>' }],
    ['a referenced image', { sceneAssetsSha256: 'other' }],
    ['the source file', { clips: [{ id: 'c', assetSha256: 'bbb', inSec: 1, startFrame: 0, frameCount: 30 }] }],
    ['the in point', { clips: [{ id: 'c', assetSha256: 'aaa', inSec: 2, startFrame: 0, frameCount: 30 }] }],
    ['the length', { frameCount: 31 }],
    ['the frame rate', { fps: 24 }],
    ['the canvas', { width: 720 }],
    ['the quality', { quality: 'draft' as const }],
    ['the captions', { captions: [{ fromFrame: 0, toFrame: 30, text: 'Hi' }] }],
  ])('changes with %s', (_label, overrides) => {
    expect(key(overrides)).not.toBe(key());
  });
});

describe('summarizeCheckWarnings', () => {
  it('separates repeated observations from located targets and retains one sampled measurement per example', () => {
    const first = [0, 0.5, 1].map(sampleTimeSec => ({
      code: 'LOW_CONTRAST', sceneId: 'opening', selector: '.title', message: 'Title contrast', sampleTimeSec,
      evidence: { contrast_ratio: sampleTimeSec === 0 ? 1.2 : 2.4, minimum_ratio: 4.5,
        rect: { left: 10, top: 20, width: 100, height: 30 }, canvas: { width: 1080, height: 1920 } },
    }));
    const second = [0, 0.5, 1].map(sampleTimeSec => ({
      code: 'LOW_CONTRAST', sceneId: 'opening', selector: '.caption', message: 'Caption contrast', sampleTimeSec,
      evidence: { contrast_ratio: 2.1, minimum_ratio: 4.5 },
    }));
    const [row] = summarizeCheckWarnings([...first, ...second]);
    expect(row).toMatchObject({ count: 6, target_count: 2, unlocated_count: 0 });
    expect(row.examples).toEqual([
      { scene_id: 'opening', selector: '.title', message: 'Title contrast', occurrences: 3, scene_time_sec: 0,
        evidence: { contrast_ratio: 1.2, minimum_ratio: 4.5, rect: { left: 10, top: 20, width: 100, height: 30 }, canvas: { width: 1080, height: 1920 } } },
      { scene_id: 'opening', selector: '.caption', message: 'Caption contrast', occurrences: 3, scene_time_sec: 0,
        evidence: { contrast_ratio: 2.1, minimum_ratio: 4.5 } },
    ]);
  });

  it('prioritizes another scene, preserves omitted target counts, and never merges equal selectors across scenes', () => {
    const rows = summarizeCheckWarnings([
      { code: 'FONT_TOO_SMALL', sceneId: 'a', selector: '.title', message: 'First' },
      { code: 'FONT_TOO_SMALL', sceneId: 'a', selector: '.caption', message: 'Second' },
      { code: 'FONT_TOO_SMALL', sceneId: 'b', selector: '.title', message: 'Third' },
      { code: 'FONT_TOO_SMALL', sceneId: 'a', selector: '.title', message: 'Repeated' },
    ]);
    expect(rows[0]).toMatchObject({ count: 4, target_count: 3, omitted_targets: 1 });
    expect(rows[0].examples).toEqual([
      expect.objectContaining({ scene_id: 'a', selector: '.title', occurrences: 2, message: 'First' }),
      expect.objectContaining({ scene_id: 'b', selector: '.title', occurrences: 1, message: 'Third' }),
    ]);
  });

  it('keeps unlocated observations explicit and bounds private or malformed evidence by code', () => {
    const [row] = summarizeCheckWarnings([
      { code: 'TEXT_OVERFLOW', message: 'No location' },
      { code: 'TEXT_OVERFLOW', sceneId: 'opening', selector: '.copy', message: 'Too wide', sampleTimeSec: 0.25,
        evidence: { overflow_pixels: { x: 18, y: 0, private: 'private-data' }, contrast_ratio: 1.2,
          rect: { left: -3, top: 20, width: 100, height: 30, private: 'private-data' },
          canvas: { width: 1080, height: 1920 }, private: 'private-data' } },
    ]);
    expect(row).toMatchObject({ count: 2, target_count: 1, unlocated_count: 1 });
    expect(row.examples[0]).not.toHaveProperty('occurrences');
    expect(row.examples[1]).toMatchObject({ scene_time_sec: 0.25, evidence: { overflow_pixels: { x: 18, y: 0 } } });
    expect(row.examples[1].evidence).not.toHaveProperty('contrast_ratio');
    expect(JSON.stringify(row)).not.toContain('private-data');
    for (const code of ['UNKNOWN', '__proto__', 'constructor', 'LOW_CONTRAST.lookalike']) {
      const [unknown] = summarizeCheckWarnings([{ code, message: 'Unknown', evidence: { contrast_ratio: 1, private: 'private-data' } }]);
      expect(unknown.examples[0]).not.toHaveProperty('evidence');
    }
  });

  it('counts full target identities before clipping display fields and keeps large reports bounded', () => {
    const warnings = Array.from({ length: 2000 }, (_, index) => ({
      code: 'FONT_TOO_SMALL', sceneId: `scene-${index % 20}`, selector: `${'p'.repeat(200)}-${index}`,
      message: 'x'.repeat(4000), sampleTimeSec: 1,
      evidence: { font_size_px: 12, minimum_px: 18, private: 'private-data' },
    }));
    const [row] = summarizeCheckWarnings(warnings);
    expect(row).toMatchObject({ count: 2000, target_count: 2000, omitted_targets: 1998 });
    expect(row.scenes).toHaveLength(12);
    expect(row.examples).toHaveLength(2);
    for (const example of row.examples) {
      expect(example.selector).toHaveLength(200);
      expect(example.message).toHaveLength(200);
      expect(example.evidence).toEqual({ font_size_px: 12, minimum_px: 18 });
    }
    expect(JSON.stringify(row).length).toBeLessThan(2000);
  });

  it.each([
    ['ELEMENT_OUT_OF_CANVAS', { overflow_pixels: { left: 12, right: 0, top: 0, bottom: 0 }, intersection_ratio: 0.9 }],
    ['SAFE_AREA_VIOLATION', { safe_area: { x: 54, y: 96 } }],
    ['TEXT_OCCLUDED', { overlap_area: 20, overlap_ratio: 0.5, other_selector: '.caption' }],
    ['TEXT_DENSITY_HIGH', { character_count: 200 }],
  ] as const)('retains the typed measurement for %s without adding another inspection', (code, evidence) => {
    const [row] = summarizeCheckWarnings([{ code, sceneId: 'a', selector: '.title', message: 'Finding', evidence }]);
    expect(row.examples[0].evidence).toEqual(evidence);
  });

  it('omits invalid measurement values without inventing zero or hiding a finding', () => {
    const [row] = summarizeCheckWarnings([{ code: 'FONT_TOO_SMALL', sceneId: 'a', selector: '.title', message: 'Small text',
      sampleTimeSec: Number.NaN, evidence: { font_size_px: Number.NaN, minimum_px: 18, rect: { left: -3, width: Number.POSITIVE_INFINITY } } }]);
    expect(row).toMatchObject({ count: 1, target_count: 1 });
    expect(row.examples[0]).not.toHaveProperty('scene_time_sec');
    expect(row.examples[0].evidence).toEqual({ minimum_px: 18, rect: { left: -3 } });
  });

  it('keeps one row per kind, with where it happens and an example or two', () => {
    const many = Array.from({ length: 30 }, (_item, index) => ({
      code: 'LOW_CONTRAST',
      sceneId: `scene-${index % 3}`,
      selector: `.line-${index}`,
      message: `Line ${index} is hard to read`,
    }));
    const rows = summarizeCheckWarnings([...many, { code: 'SCENE_STATIC', sceneId: 'hook', message: 'Still' }]);
    expect(rows.map((row) => [row.code, row.count])).toEqual([['LOW_CONTRAST', 30], ['SCENE_STATIC', 1]]);
    expect(rows[0].scenes).toEqual(['scene-0', 'scene-1', 'scene-2']);
    expect(rows[0].examples).toEqual([
      { scene_id: 'scene-0', selector: '.line-0', message: 'Line 0 is hard to read', occurrences: 1 },
      { scene_id: 'scene-1', selector: '.line-1', message: 'Line 1 is hard to read', occurrences: 1 },
    ]);
  });

  it('stays small however many findings a page raises', () => {
    const flood = Array.from({ length: 2000 }, (_item, index) => ({
      code: `CODE_${index % 8}`,
      sceneId: `scene-${index}`,
      message: 'x'.repeat(4000),
    }));
    expect(JSON.stringify(summarizeCheckWarnings(flood)).length).toBeLessThan(8000);
  });

  it('copes with a finding that belongs to no scene', () => {
    expect(summarizeCheckWarnings([{ code: 'PAGE', message: 'Whole page' }])).toEqual([
      { code: 'PAGE', count: 1, scenes: [], target_count: 0, unlocated_count: 1, examples: [{ message: 'Whole page' }] },
    ]);
  });
});

describe('sheetLayoutFor', () => {
  it('shapes the cell like the video, so a frame fills it', () => {
    expect(sheetLayoutFor(1080, 1920)).toEqual({ thumbWidth: 270, thumbHeight: 480, columns: 6 });
    expect(sheetLayoutFor(1920, 1080)).toEqual({ thumbWidth: 480, thumbHeight: 270, columns: 3 });
    expect(sheetLayoutFor(1080, 1080)).toEqual({ thumbWidth: 480, thumbHeight: 480, columns: 4 });
  });
});

describe('dominantFlatShare', () => {
  function bitmap(width: number, height: number, pixel: (x: number, y: number) => [number, number, number]): Uint8Array {
    const out = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const [b, g, r] = pixel(x, y);
        out.set([b, g, r, 255], (y * width + x) * 4);
      }
    }
    return out;
  }

  it('reads a blank frame as fully flat', () => {
    expect(dominantFlatShare(bitmap(10, 10, () => [240, 240, 240]), 10, 10)).toBe(1);
  });

  it('ignores noise on a flat background', () => {
    const noisy = bitmap(10, 10, (x, y) => [240 + ((x + y) % 2), 241, 240]);
    expect(dominantFlatShare(noisy, 10, 10)).toBe(1);
  });

  it('measures the part of the frame a picture leaves empty', () => {
    const halfEmpty = bitmap(10, 10, (x, y) => (y < 5 ? [240, 240, 240] : [x * 25, y * 25, (x + y) * 12]));
    expect(dominantFlatShare(halfEmpty, 10, 10)).toBeCloseTo(0.5, 1);
  });

  it('does not call a varied picture empty', () => {
    const photo = bitmap(16, 16, (x, y) => [x * 16, y * 16, (x * y) % 256]);
    expect(dominantFlatShare(photo, 16, 16)).toBeLessThan(0.1);
  });
});

describe('captionCues', () => {
  it('splits on sentence punctuation and shares time by length', () => {
    const cues = captionCues('今天聊视频。开头三秒最重要！', 6);
    expect(cues.map((cue) => cue.text)).toEqual(['今天聊视频', '开头三秒最重要']);
    expect(cues[0].startSec).toBe(0);
    expect(cues[0].endSec).toBeCloseTo(6 * 5 / 12, 2);
    expect(cues[1].endSec).toBe(6);
  });

  it('breaks a long line at a comma before it ever cuts a word', () => {
    const cues = captionCues('This lamp has no flicker at all, three colour temperatures, and a wireless charging base.', 9);
    for (const cue of cues) {
      expect(cue.text.length).toBeLessThanOrEqual(42);
      expect(cue.text).toMatch(/^\S/);
    }
    expect(cues.map((cue) => cue.text).join(' ')).toContain('three colour temperatures');
  });

  it('breaks an unpunctuated long run by display width without losing characters', () => {
    const text = '这是一段没有任何标点的很长很长很长很长很长很长很长很长很长很长的字幕内容';
    const cues = captionCues(text, 8);
    expect(cues.length).toBeGreaterThan(1);
    expect(cues.map((cue) => cue.text).join('')).toBe(text);
    for (const cue of cues) expect(cue.text.length).toBeLessThanOrEqual(21);
  });

  it('keeps cues contiguous across the whole span', () => {
    const cues = captionCues('One. Two. Three.', 3);
    expect(cues[0].startSec).toBe(0);
    for (let index = 1; index < cues.length; index += 1) {
      expect(cues[index].startSec).toBe(cues[index - 1].endSec);
    }
    expect(cues.at(-1)?.endSec).toBe(3);
  });

  it('has nothing to show for empty text or no time', () => {
    expect(captionCues('   ', 3)).toEqual([]);
    expect(captionCues('Hello', 0)).toEqual([]);
  });
});

describe('timelineAudioTracks', () => {
  const resolve = (assetId: string) => `/abs/${assetId}`;

  it('places narration at its scene wherever the scene moved to', () => {
    const scenes: VideoManifestV3['scenes'] = [
      { id: 'a', duration: 2, narration: { text: 'First', asset: 'voice' } },
      { id: 'b', duration: 3 },
    ];
    const forward = deriveVideoTimeline(video({ scenes }));
    expect(timelineAudioTracks({ manifest: video({ scenes }), timeline: forward, resolve })).toEqual([
      expect.objectContaining({ absPath: '/abs/voice', startSec: 0, voice: true }),
    ]);
    const moved = video({ scenes: [...scenes].reverse() });
    expect(timelineAudioTracks({ manifest: moved, timeline: deriveVideoTimeline(moved), resolve })).toEqual([
      expect.objectContaining({ absPath: '/abs/voice', startSec: 3, voice: true }),
    ]);
  });

  it('keeps a clip\'s own sound only when asked, from its in point, for its length', () => {
    const manifest = video({
      scenes: [
        { id: 'a', duration: 1 },
        {
          id: 'b',
          clips: [
            { id: 'quiet', asset: 'shot', in: 5, dur: 1 },
            { id: 'loud', asset: 'shot', in: 7, dur: 2, audio: 'keep', volume: 0.8 },
          ],
        },
      ],
    });
    expect(timelineAudioTracks({ manifest, timeline: deriveVideoTimeline(manifest), resolve })).toEqual([
      expect.objectContaining({ absPath: '/abs/shot', startSec: 2, inSec: 7, durSec: 2, volume: 0.8, voice: true }),
    ]);
  });

  it('carries whole-video tracks with their fades and ducking', () => {
    const manifest = video({
      tracks: [{ kind: 'music', asset: 'song', volume: 0.4, fade_in: 1, fade_out: 2, duck: true }],
    });
    expect(timelineAudioTracks({ manifest, timeline: deriveVideoTimeline(manifest), resolve })).toEqual([
      expect.objectContaining({
        absPath: '/abs/song', startSec: 0, volume: 0.4, fadeInSec: 1, fadeOutSec: 2, duck: true,
      }),
    ]);
  });

  it('loops background music while narration and sound effects play once', () => {
    const manifest = video({ tracks: [
      { kind: 'music', asset: 'song', volume: 0.4 },
      { kind: 'narration', asset: 'voice', volume: 1 },
      { kind: 'sfx', asset: 'effect', volume: 1 },
    ] });
    const tracks = timelineAudioTracks({ manifest, timeline: deriveVideoTimeline(manifest), resolve });
    expect(tracks[0]).toMatchObject({ absPath: '/abs/song', loop: true });
    expect(tracks[1].loop).not.toBe(true);
    expect(tracks[2].loop).not.toBe(true);
  });

  it('treats an upgraded whole narration track as voice so music still ducks under it', () => {
    const manifest = video({ tracks: [{ kind: 'narration', asset: 'voice', volume: 1 }] });
    expect(timelineAudioTracks({ manifest, timeline: deriveVideoTimeline(manifest), resolve })[0]).toMatchObject({ voice: true });
  });
});

