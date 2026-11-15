import { describe, expect, it } from 'vitest';

import {
  buildTimelineSceneKey,
  captionCues,
  compileVideoPage,
  deriveVideoTimeline,
  dominantFlatShare,
  pagePictureIssues,
  pagePictureRefs,
  sheetLayoutFor,
  summarizeCheckWarnings,
  parseVideoManifest,
  timelineAudioTracks,
  validateVideoTimeline,
  type VideoAssetRecord,
  type VideoManifestV3,
  type VideoProduct,
} from '../src/composition/index.js';

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

const PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>h1 { color: white; }</style>
</head>
<body>
  <main data-composition-id="main" data-width="1080" data-height="1920">
    <section data-scene-id="hook">
      <img data-clip="c1" style="width: 50%" alt="" />
      <h1 data-slot="headline">placeholder</h1>
    </section>
    <section data-scene-id='price'>
      <div data-slot='amount'><span>old</span><div>nested</div></div>
      <p data-slot="headline">not the hook headline</p>
    </section>
  </main>
  <script>
    window.__timelines = {};
    const note = '<h1 data-slot="headline">string in a script</h1>';
    // ORKAS-SCENE-MOTION-BEGIN:hook
    window.__timelines.hook = gsap.timeline({ paused: true });
    // ORKAS-SCENE-MOTION-END:hook
    // ORKAS-SCENE-MOTION-BEGIN:price
    window.__timelines.price = gsap.timeline({ paused: true });
    // ORKAS-SCENE-MOTION-END:price
  </script>
