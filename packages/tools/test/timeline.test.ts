import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import * as renderTool from '../src/render/render.js';
import * as timelineTool from '../src/composition/timeline.js';
import { checkTimeline, renderTimeline } from '../src/composition/timeline-actions.js';
import { importTimelineAssets, prepareTimeline } from '../src/composition/timeline.js';
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
