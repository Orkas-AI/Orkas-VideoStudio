import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { resolveFfmpegTools } from '@orkas/video-studio-core';
import * as renderTool from '../src/render/render.js';
import * as timelineTool from '../src/composition/timeline.js';
import { checkTimeline, renderTimeline } from '../src/composition/timeline-actions.js';
import { importTimelineAssets, prepareTimeline } from '../src/composition/timeline.js';
import { importedScreensMessage } from '../src/composition/screens.js';
const roots: string[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const p of roots.splice(0)) rmSync(p, { recursive: true, force: true }); });
function setup() {
  const production = mkdtempSync(join(tmpdir(), 'ovs-timeline-')); roots.push(production);
  mkdirSync(join(production, 'videos/main'), { recursive: true });
  const manifest = { schema_version: 3, id: 'main', label: 'Example', canvas: { width: 640, height: 360, fps: 30 }, scenes: [
    { id: 'first', duration: 2, text: { title: { value: 'A <literal> title' } } },
    { id: 'second', duration: 3, text: { title: { value: 'Closing' } } },
  ] };
  writeFileSync(join(production, 'videos/main/manifest.json'), JSON.stringify(manifest));
  writeFileSync(join(production, 'assets.json'), '{"assets":[]}');
  return { production, manifest, project: join(production, 'videos/main') };
}
describe('manifest v3 HyperFrames bridge', () => {
  it('keeps images visible in their scene after preparation and scene reordering', async () => {
    const { production, project } = setup();
    writeFileSync(join(production, 'photo.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=', 'base64'));
    writeFileSync(join(production, 'assets.json'), JSON.stringify({ assets: [{ id: 'photo', kind: 'image', label: 'Photo', path: 'photo.png', origin: 'upload' }] }));
    const manifest = { schema_version: 3, id: 'main', label: 'Photos', canvas: { width: 640, height: 360, fps: 30 }, scenes: ['first', 'second'].map(id => ({ id, clips: [{ id: `${id}-photo`, asset: 'photo', in: 0, dur: 1 }] })) };
    writeFileSync(join(project, 'manifest.json'), JSON.stringify(manifest));
    for (let pass = 0; pass < 3; pass++) {
      expect((await prepareTimeline({ production })).ok).toBe(true);
      const images = [...readFileSync(join(project, 'index.html'), 'utf8').matchAll(/<img\b[^>]*data-clip="[^"]+"[^>]*>/g)].map(match => match[0]);
      expect(images).toHaveLength(2);
      // HyperFrames resolves image starts relative to the containing scene.
      for (const image of images) {
        expect(image).toContain('data-start="0"');
        expect(image.match(/class="([^"]*)"/)![1].trim().split(/\s+/).filter(name => name === 'clip')).toHaveLength(1);
      }
      // Its flat contract validator must not confuse equal local image times
      // in different scenes with overlapping clips on one global track.
      expect(new Set(images.map(image => image.match(/data-track-index="([^"]*)"/)![1])).size).toBe(2);
      manifest.scenes.reverse();
      writeFileSync(join(project, 'manifest.json'), JSON.stringify(manifest));
    }
  });
  it('prepares declarative timing and keeps authored visual decisions when scenes move', async () => {
    const { production, project, manifest } = setup();
    expect((await prepareTimeline({ production })).ok).toBe(true);
    let html = readFileSync(join(project, 'index.html'), 'utf8');
    expect(html).toContain('A &lt;literal&gt; title');
    html = html.replace('</head>', '<style>.authored { color: coral; }</style></head>');
    writeFileSync(join(project, 'index.html'), html);
    manifest.scenes.reverse();
    writeFileSync(join(project, 'manifest.json'), JSON.stringify(manifest));
    expect((await prepareTimeline({ production })).ok).toBe(true);
    const updated = readFileSync(join(project, 'index.html'), 'utf8');
    expect(updated).toContain('.authored { color: coral; }');
    expect(updated).toMatch(/data-scene-id="first"[^>]*data-start="3"/);
    expect(updated).toMatch(/data-scene-id="second"[^>]*data-start="0"/);
    expect(updated).not.toMatch(/\.currentTime\s*=|requestAnimationFrame/);
  });
  it('executes scene scripts after repeated preparation when a scene shares the root id', async () => {
    const { production, project, manifest } = setup();
    manifest.scenes[0].id = 'main';
    writeFileSync(join(project, 'manifest.json'), JSON.stringify(manifest));
    await prepareTimeline({ production });
    let authored = readFileSync(join(project, 'index.html'), 'utf8');
    authored = authored.replace('</body>', `<script>${manifest.scenes.map(scene => `// ORKAS-SCENE-MOTION-BEGIN:${scene.id}\nwindow.__timelines[${JSON.stringify(scene.id)}]=gsap.timeline({paused:true}).to({}, {duration:1});\n// ORKAS-SCENE-MOTION-END:${scene.id}`).join('\n')}</script></body>`);
    writeFileSync(join(project, 'index.html'), authored);
    await prepareTimeline({ production });
    await prepareTimeline({ production });
    const html = readFileSync(join(project, 'index.html'), 'utf8');
    const window: Record<string, any> = {};
    const timeline = () => {
      const value: any = { children: [] };
      for (const method of ['to', 'fromTo', 'set', 'from', 'paused']) value[method] = () => value;
      value.add = (child: unknown, time: number) => { value.children.push({ child, time }); return value; };
      return value;
    };
    for (const script of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) {
      if (script[1].includes('ORKAS-SCENE-MOTION') || script[1].includes('const master=')) runInNewContext(script[1], { window, gsap: { timeline } });
    }
    const registry = window.__timelines;
    expect(registry.main).not.toBe(registry['ovs-scene-main-main']);
    expect(registry.main.children.map((item: any) => item.time)).toEqual([0, 2]);
    expect(registry.main.children[0].child).toBe(registry['ovs-scene-main-main']);
    expect(registry.main.children[1].child).toBe(registry['ovs-scene-main-second']);
  });
  it('does not turn a failed runtime check into a successful timeline check', async () => {
    const { production } = setup();
    const runtime = vi.spyOn(renderTool, 'check').mockResolvedValue({ ok: false, errors: [{ code: 'SCRIPT_RUNTIME_ERROR', message: 'The scene script failed.' }] });
    const result = await checkTimeline({ production });
    expect(runtime).toHaveBeenCalledOnce(); expect(result.ok).toBe(false);
  });

  it('rejects project changes between preparation and render admission', async () => {
    const { production, project, manifest } = setup();
    const original = timelineTool.prepareTimeline;
    vi.spyOn(timelineTool, 'prepareTimeline').mockImplementation(async p => {
      const prepared = await original(p);
      manifest.scenes[0].text.title.value = 'A different promise';
      writeFileSync(join(project, 'manifest.json'), JSON.stringify(manifest));
      return prepared;
    });
    const renderer = vi.spyOn(renderTool, 'render').mockRejectedValue(new Error('The renderer must not start'));
    await expect(renderTimeline({ production, output: join(production, 'result.mp4') })).rejects.toThrow(/changed.*prepar|prepar.*changed/i);
    expect(renderer).not.toHaveBeenCalled();
  });

  it('refuses to replace an independently authored legacy manifest', async () => {
    const { production, project } = setup();
    writeFileSync(join(project, 'composition-manifest.json'), '{"owned":"by-user"}');
    await expect(prepareTimeline({ production })).rejects.toThrow(/existing legacy manifest/);
    expect(readFileSync(join(project, 'composition-manifest.json'), 'utf8')).toBe('{"owned":"by-user"}');
  });
  it('imports source bytes into new owned paths and retains the original attachment', async () => {
    const { production } = setup();
    const source = join(production, 'source.png');
    const bytes = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex');
    writeFileSync(source, bytes);
    const result = await importTimelineAssets({ production, inputs: [source] });
    expect(result.assets).toHaveLength(1);
    expect(readFileSync(join(production, result.assets[0].path))).toEqual(bytes);
    expect(readFileSync(source)).toEqual(bytes);
    expect(result.assets[0].sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(readFileSync(join(production, 'assets.json'), 'utf8')).assets).toHaveLength(1);
  });
  it('imports Chinese filenames as usable IDs and keeps older imported IDs usable', async () => {
    const { production, project, manifest } = setup();
    const label = '咖啡店-门口.png';
    const source = join(production, label);
    await sharp({ create: { width: 16, height: 16, channels: 3, background: 'red' } }).png().toFile(source);
    writeFileSync(join(production, 'assets.json'), JSON.stringify({
      assets: [{ id: '----deadbeef', kind: 'image', label: '旧素材.png', path: label, origin: 'upload' }],
    }));

    const imported = await importTimelineAssets({ production, inputs: [source] });
    expect(imported.assets[0].id).toMatch(/^[A-Za-z0-9][A-Za-z0-9_-]*$/);
    expect(imported.assets[0].label).toBe(label);
    const ids = ['----deadbeef', imported.assets[0].id];
    const scenes = ids.map((asset, index) => ({ id: `scene-${index}`, clips: [{ id: `clip-${index}`, asset, in: 0, dur: 2 }] }));
    writeFileSync(join(project, 'manifest.json'), JSON.stringify({ ...manifest, scenes }));
    expect((await prepareTimeline({ production })).ok).toBe(true);
  });

  it('keeps authored motion and deactivates a removed scene without erasing its design', async () => {
    const { production, project, manifest } = setup();
    await prepareTimeline({ production });
    manifest.scenes.pop();
    writeFileSync(join(project, 'manifest.json'), JSON.stringify(manifest));
    await prepareTimeline({ production });
    const html = readFileSync(join(project, 'index.html'), 'utf8');
    expect(html).toMatch(/const master=window\.__timelines/);
    expect(html).toMatch(/data-scene-id="second"[^>]*data-orkas-hidden/);
    expect(html).toContain('tl.fromTo(');
  });
  it('rolls back a partially failed asset import and leaves the ledger unchanged', async () => {
    const { production } = setup();
    const source = join(production, 'source.png');
    writeFileSync(source, 'image');
    await expect(importTimelineAssets({ production, inputs: [source, join(production, 'missing.mp4')] })).rejects.toThrow();
    expect(JSON.parse(readFileSync(join(production, 'assets.json'), 'utf8')).assets).toEqual([]);
    const { readdirSync } = await import('node:fs');
    expect(readdirSync(join(production, 'media'))).toEqual([]);
    expect(readFileSync(source, 'utf8')).toBe('image');
  });

});

const ffmpegBin = () => resolveFfmpegTools().ffmpeg;
function ff(args: string[]): Buffer {
  const run = spawnSync(ffmpegBin(), ['-v', 'error', '-nostdin', '-y', ...args], { timeout: 60_000, maxBuffer: 64 * 1024 * 1024 });
  expect(run.status, String(run.stderr)).toBe(0);
  return run.stdout;
}
function writeManifest(project: string, manifest: Record<string, unknown>) {
  writeFileSync(join(project, 'manifest.json'), JSON.stringify({ schema_version: 3, id: 'main', label: 'Example', canvas: { width: 640, height: 360, fps: 30 }, ...manifest }));
}
const text = (value: string) => ({ title: { value } });
/** The mix prepare wrote for the HyperFrames page. */
function preparedMix(project: string): string {
  const legacy = JSON.parse(readFileSync(join(project, 'composition-manifest.json'), 'utf8'));
  return join(project, legacy.audio.tracks[0].src);
}

describe('a narrated video that would go silent', () => {
  // 2026-11-17: explainers made without a requested length voiced their first scenes,
  // rendered the rest silent and found out only at delivery.
  function silentAfterTheHook(withMusic: boolean) {
    const { production, project } = setup();
    ff(['-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=1', '-c:a', 'pcm_s16le', join(production, 'voice.wav')]);
    ff(['-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=48000:duration=30', '-c:a', 'pcm_s16le', join(production, 'song.wav')]);
    writeFileSync(join(production, 'assets.json'), JSON.stringify({ assets: [
      { id: 'voice', kind: 'audio', label: 'Voice', path: 'voice.wav', origin: 'generated' },
      { id: 'song', kind: 'audio', label: 'Song', path: 'song.wav', origin: 'generated' },
    ] }));
    writeManifest(project, {
      scenes: [
        { id: 'hook', duration: 1, text: text('Hi'), narration: { text: 'Hi', asset: 'voice' } },
        { id: 'pressure', duration: 1.5, text: text('Pressure') },
        { id: 'close', duration: 1.5, text: text('Close') },
      ],
      ...(withMusic ? { tracks: [{ kind: 'music', asset: 'song', volume: 0.3 }] } : {}),
    });
    return { production, project };
  }
  const fakeRender = () => vi.spyOn(renderTool, 'render').mockImplementation(async ({ output }) => { writeFileSync(output, 'mp4'); return { output }; });

  it('is named by the check and not rendered until each scene has sound', async () => {
    const { production } = silentAfterTheHook(false);
    const runtime = vi.spyOn(renderTool, 'check').mockResolvedValue({ ok: true, issues: [] });
    const checked = await checkTimeline({ production }) as { ok: boolean; issues: Array<{ code: string; message: string }> };
    expect(checked.ok).toBe(false);
    expect(checked.issues.find((issue) => issue.code === 'TIMELINE_SCENES_SILENT')?.message).toBe('Scenes pressure and close (3.0s) have no narration and nothing else plays under them, so they would be silent. Give each a line with ovs speak, or put music under the video, then check again.');
    expect(runtime).not.toHaveBeenCalled();
    const renderer = fakeRender();
    const rendered = await renderTimeline({ production, output: join(production, 'out.mp4') }) as { ok: boolean; issues?: Array<{ code: string }> };
    expect(rendered.ok).toBe(false);
    expect(rendered.issues?.map((issue) => issue.code)).toContain('TIMELINE_SCENES_SILENT');
    expect(renderer).not.toHaveBeenCalled();
  });

  it('still checks and renders a user\'s own canvas edit, which asks for no such check', async () => {
    const { production } = silentAfterTheHook(false);
    vi.spyOn(renderTool, 'check').mockResolvedValue({ ok: true, issues: [] });
    expect((await checkTimeline({ production }, { requireSound: false })).ok).toBe(true);
    fakeRender();
    expect((await renderTimeline({ production, output: join(production, 'out.mp4'), requireSound: false })).ok).toBe(true);
  });

  it('is named when its lines were written and never voiced, and not rendered', async () => {
    const { production, project } = silentAfterTheHook(false);
    writeManifest(project, { scenes: [
      { id: 'hook', duration: 1.5, text: text('Why'), narration: { text: 'Why do planes fly?' } },
      { id: 'close', duration: 1.5, text: text('Wings'), narration: { text: 'Wings push air down.' } },
    ] });
    vi.spyOn(renderTool, 'check').mockResolvedValue({ ok: true, issues: [] });
    const checked = await checkTimeline({ production }) as { issues: Array<{ code: string; message: string }> };
    expect(checked.issues.find((issue) => issue.code === 'TIMELINE_NARRATION_UNVOICED')?.message)
      .toMatch(/^Scenes hook and close \(3\.0s\) have narration text but no voice/);
    const renderer = fakeRender();
    expect((await renderTimeline({ production, output: join(production, 'out.mp4') })).ok).toBe(false);
    expect(renderer).not.toHaveBeenCalled();
  });

  it('renders once music plays under it', async () => {
    const { production } = silentAfterTheHook(true);
    vi.spyOn(renderTool, 'check').mockResolvedValue({ ok: true, issues: [] });
    const checked = await checkTimeline({ production }) as { ok: boolean; issues: Array<{ code: string }> };
    expect(checked.issues.map((issue) => issue.code)).not.toContain('TIMELINE_SCENES_SILENT');
    expect(checked.ok).toBe(true);
    fakeRender();
    expect((await renderTimeline({ production, output: join(production, 'out.mp4') })).ok).toBe(true);
  });
});

describe('pictures that look like screens', () => {
  // A page: light background, a header bar, cards, a button and rows of dark text.
  const screenPixel = (x: number, y: number): [number, number, number] => {
    if (y < 12) return [230, 120, 40];
    if (y > 100 && y < 112 && x > 20 && x < 140) return [220, 110, 50];
    const inCard = x > 8 && x < 152 && ((y > 20 && y < 50) || (y > 60 && y < 90));
    if (inCard && x % 7 < 4 && (y % 10 === 4 || y % 10 === 5) && x < 120) return [40, 40, 40];
    return inCard ? [255, 255, 255] : [245, 243, 240];
  };
  const photoPixel = (x: number, y: number): [number, number, number] => [
    (x * 3 + y) % 256, (y * 2 + 40 + ((x * y) % 17)) % 256, (x + y * 3 + 90) % 256,
  ];
  async function png(file: string, pixel: (x: number, y: number) => [number, number, number]) {
    const width = 320, height = 240, raw = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) raw.set(pixel(Math.floor(x / 2), Math.floor(y / 2)), (y * width + x) * 3);
    await sharp(raw, { raw: { width, height, channels: 3 } }).png().toFile(file);
  }

  it('says which imported pictures look like screens, as a question, and nothing for a photograph', async () => {
    const { production } = setup();
    await png(join(production, 'signup.png'), screenPixel);
    await png(join(production, 'beach.png'), photoPixel);
    const screens = await importTimelineAssets({ production, inputs: [join(production, 'signup.png')] });
    expect(screens.message).toMatch(new RegExp(`^${screens.assets[0].id} looks like a screen of a site or app\\. .*screen-demo\\.js .*A photograph needs none of this\\.$`));
    const photos = await importTimelineAssets({ production, inputs: [join(production, 'beach.png')] });
    expect(photos).not.toHaveProperty('message');
  });

  it('words the import note for one picture and for several', () => {
    expect(importedScreensMessage(['01'])).toMatch(/^01 looks like a screen of a site or app\. .*screen-demo\.js .*A photograph needs none of this\.$/);
    expect(importedScreensMessage(['01', '02'])).toMatch(/^01, 02 look like screens of a site or app\./);
  });

  it('points out a scene that holds a screen with nothing done on it, and not one that shows a step', async () => {
    const { production, project } = setup();
    await png(join(production, 'signup.png'), screenPixel);
    await png(join(production, 'beach.png'), photoPixel);
    writeFileSync(join(production, 'assets.json'), JSON.stringify({ assets: [
      { id: 'signup', kind: 'image', label: 'Sign-up', path: 'signup.png', origin: 'upload' },
      { id: 'beach', kind: 'image', label: 'Beach', path: 'beach.png', origin: 'upload' },
    ] }));
    writeManifest(project, { scenes: [
      { id: 'form', clips: [{ id: 'form-shot', asset: 'signup', in: 0, dur: 2 }] },
      { id: 'glimpse', clips: [{ id: 'glimpse-shot', asset: 'signup', in: 0, dur: 1 }] },
      { id: 'shore', clips: [{ id: 'shore-shot', asset: 'beach', in: 0, dur: 2 }] },
    ] });
    vi.spyOn(renderTool, 'check').mockResolvedValue({ ok: true, issues: [] });
    const checked = await checkTimeline({ production }) as { ok: boolean; issues: Array<{ code: string; severity: string; message: string; sceneId?: string }> };
    expect(checked.ok).toBe(true);
    const advice = checked.issues.filter((issue) => issue.code === 'TIMELINE_SCREEN_WITHOUT_STEP');
    expect(advice).toEqual([expect.objectContaining({ severity: 'warning', sceneId: 'form' })]);
    expect(advice[0].message).toBe('Scene form shows what looks like a screen of a site or app, with nothing done on it. Where the line says what someone does there, show it done on that screen with ./assets/vendor/screen-demo.js (timeline.md): tap or type where it happens, cut to the screen it leads to, and ring what the line points at. A photograph needs none of this.');

    const html = readFileSync(join(project, 'index.html'), 'utf8').replace('</body>', '<script src="./assets/vendor/screen-demo.js"></script><script>// ORKAS-SCENE-MOTION-BEGIN:form\nconst tl = window.__timelines.form = gsap.timeline({ paused: true });\nScreenDemo(\'[data-scene-id="form"]\', tl).tap(0.5, 0.2, 0.8);\n// ORKAS-SCENE-MOTION-END:form</script></body>');
    writeFileSync(join(project, 'index.html'), html);
    const shown = await checkTimeline({ production }) as { issues: Array<{ code: string }> };
    expect(shown.issues.map((issue) => issue.code)).not.toContain('TIMELINE_SCREEN_WITHOUT_STEP');
    // The page references the helper, so preparation provides it.
    expect(readFileSync(join(project, 'assets/vendor/screen-demo.js'), 'utf8')).toContain('window.ScreenDemo');
  });
});

describe('the prepared timeline mix', () => {
  /** Amplitude of one frequency over 0.3 s windows of the decoded mix. */
  function tone(file: string, hz: number, starts: number[]): number[] {
    const pcm = ff(['-i', file, '-ac', '1', '-ar', '48000', '-f', 'f32le', '-']);
    return starts.map((start) => {
      let re = 0, im = 0;
      const first = Math.round(start * 48000), count = 14400;
      expect(pcm.length / 4).toBeGreaterThanOrEqual(first + count);
      for (let i = 0; i < count; i += 1) {
        const sample = pcm.readFloatLE((first + i) * 4);
        re += sample * Math.cos(i * 2 * Math.PI * hz / 48000);
        im += sample * Math.sin(i * 2 * Math.PI * hz / 48000);
      }
      return Math.hypot(re, im) / count;
    });
  }

  // 2026-11-17: a quiet music bed under a 2 s voice-over (-28 LUFS) came out near -18 LUFS
  // from one loudnorm pass, outside the delivery's 2 LU of -14.
  it('brings a quiet music bed under a short voice within 2 LU of -14 LUFS', async () => {
    const { production, project } = setup();
    ff(['-f', 'lavfi', '-i', 'anoisesrc=d=20:c=pink:a=0.03:seed=7', '-ac', '2', '-c:a', 'pcm_s16le', join(production, 'bed.wav')]);
    ff(['-f', 'lavfi', '-i', 'sine=f=300:d=2.5:sample_rate=48000,volume=0.35,tremolo=f=5:d=0.8,adelay=300', '-c:a', 'pcm_s16le', join(production, 'voice.wav')]);
    writeFileSync(join(production, 'assets.json'), JSON.stringify({ assets: [
      { id: 'bed', kind: 'audio', label: 'Bed', path: 'bed.wav', origin: 'generated' },
      { id: 'voice', kind: 'audio', label: 'Voice', path: 'voice.wav', origin: 'generated' },
    ] }));
    writeManifest(project, {
      scenes: [{ id: 'ad', duration: 20, text: text('Ad'), narration: { text: 'Buy it.', asset: 'voice' } }],
      tracks: [{ kind: 'music', asset: 'bed', volume: 1 }],
    });
    expect((await prepareTimeline({ production })).ok).toBe(true);
    // Measured independently of the mix, as delivery measures it.
    const summary = spawnSync(ffmpegBin(), ['-hide_banner', '-nostats', '-i', preparedMix(project), '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
    const integrated = Number(/Integrated loudness:\s*I:\s*(-?[\d.]+) LUFS/.exec(summary.stderr)?.[1]);
    expect(Math.abs(integrated + 14)).toBeLessThanOrEqual(2);
  });

  // The voice file ends a second before the video. The ducked music then stopped with it, and
  // the last second of the video was silent (0 against 0.074 before the voice).
  it('keeps the music after the voice once ducking releases', async () => {
    const { production, project } = setup();
    ff(['-f', 'lavfi', '-i', "aevalsrc='if(between(t,1,3),0.3*sin(2*PI*660*t),0)':s=48000:d=3", '-c:a', 'pcm_s16le', join(production, 'speech.wav')]);
    ff(['-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=48000:duration=4', '-c:a', 'pcm_s16le', join(production, 'music.wav')]);
    writeFileSync(join(production, 'assets.json'), JSON.stringify({ assets: [
      { id: 'speech', kind: 'audio', label: 'Speech', path: 'speech.wav', origin: 'generated' },
      { id: 'music', kind: 'audio', label: 'Music', path: 'music.wav', origin: 'generated' },
    ] }));
    writeManifest(project, {
      scenes: [{ id: 'talk', duration: 4, text: text('Talk'), narration: { text: 'Hello there.', asset: 'speech' } }],
      tracks: [{ kind: 'music', asset: 'music', volume: 1, duck: true }],
    });
    expect((await prepareTimeline({ production })).ok).toBe(true);
    const [before, under, after] = tone(preparedMix(project), 220, [0.2, 1.8, 3.6]);
    expect(before).toBeGreaterThan(0.01);
    expect(under / before).toBeLessThan(0.4);
    expect(after / before).toBeGreaterThan(0.8);
  });
});