</body>
</html>`;

function compile(manifest: VideoManifestV3 = video(), html: string | null = PAGE, product: VideoProduct | null = null) {
  return compileVideoPage({ html, manifest, product, baseHref: 'file:///project/videos/main/' });
}

describe('compileVideoPage', () => {
  it('writes each scene\'s text into that scene\'s slots only', () => {
    const manifest = video({
      scenes: [
        { id: 'hook', clips: [{ id: 'c1', asset: 'shot', in: 0, dur: 2 }], text: { headline: { value: 'No flicker' } } },
        { id: 'price', duration: 3, text: { amount: { value: '$19' }, headline: { value: 'Today only' } } },
      ],
    });
    const { html, issues } = compile(manifest);
    expect(codes(issues)).toEqual([]);
    expect(html).toContain('<h1 data-slot="headline">No flicker</h1>');
    expect(html).toContain('<p data-slot="headline">Today only</p>');
    expect(html).toContain("<div data-slot='amount'>$19</div>");
    expect(html).not.toContain('nested');
  });

  it('leaves look-alikes in scripts and comments alone', () => {
    const { html } = compile();
    expect(html).toContain(`const note = '<h1 data-slot="headline">string in a script</h1>';`);
    const commented = PAGE.replace(
      '<h1 data-slot="headline">placeholder</h1>',
      '<!-- <h1 data-slot="headline">old copy</h1> --><h1 data-slot="headline">placeholder</h1>',
    );
    const out = compile(video(), commented).html;
    expect(out).toContain('<!-- <h1 data-slot="headline">old copy</h1> -->');
    expect(out).toContain('<h1 data-slot="headline">No flicker</h1>');
  });

  it('never lets typed text become markup', () => {
    const hostile = '</h1><script>alert(1)</script><img src=x onerror=alert(2)>&"\'';
    const { html } = compile(video({
      scenes: [
        { id: 'hook', clips: [{ id: 'c1', asset: 'shot', in: 0, dur: 2 }], text: { headline: { value: hostile } } },
        { id: 'price', duration: 3, text: { amount: { value: '$19' }, headline: { value: 'Today only' } } },
      ],
    }));
    expect(html).not.toContain('<script>alert(1)');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;/h1&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('survives replacement patterns in typed text', () => {
    const { html } = compile(video({
      scenes: [
        { id: 'hook', clips: [{ id: 'c1', asset: 'shot', in: 0, dur: 2 }], text: { headline: { value: "Save $& and $' today" } } },
        { id: 'price', duration: 3, text: { amount: { value: '$1' } } },
      ],
    }));
    expect(html).toContain("Save $&amp; and $' today");
    expect(html).toContain("<div data-slot='amount'>$1</div>");
  });

  it('resolves a bound price from the product facts', () => {
    const product: VideoProduct = { name: 'Lamp', facts: [{ id: 'price', text: '$29', source: 'user' }], images: [] };
    const { html } = compile(video({
      scenes: [
        { id: 'hook', clips: [{ id: 'c1', asset: 'shot', in: 0, dur: 2 }], text: { headline: { value: 'x' } } },
        { id: 'price', duration: 3, text: { amount: { fact_id: 'price' } } },
      ],
    }), PAGE, product);
    expect(html).toContain("<div data-slot='amount'>$29</div>");
  });

  it('reports a slot with no text, and text with no slot, by name', () => {
    const missing = compile(video({
      scenes: [
        { id: 'hook', clips: [{ id: 'c1', asset: 'shot', in: 0, dur: 2 }] },
        { id: 'price', duration: 3, text: { amount: { value: '$19' }, nope: { value: 'x' } } },
      ],
    }));
    expect(missing.issues.find((issue) => issue.code === 'PAGE_SLOT_UNFILLED')).toMatchObject({ severity: 'error', sceneId: 'hook' });
    expect(missing.issues.find((issue) => issue.code === 'PAGE_SLOT_MISSING')).toMatchObject({ severity: 'error', sceneId: 'price' });
  });


  it('fills the frame with a clip the page did not place, behind the page content', () => {
    const noPlacement = PAGE.replace('<img data-clip="c1" style="width: 50%" alt="" />', '');
    const { html, issues } = compile(video(), noPlacement);
    expect(codes(issues)).toEqual([]);
    expect(html).toMatch(/<img data-clip="c1" class="orkas-fill"/);
  });

  it('keeps a clip the page placed and does not add a second one', () => {
    const { html } = compile();
    expect(html.match(/data-clip="c1"/g)).toHaveLength(1);
    expect(html).toContain('<img data-clip="c1" style="width: 50%" alt="" />');
  });

  it('builds a full-frame section for a clip-only scene the page does not mention', () => {
    const { html, issues } = compile(video({
      scenes: [
        { id: 'hook', clips: [{ id: 'c1', asset: 'shot', in: 0, dur: 2 }], text: { headline: { value: 'x' } } },
        { id: 'broll', clips: [{ id: 'c2', asset: 'shot', in: 5, dur: 2 }] },
        { id: 'price', duration: 3, text: { amount: { value: '$19' }, headline: { value: 'Today only' } } },
      ],
    }));
    expect(codes(issues)).toEqual([]);
    expect(html).toMatch(/<section data-scene-id="broll"[^>]*><img data-clip="c2" class="orkas-fill"/);
  });

  it('needs no page at all when every scene is only clips', () => {
    const { html, issues } = compile(video({
      scenes: [{ id: 'broll', clips: [{ id: 'c2', asset: 'shot', in: 5, dur: 2 }] }],
    }), null);
    expect(codes(issues)).toEqual([]);
    expect(html).toContain('data-composition-id="main"');
    expect(html).toContain('data-clip="c2"');
  });

  it('refuses a text-only scene the page does not mention', () => {
    expect(codes(compile(video({
      scenes: [{ id: 'gone', duration: 1 }],
    })).issues)).toContain('PAGE_SCENE_MISSING');
  });

  it('keeps resource resolution under the HyperFrames project instead of injecting a file URL base', () => {
    const { html } = compile();
    expect(html).not.toContain('<base ');
    expect(html).not.toContain('file:///project');
    expect(html).toContain('<style data-orkas-host>');
  });

  it('adds a caption layer only to narrated scenes when captions are on', () => {
    const scenes: VideoManifestV3['scenes'] = [
      { id: 'hook', clips: [{ id: 'c1', asset: 'shot', in: 0, dur: 2 }], text: { headline: { value: 'x' } }, narration: { text: 'Hello there.' } },
      { id: 'price', duration: 3, text: { amount: { value: '$19' }, headline: { value: 'Today only' } } },
    ];
    const off = compile(video({ scenes }));
    expect(off.html).not.toContain('data-orkas-caption');
    const on = compile(video({ scenes, captions: { enabled: true } }));
    expect(on.scenes.hook.subtree).toContain('data-orkas-caption');
    expect(on.scenes.price.subtree).not.toContain('data-orkas-caption');
  });

  it('attributes every byte of the page to one scene or to the shared surface', () => {
    const base = compile();
    const editedText = compile(video({
      scenes: [
        { id: 'hook', clips: [{ id: 'c1', asset: 'shot', in: 0, dur: 2 }], text: { headline: { value: 'Different' } } },
        { id: 'price', duration: 3, text: { amount: { value: '$19' }, headline: { value: 'Today only' } } },
      ],
    }));
    expect(editedText.scenes.hook.subtree).not.toBe(base.scenes.hook.subtree);
    expect(editedText.scenes.price.subtree).toBe(base.scenes.price.subtree);
    expect(editedText.shared).toBe(base.shared);

    const editedCss = compile(video(), PAGE.replace('color: white', 'color: black'));
    expect(editedCss.shared).not.toBe(base.shared);
    expect(editedCss.scenes.hook.subtree).toBe(base.scenes.hook.subtree);

    const editedMotion = compile(video(), PAGE.replace(
      'window.__timelines.price = gsap.timeline({ paused: true });',
      'window.__timelines.price = gsap.timeline({ paused: true }).to("h1", { x: 1 });',
    ));
    expect(editedMotion.scenes.price.motion).not.toBe(base.scenes.price.motion);
    expect(editedMotion.scenes.hook.motion).toBe(base.scenes.hook.motion);
    expect(editedMotion.shared).toBe(base.shared);
  });

  it('keeps the other scenes\' identity when a scene is taken off the timeline', () => {
    const base = compile();
    const without = compile(video({ scenes: video().scenes.filter((scene) => scene.id !== 'price') }));

    // Their cached segments stay valid, because nothing they depend on changed.
    expect(without.shared).toBe(base.shared);
    expect(without.scenes.hook).toEqual(base.scenes.hook);
    expect(without.scenes.price).toBeUndefined();
    // The page itself still holds it, for the renderer to hide.
    expect(without.html).toContain('data-scene-id=\'price\'');
    expect(without.issues).toEqual([]);
  });

  it('does not let the project location change the identity of the page', () => {
    const here = compileVideoPage({ html: PAGE, manifest: video(), product: null, baseHref: 'file:///a/' });
    const there = compileVideoPage({ html: PAGE, manifest: video(), product: null, baseHref: 'file:///b/c/' });
    expect(here.shared).toBe(there.shared);
    expect(here.scenes.hook.subtree).toBe(there.scenes.hook.subtree);
  });
});

describe('pictures a page places by file', () => {
  // On 2026-11-07 a launch video showed two site screenshots in a scene through <img src>,
  // so the canvas, which reads pictures from clips, drew no line to them and could not
  // keep them or swap them.
  const production = '/work/launch';
  const videoDir = `${production}/videos/main`;
  const rows: VideoAssetRecord[] = [
    { id: 'shot', kind: 'video', label: 'Shot', path: 'assets/shot.mp4', origin: 'generated' },
    { id: 'r18', kind: 'image', label: 'Site', path: 'videos/main/assets/product/image-r18.png', origin: 'page' },
    { id: 'r13', kind: 'image', label: 'Site', path: 'videos/main/assets/product/image r13.png', origin: 'page' },
    { id: 'logo', kind: 'image', label: 'Logo', path: 'videos/main/assets/logo.png', origin: 'upload' },
    { id: 'old', kind: 'image', label: 'Old', path: 'videos/main/assets/old.png', origin: 'upload' },
    { id: 'voice', kind: 'audio', label: 'Voice', path: 'videos/main/assets/voice.mp3', origin: 'generated' },
  ];
  const manifest = video({ scenes: [
    { id: 'hook', clips: [{ id: 'c1', asset: 'shot', in: 0, dur: 2 }] },
    { id: 'memory', duration: 3 },
  ] });
  // Each look-alike in "memory" points somewhere else: another site, another folder, a sound.
  const PAGE = `<!doctype html><html><head></head><body><main data-composition-id="main">
