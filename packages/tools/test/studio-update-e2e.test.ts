import { expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startStudio } from '../src/studio/server.js';
import { probeMedia } from '../src/edit/edit.js';
import { prepareTimeline } from '../src/composition/timeline.js';

it.runIf(process.env.OVS_E2E === '1')('updates through the authenticated canvas, delivers a playable file, preserves versions on an unchanged update and routes changed facts to the Agent', async () => {
  const root = await fs.mkdtemp(join(process.env.OVS_VIDEO_EVIDENCE_DIR ?? tmpdir(), 'ovs-canvas-update-'));
  await fs.mkdir(join(root, 'videos/main'), { recursive: true });
  await fs.writeFile(join(root, 'assets.json'), JSON.stringify({ assets: [] }));
  await fs.writeFile(join(root, 'product.json'), JSON.stringify({ name: 'Example', facts: [{ id: 'benefit', text: 'Original benefit', source: 'user' }], images: [] }));
  const fixture = JSON.parse(await fs.readFile(new URL('./fixtures/production-video/composition-manifest.json', import.meta.url), 'utf8'));
  const art = { ...fixture.art_direction, cover: { ...fixture.art_direction.cover, scene_id: 'one', headline: 'Canvas export' }, scenes: ['one', 'two'].map(id => ({ id, hero_visual: 'Editorial title', depth_layers: ['color field', 'composition frame', 'editorial type'], motion_verbs: ['fade', 'hold'] })) };
  await fs.writeFile(join(root, 'videos/main/manifest.json'), JSON.stringify({ schema_version: 3, id: 'main', label: 'Canvas export', canvas: { width: 640, height: 360, fps: 24 }, art_direction: art, scenes: [{ id: 'one', duration: 1, text: { title: { value: 'Canvas export' } } }, { id: 'two', duration: 1, text: { title: { value: 'Ready to share' } } }] }));
  expect(await prepareTimeline({ production: root, video_id: 'main' })).toMatchObject({ ok: true });
  // Author the small fixture's layout; the scaffold's 96px type and spacing do
  // not fit its 640x360 cover with two signal lines after a multiline edit.
  const html = join(root, 'videos/main/index.html');
  await fs.writeFile(html, (await fs.readFile(html, 'utf8')).replace('</head>', '<style>.scene-content{padding:24px;gap:10px}h1{font-size:44px;line-height:1.1}.cover-signal{font-size:18px}</style></head>'));
  let studio = await startStudio({ production: root });
  try {
    const link = new URL(studio.url);
    const connected = await fetch(`${link.origin}/api/connect`, { method: 'POST', headers: { Origin: link.origin }, body: JSON.stringify({ token: link.hash.slice(1) }) });
    const cookie = connected.headers.get('set-cookie')!.split(';')[0];
    const invoke = async (method: string, params: unknown = {}) => (await fetch(`${link.origin}/api/invoke`, { method: 'POST', headers: { Origin: link.origin, Cookie: cookie }, body: JSON.stringify({ method, params }) })).json() as Promise<any>;
    expect(await invoke('videoCanvas.render', { video: 'main' })).toMatchObject({ ok: true });
    const waitForVersion = async (count: number, read = invoke) => {
      const deadline = Date.now() + 120000;
      let state: any;
      while (Date.now() < deadline) {
        state = await read('videoCanvas.read');
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

    // Native protocol simulation owns only the model response. The authenticated
    // Update must then check/render/ship real media without another user click.
    await studio.close();
    const bin = join(root, 'bin'); await fs.mkdir(bin);
    const native = join(bin, 'agent.cjs');
    await fs.writeFile(native, `const fs=require('fs');
if(process.argv.includes('--version')){console.log('codex-cli 0.160.1');process.exit();}
let turn=0;const emit=x=>console.log(JSON.stringify(x));
require('readline').createInterface({input:process.stdin}).on('line',line=>{
 const m=JSON.parse(line);
 if(m.method==='initialize')emit({id:m.id,result:{}});
 if(m.method==='thread/start'||m.method==='thread/resume')emit({id:m.id,result:{thread:{id:${JSON.stringify('canvas-' + root.split(/[\\/]/).at(-1))},cwd:fs.realpathSync(${JSON.stringify(root)})}}});
 if(m.method==='turn/start'){
  fs.writeFileSync(${JSON.stringify(join(root, 'native-calls.json'))},JSON.stringify(++turn));
  emit({id:m.id,result:{turn:{id:'t'+turn}}});
  const mode=fs.existsSync(${JSON.stringify(join(root, 'native-mode'))})?fs.readFileSync(${JSON.stringify(join(root, 'native-mode'))},'utf8'):'success';
  if(mode==='hold')return;
  if(mode==='success'){const p=${JSON.stringify(join(root, 'videos/main/manifest.json'))};const manifest=JSON.parse(fs.readFileSync(p));manifest.scenes[0].text.title.value='Agent updated title';fs.writeFileSync(p,JSON.stringify(manifest));}
  emit({method:'turn/completed',params:{turn:{id:'t'+turn,status:mode==='fail'?'failed':'completed'}}});
 }
 if(m.method==='turn/interrupt'){emit({id:m.id,result:{}});emit({method:'turn/completed',params:{turn:{id:'t'+turn,status:'interrupted'}}});}
});`);
    if (process.platform === 'win32') await fs.writeFile(join(bin, 'codex.cmd'), `@echo off\r\n"${process.execPath}" "${native}" %*\r\n`);
    else await fs.writeFile(join(bin, 'codex'), `#!/bin/sh\nexec "${process.execPath}" "${native}" "$@"\n`, { mode: 0o755 });
    vi.stubEnv('PATH', `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`);
    studio = await startStudio({ production: root, agent: 'codex' });
    const agentLink = new URL(studio.url);
    const auth = await fetch(`${agentLink.origin}/api/connect`, { method: 'POST', headers: { Origin: agentLink.origin }, body: JSON.stringify({ token: agentLink.hash.slice(1) }) });
    const agentCookie = auth.headers.get('set-cookie')!.split(';')[0];
    const agentInvoke = async (method: string, params: unknown = {}) => (await fetch(`${agentLink.origin}/api/invoke`, { method: 'POST', headers: { Origin: agentLink.origin, Cookie: agentCookie }, body: JSON.stringify({ method, params }) })).json() as Promise<any>;
    state = await agentInvoke('videoCanvas.read');
    expect(await agentInvoke('videoCanvas.agentUpdate', { video: 'main', text: 'Update the changed benefit', revision: 'stale' })).toMatchObject({ ok: false, code: 'changed' });
    expect(await fs.stat(join(root, 'native-calls.json')).catch(() => null)).toBeNull();
    expect(await agentInvoke('videoCanvas.agentUpdate', { video: 'main', text: 'Update the changed benefit', revision: state.revision })).toMatchObject({ ok: true });
    state = await waitForVersion(3, agentInvoke);
    expect(state.productions[0].videos[0].scenes[0].texts[0].value).toBe('Agent updated title');
    expect(state.productions[0].videos[0].product_changes).toEqual([]);
    expect(JSON.parse(await fs.readFile(join(root, 'native-calls.json'), 'utf8'))).toBe(1);
    expect(await fs.readFile(delivered)).toEqual(originalBytes);

    const waitForAgent = async (status: string) => {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const current = await agentInvoke('studio.status');
        if (current.agent.status === status) return;
        await new Promise(done => setTimeout(done, 20));
      }
      throw new Error('Native fixture did not settle');
    };
    for (const mode of ['fail', 'hold']) {
      await fs.writeFile(join(root, 'native-mode'), mode);
      state = await agentInvoke('videoCanvas.read');
      expect(await agentInvoke('videoCanvas.agentUpdate', { video: 'main', text: 'Update the video again', revision: state.revision })).toMatchObject({ ok: true });
      if (mode === 'hold') {
        expect(await agentInvoke('agent.send', { text: 'Duplicate' })).toMatchObject({ ok: false, code: 'busy' });
        expect(await agentInvoke('agent.stop')).toMatchObject({ ok: true });
      }
      await waitForAgent(mode === 'fail' ? 'failed' : 'stopped');
      expect(JSON.parse(await fs.readFile(join(root, 'versions.json'), 'utf8')).versions).toHaveLength(3);
    }
    expect(JSON.parse(await fs.readFile(join(root, 'native-calls.json'), 'utf8'))).toBe(3);
  } finally { await studio.close(); vi.unstubAllEnvs(); if (!process.env.OVS_VIDEO_EVIDENCE_DIR) await fs.rm(root, { recursive: true, force: true }); }
}, 450000);
