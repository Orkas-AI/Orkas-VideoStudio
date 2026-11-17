import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import { join, delimiter } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../../cli/dist/index.js', import.meta.url));
const mcp = fileURLToPath(new URL('../../mcp/dist/index.js', import.meta.url));
const suite = process.env.OVS_E2E === '1' ? describe : describe.skip;
let root: string, production: string, opened: string, env: NodeJS.ProcessEnv;
let processes: ChildProcess[];
beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), 'ovs-auto-open-'));
  production = join(root, 'production'); opened = join(root, 'opened.jsonl'); processes = [];
  await fs.mkdir(join(production, 'videos/main'), { recursive: true });
  await fs.writeFile(join(production, 'assets.json'), JSON.stringify({ assets: [] }));
  await fs.writeFile(join(production, 'videos/main/manifest.json'), JSON.stringify({
    schema_version: 3, id: 'main', label: 'Launch test', canvas: { width: 640, height: 360, fps: 30 },
    scenes: [{ id: 'one', duration: 1, text: { title: { value: 'Before' } } }],
  }));
  const bin = join(root, 'bin'); await fs.mkdir(bin);
  const fake = '#!/usr/bin/env node\nrequire("fs").appendFileSync(process.env.OPENED,JSON.stringify(process.argv.slice(2))+"\\n");\nprocess.exit(process.env.OPEN_FAIL==="1"?1:0);\n';
  for (const name of ['open', 'xdg-open']) await fs.writeFile(join(bin, name), fake, { mode: 0o700 });
  env = { ...process.env, PATH: bin + delimiter + process.env.PATH, OPENED: opened, OVS_STUDIO_AUTO_OPEN: '1' };
});
afterEach(async () => {
  for (const process of processes) process.kill();
  const lease = await fs.readFile(join(production, '.ovs-studio.lock'), 'utf8').catch(() => '');
  if (lease) { try { globalThis.process.kill(JSON.parse(lease).pid, 'SIGTERM'); } catch {} }
  for (let i = 0; i < 100; i++) {
    if (!await fs.stat(join(production, '.ovs-studio.lock')).catch(() => null)) break;
    await new Promise(done => setTimeout(done, 20));
  }
  await fs.rm(root, { recursive: true, force: true });
});
function command(args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { env }); processes.push(child);
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', reject); child.once('exit', code => resolve({ code, stdout, stderr }));
  });
}
const channelEvents: unknown[] = [];
async function mcpPrepare(channel = false, keep = false) {
  const child = spawn(process.execPath, [mcp, ...(channel ? ['--claude-channel'] : [])], { env }); processes.push(child);
  let buffer = '', stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  const received = new Map<number, (value: any) => void>();
  child.stdout.on('data', chunk => {
    buffer += chunk;
    while (buffer.includes('\n')) {
      const end = buffer.indexOf('\n'), value = JSON.parse(buffer.slice(0, end)); buffer = buffer.slice(end + 1);
      if (value.method === 'notifications/claude/channel') channelEvents.push(value.params);
      received.get(value.id)?.(value); received.delete(value.id);
    }
  });
  const request = (id: number, method: string, params: unknown) => new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('MCP test deadline')), 20000);
    received.set(id, value => { clearTimeout(timer); resolve(value); });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  await request(1, 'initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'canvas-test', version: '1' } });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const reply = await request(2, 'tools/call', { name: 'timeline_prepare', arguments: { production } });
  if (!keep) child.kill(); expect(stderr).toBe('');
  return JSON.parse(reply.result.content[0].text);
}