<img class="logo" src="assets/logo.png">
<section data-scene-id="hook"><img data-clip="c1"></section>
<section data-scene-id="memory">
  <img class="shot one" src="assets/product/image-r18.png">
  <div style="background-image: url('./assets/product/image%20r13.png')"></div>
  <img src="assets/product/image-r18.png?v=2">
  <img src="https://example.com/videos/main/assets/product/image-r18.png">
  <img src="other/image-r18.png">
  <img src="assets/voice.mp3">
</section>
<section data-scene-id="cut"><img src="./assets/old.png"></section>
</main></body></html>`;
  const refsOf = (m: VideoManifestV3) => pagePictureRefs({
    compiled: compileVideoPage({ html: PAGE, manifest: m, product: null, baseHref: `file://${videoDir}/` }),
    assets: rows,
    videoDirAbs: videoDir,
    productionDirAbs: production,
  });
  const fix = 'show it with <img data-clip="id">.';

  it('finds what each scene on the timeline shows by file, and what the page shows around them', () => {
    expect(refsOf(manifest)).toEqual({ shared: ['logo'], scenes: { hook: [], memory: ['r18', 'r13'] } });
    // The scene off the timeline counts once it is back on.
    const restored = video({ scenes: [...manifest.scenes, { id: 'cut', duration: 1 }] });
    expect(refsOf(restored).scenes.cut).toEqual(['old']);
  });

  it('warns once for each scene that does, naming its pictures, and not for the page around them', () => {
    expect(pagePictureIssues(manifest, refsOf(manifest))).toEqual([{
      code: 'PAGE_PICTURE_NOT_A_CLIP',
      severity: 'warning',
      message: 'Scene "memory" places "r18" and "r13" from assets.json straight in its page markup, so the canvas cannot show or swap them. Add each to the scene\'s "clips" and show it with <img data-clip="id">.',
      selector: '[data-scene-id="memory"]',
      source: 'orkas-video-timeline',
      sceneId: 'memory',
    }]);
    expect(pagePictureIssues(manifest, { shared: [], scenes: { memory: ['r18'] } })[0].message).toBe(
      'Scene "memory" places "r18" from assets.json straight in its page markup, so the canvas cannot show or swap it. Add it to the scene\'s "clips" and show it with <img data-clip="id">.',
    );
    expect(pagePictureIssues(manifest, { shared: ['logo'], scenes: { hook: [], memory: [] } })).toEqual([]);
  });

  it('names only as many as leave the fix whole in the reported message', () => {
    const ids = (count: number, length: number) => Array.from({ length: count }, (_, i) => String(i).padStart(length, 'p'));
    // What the model reads is the check's summary, which shortens each message.
    const reported = (memory: string[]) => summarizeCheckWarnings(pagePictureIssues(manifest, { shared: [], scenes: { memory } }))[0].examples[0].message;

    const short = reported(ids(7, 2));
    expect(short).toMatch(/places "p0", "p1"(, "p\d")* and [2-5] more from assets\.json/);
    expect(short.endsWith(fix)).toBe(true);
    const longer = reported(ids(7, 8));
    expect(longer).toContain('places "ppppppp0" and 6 more from assets.json');
    expect(longer.endsWith(fix)).toBe(true);
    // A name that alone would push the fix off is left out, and the count stands in.
    const longest = reported(ids(7, 40));
    expect(longest).toContain('places 7 pictures from assets.json');
    expect(longest.endsWith(fix)).toBe(true);
    expect(reported(ids(1, 40))).toContain('places a picture from assets.json straight in its page markup, so the canvas cannot show or swap it. Add it');
  });
});
