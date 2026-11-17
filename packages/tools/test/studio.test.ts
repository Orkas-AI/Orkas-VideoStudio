import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startStudio } from '../src/studio/server.js';

let root: string;
let studio: Awaited<ReturnType<typeof startStudio>> | undefined;
beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), 'ovs-studio-'));
  await fs.mkdir(join(root, 'videos/main'), { recursive: true });
  await fs.writeFile(join(root, 'assets.json'), JSON.stringify({ assets: [] }));
  await fs.writeFile(join(root, 'videos/main/manifest.json'), JSON.stringify({
    schema_version: 3, id: 'main', label: 'Example', canvas: { width: 640, height: 360, fps: 30 },
    scenes: [{ id: 'one', duration: 1, text: { title: { value: 'Before' } } }, { id: 'two', duration: 1 }],
  }));
});
afterEach(async () => { await studio?.close(); studio = undefined; await fs.rm(root, { recursive: true, force: true }); });

async function connect() {
  studio = await startStudio({ production: root });
  const link = new URL(studio.url);
  const response = await fetch(`${link.origin}/api/connect`, {
    method: 'POST', headers: { Origin: link.origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: link.hash.slice(1) }),
  });
  expect(response.status).toBe(200);
  const cookie = response.headers.get('set-cookie')!.split(';')[0];
  const invoke = async (method: string, params: Record<string, unknown> = {}) => {
    const response = await fetch(`${link.origin}/api/invoke`, { method: 'POST',
      headers: { Origin: link.origin, Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, params }),
    });
    return response.json() as Promise<any>;
  };
  return { origin: link.origin, cookie, invoke };
}

describe('browser production continuity', () => {
  it('opens the real production, saves scene text, rejects a stale edit and keeps it after reopen', async () => {
    const { invoke } = await connect();
    const before = await invoke('videoCanvas.read');
    expect(before.productions[0].videos[0].scenes[0].texts[0].value).toBe('Before');
    const changed = await invoke('videoCanvas.edit', { dir: '.', revision: before.revision,
      edit: { kind: 'set_text', video: 'main', scene: 'one', slot: 'title', value: 'After' } });
    expect(changed.ok).toBe(true);
    expect(await invoke('videoCanvas.edit', { dir: '.', revision: before.revision,
      edit: { kind: 'remove_scene', video: 'main', scene: 'one' } })).toMatchObject({ ok: false, code: 'changed' });
    await studio!.close(); studio = undefined;
    const reopened = await connect();
    const after = await reopened.invoke('videoCanvas.read');
    expect(after.productions[0].videos[0].scenes).toHaveLength(2);
    expect(after.productions[0].videos[0].scenes[0].texts[0].value).toBe('After');
  });

  it('moves cards and restores a removed scene without creating a delivery', async () => {
    const { invoke } = await connect();
    let state = await invoke('videoCanvas.read');
    expect((await invoke('videoCanvas.layout', { dir: '.', cards: { 'video:main': { x: 123, y: 234 } } })).ok).toBe(true);
    state = await invoke('videoCanvas.read');
    expect((await invoke('videoCanvas.edit', { dir: '.', revision: state.revision,
      edit: { kind: 'remove_scene', video: 'main', scene: 'one' } })).ok).toBe(true);
    state = await invoke('videoCanvas.read');
    const video = state.productions[0].videos[0];
    expect(video.scenes.map((s: any) => s.id)).toEqual(['two']);
    expect((await invoke('videoCanvas.edit', { dir: '.', revision: state.revision,
      edit: { kind: 'restore_scene', video: 'main', removed: video.removed_scenes[0].key } })).ok).toBe(true);
    state = await invoke('videoCanvas.read');
    expect(state.productions[0].videos[0].scenes.map((s: any) => s.id)).toEqual(['one', 'two']);
    expect(state.productions[0].layout['video:main']).toEqual({ x: 123, y: 234 });
    await expect(fs.stat(join(root, 'versions.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('does not pretend an unbound Agent is connected', async () => {
    const { invoke } = await connect();
    expect(await invoke('agent.send', { text: 'Change the title' })).toMatchObject({ ok: false, code: 'agent_unavailable' });
  });
});

describe('local browser boundary', () => {
  it('rejects unauthenticated, foreign-origin and unregistered operations', async () => {
    const { origin, cookie, invoke } = await connect();
    expect((await fetch(`${origin}/api/invoke`, { method: 'POST', headers: { Origin: origin }, body: '{}' })).status).toBe(401);
    expect((await fetch(`${origin}/api/invoke`, { method: 'POST', headers: { Origin: 'https://example.com', Cookie: cookie }, body: '{}' })).status).toBe(403);
    expect(await invoke('run-shell', { command: 'anything' })).toMatchObject({ ok: false, code: 'invalid' });
  });

  it('never serves project HTML, private state, traversal or symlinks as media', async () => {
    await fs.writeFile(join(root, 'secret.json'), '{"private":true}');
    await fs.writeFile(join(root, 'videos/main/index.html'), '<script>parent.attack()</script>');
    await fs.symlink(join(root, 'secret.json'), join(root, 'linked.png'));
    const { origin, cookie } = await connect();
    for (const file of ['secret.json', 'videos/main/index.html', '../secret.json', 'linked.png']) {
      expect((await fetch(`${origin}/media?file=${encodeURIComponent(file)}`, { headers: { Cookie: cookie } })).status).toBe(404);
    }
  });
});

import { spawn } from 'node:child_process';
import { acquireLease } from '../src/studio/lease.js';
it('allows one stale-lock recovery and never steals a live owner during concurrent recovery', async () => {
  const deadPid = await new Promise<number>((done, reject) => {
    const child = spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore' });
    child.once('error', reject); child.once('close', () => done(child.pid!));
  });
  const file = join(root, 'stale.lock'); await fs.writeFile(file, JSON.stringify({ pid: deadPid }));
  const attempts = await Promise.allSettled([acquireLease(file, true), acquireLease(file, true)]);
  expect(attempts.filter(attempt => attempt.status === 'fulfilled')).toHaveLength(1);
  await expect(acquireLease(file, true)).rejects.toThrow('busy');
  for (const attempt of attempts) if (attempt.status === 'fulfilled') await attempt.value.release();
});
