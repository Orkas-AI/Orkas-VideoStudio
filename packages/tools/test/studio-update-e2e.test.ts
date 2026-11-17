import { expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startStudio } from '../src/studio/server.js';
import { probeMedia } from '../src/edit/edit.js';

it.runIf(process.env.OVS_E2E === '1')('updates through the authenticated canvas, delivers a playable file, preserves versions on an unchanged update and routes changed facts to the Agent', async () => {
  const root = await fs.mkdtemp(join(process.env.OVS_VIDEO_EVIDENCE_DIR ?? tmpdir(), 'ovs-canvas-update-'));
  await fs.mkdir(join(root, 'videos/main'), { recursive: true });
  await fs.writeFile(join(root, 'assets.json'), JSON.stringify({ assets: [] }));
  await fs.writeFile(join(root, 'product.json'), JSON.stringify({ name: 'Example', facts: [{ id: 'benefit', text: 'Original benefit', source: 'user' }], images: [] }));
  const fixture = JSON.parse(await fs.readFile(new URL('./fixtures/production-video/composition-manifest.json', import.meta.url), 'utf8'));
  const art = { ...fixture.art_direction, cover: { ...fixture.art_direction.cover, scene_id: 'one', headline: 'Canvas export' }, scenes: ['one', 'two'].map(id => ({ id, hero_visual: 'Editorial title', depth_layers: ['color field', 'composition frame', 'editorial type'], motion_verbs: ['fade', 'hold'] })) };
  await fs.writeFile(join(root, 'videos/main/manifest.json'), JSON.stringify({ schema_version: 3, id: 'main', label: 'Canvas export', canvas: { width: 640, height: 360, fps: 24 }, art_direction: art, scenes: [{ id: 'one', duration: 1, text: { title: { value: 'Canvas export' } } }, { id: 'two', duration: 1, text: { title: { value: 'Ready to share' } } }] }));
  const studio = await startStudio({ production: root });
  try {
    const link = new URL(studio.url);
    const connected = await fetch(`${link.origin}/api/connect`, { method: 'POST', headers: { Origin: link.origin }, body: JSON.stringify({ token: link.hash.slice(1) }) });
    const cookie = connected.headers.get('set-cookie')!.split(';')[0];
    const invoke = async (method: string, params: unknown = {}) => (await fetch(`${link.origin}/api/invoke`, { method: 'POST', headers: { Origin: link.origin, Cookie: cookie }, body: JSON.stringify({ method, params }) })).json() as Promise<any>;
    expect(await invoke('videoCanvas.render', { video: 'main' })).toMatchObject({ ok: true });
    const waitForVersion = async (count: number) => {
      const deadline = Date.now() + 120000;
      let state: any;
      while (Date.now() < deadline) {
        state = await invoke('videoCanvas.read');
        if (!state.ok) { expect(state.code).toBe('changed'); await new Promise(done => setTimeout(done, 250)); continue; }
        if (state.jobs.some((job: any) => job.status === 'failed')) throw new Error('Canvas render failed');
        if (state.productions[0]?.videos[0]?.versions.length === count && !state.jobs.some((job: any) => job.status === 'running')) return state;
        await new Promise(done => setTimeout(done, 250));
      }
      throw new Error('Canvas update deadline exceeded');
    };
    let state = await waitForVersion(1);
    expect(state.productions[0].videos[0].versions).toHaveLength(1);
    expect(state.productions[0].videos[0].scenes.every((scene: any) => scene.frame_path)).toBe(true);
    const delivered = state.productions[0].videos[0].versions[0].media_path;
    expect(await probeMedia(delivered)).toMatchObject({ width: 640, height: 360, duration: 2 });
    expect(await invoke('videoCanvas.render', { video: 'main' })).toMatchObject({ ok: true, unchanged: true });
    const history = JSON.parse(await fs.readFile(join(root, 'versions.json'), 'utf8'));
    expect(history.versions).toHaveLength(1);
    expect(history.delivered_products.main.facts[0].text).toBe('Original benefit');
    const originalBytes = await fs.readFile(delivered);
    expect(await invoke('videoCanvas.edit', { revision: state.revision, edit: { kind: 'set_text', video: 'main', scene: 'one', slot: 'title', value: 'Revised on the canvas' } })).toMatchObject({ ok: true });
    const edited = JSON.parse(await fs.readFile(join(root, 'videos/main/manifest.json'), 'utf8'));
    expect(edited.art_direction.cover.headline).toBe('Canvas export');
    expect(await invoke('videoCanvas.render', { video: 'main' })).toMatchObject({ ok: true });
    state = await waitForVersion(2);
    expect(await fs.readFile(delivered)).toEqual(originalBytes);
    expect(state.productions[0].videos[0].scenes[0].texts[0].value).toBe('Revised on the canvas');

    expect(await invoke('videoCanvas.edit', { revision: state.revision, edit: { kind: 'set_fact', fact: 'benefit', text: 'Revised benefit' } })).toMatchObject({ ok: true });
    expect(await invoke('videoCanvas.render', { video: 'main' })).toMatchObject({ ok: false, code: 'agent_required' });
    expect(JSON.parse(await fs.readFile(join(root, 'versions.json'), 'utf8')).versions).toHaveLength(2);
    const media = await fetch(`${link.origin}/media?file=${encodeURIComponent(delivered)}`, { headers: { Cookie: cookie, Range: 'bytes=0-31' } });
    expect(media.status).toBe(206); expect((await media.arrayBuffer()).byteLength).toBe(32);
  } finally { await studio.close(); if (!process.env.OVS_VIDEO_EVIDENCE_DIR) await fs.rm(root, { recursive: true, force: true }); }
}, 300000);