suite('automatic production canvas', () => {
  it.skipIf(process.platform === 'win32')('delivers a browser request through the same explicitly configured MCP channel and revokes it when MCP exits', async () => {
    channelEvents.length = 0;
    expect((await mcpPrepare(true, true)).ok).toBe(true);
    const url = new URL(JSON.parse((await fs.readFile(opened, 'utf8')).trim())[0]);
    const response = await fetch(url.origin + '/api/connect', { method: 'POST', headers: { Origin: url.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ token: url.hash.slice(1) }) });
    const cookie = response.headers.get('set-cookie')!.split(';')[0];
    const invoke = async (method: string, params = {}) => (await fetch(url.origin + '/api/invoke', { method: 'POST', headers: { Origin: url.origin, Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ method, params }) })).json() as Promise<any>;
    expect(await invoke('conversation.status')).toMatchObject({ connected: true, label: 'Claude Code' });
    const input = { request_id: 'browser-original-1', text: 'Change scene 2' };
    expect(await invoke('conversation.send', input)).toMatchObject({ ok: true, accepted: true });
    expect(await invoke('conversation.send', input)).toMatchObject({ ok: true, accepted: true });
    expect(channelEvents).toEqual([{ content: input.text, meta: { request_id: input.request_id } }]);
    const exited = new Promise(done => processes[0].once('exit', done)); processes[0].kill(); await exited;
    expect(await invoke('conversation.status')).toMatchObject({ connected: false });
    expect(await invoke('conversation.send', { request_id: 'after-close', text: 'No delivery' })).toMatchObject({ ok: false });
    expect(channelEvents).toHaveLength(1);
  });

  it.skipIf(process.platform === 'win32')('opens after CLI prepare, survives its turn and reuses one canvas across CLI and MCP updates', async () => {
    const first = await command(['timeline', 'prepare', '--production', production]);
    expect(first.code, first.stdout + first.stderr).toBe(0); expect(JSON.parse(first.stdout).ok).toBe(true);
    expect(first.stderr).toBe('');
    const links = (await fs.readFile(opened, 'utf8')).trim().split('\n').map(line => JSON.parse(line)[0]);
    expect(links).toHaveLength(1);
    expect(new URL(links[0]).hostname).toBe('127.0.0.1');
    expect((await fetch(links[0])).status).toBe(200);
    expect((await command(['timeline', 'prepare', '--production', production])).code).toBe(0);
    expect((await mcpPrepare()).ok).toBe(true);
    expect((await fs.readFile(opened, 'utf8')).trim().split('\n')).toHaveLength(1);
  });
  it.skipIf(process.platform === 'win32')('opens a fresh MCP production and retains successful production results when the browser fails', async () => {
    env.OPEN_FAIL = '1';
    const first = await command(['timeline', 'prepare', '--production', production]);
    expect(first.code).toBe(0); expect(JSON.parse(first.stdout).ok).toBe(true);
    expect(first.stderr).toContain('Canvas could not open automatically');
    await expect(fs.stat(join(production, '.ovs-studio.lock'))).rejects.toMatchObject({ code: 'ENOENT' });
    env.OPEN_FAIL = '0'; expect((await mcpPrepare()).ok).toBe(true);
    expect((await fs.readFile(opened, 'utf8')).trim().split('\n')).toHaveLength(2);
  });
  it.skipIf(process.platform === 'win32')('opens an explicit studio by default and supports a headless link without opening a browser', async () => {
    async function launch(extra: string[]) {
      const child = spawn(process.execPath, [cli, 'studio', '--production', production, ...extra], { env });
      processes.push(child);
      return new Promise<string>((resolve, reject) => {
        let output = '';
        const timer = setTimeout(() => reject(new Error('Studio startup deadline')), 15000);
        child.stdout.on('data', chunk => {
          output += chunk;
          if (output.includes('\n')) { clearTimeout(timer); resolve(output.trim()); }
        });
        child.once('error', reject);
      });
    }
    const url = await launch(['--no-open']);
    expect((await fetch(url)).status).toBe(200);
    await expect(fs.stat(opened)).rejects.toMatchObject({ code: 'ENOENT' });
    const stopped = new Promise(done => processes[0].once('exit', done));
    processes[0].kill(); await stopped;
    const second = await launch([]);
    for (let i = 0; i < 100 && !await fs.stat(opened).catch(() => null); i++) await new Promise(done => setTimeout(done, 20));
    const links = (await fs.readFile(opened, 'utf8')).trim().split('\n').map(line => JSON.parse(line)[0]);
    expect(links).toEqual([second]); expect((await fetch(second)).status).toBe(200);
  });
  it('does not start a canvas for failed preparation or an explicit headless run', async () => {
    env.OVS_STUDIO_AUTO_OPEN = '0';
    expect((await command(['timeline', 'prepare', '--production', production])).code).toBe(0);
    await expect(fs.stat(join(production, '.ovs-studio.lock'))).rejects.toMatchObject({ code: 'ENOENT' });
    env.OVS_STUDIO_AUTO_OPEN = '1';
    await fs.writeFile(join(production, 'videos/main/manifest.json'), '{}');
    expect((await command(['timeline', 'prepare', '--production', production])).code).toBe(1);
    await expect(fs.stat(opened)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
