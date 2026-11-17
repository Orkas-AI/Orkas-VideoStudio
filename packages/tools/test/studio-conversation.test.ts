import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { tmpdir } from 'node:os';
import { connectCodexConversation, connectChannelConversation, createClaudeChannelBridge, resolveOriginalConversation } from '../src/studio/conversation.js';

const fixtureHome = vi.hoisted(() => ({ path: '' }));
vi.mock('node:os', async importActual => ({ ...await importActual<typeof import('node:os')>(), homedir: () => fixtureHome.path }));
let root: string;
const closers: Array<() => unknown> = [];
beforeEach(async () => { root = await fs.mkdtemp(join(tmpdir(), 'ovs-origin-')); fixtureHome.path = root; });
afterEach(async () => { for (const close of closers.splice(0).reverse()) await close(); await fs.rm(root, { recursive: true, force: true }); });
const thread = '01234567-89ab-4def-8123-456789abcdef';
async function codex(useRendezvous = false, useDefaultHome = false) {
  const bin = join(root, 'codex.cjs'), calls = join(root, 'calls.jsonl'), state = join(root, 'state.json');
  await fs.writeFile(state, JSON.stringify({ loaded: true, fail: false }));
  await fs.writeFile(bin, `const fs=require('fs');const args=process.argv.slice(2);
const state=()=>JSON.parse(fs.readFileSync(${JSON.stringify(state)}));
if(args[0]==='--version'){console.log('codex-cli '+(state().version||'0.160.1'));process.exit(0)}
if(args[0]==='queue') {fs.appendFileSync(${JSON.stringify(calls)},JSON.stringify(args)+'\\n');process.exit(state().fail?1:0)}
if(args.join(' ')==='app-server proxy')require('readline').createInterface({input:process.stdin}).on('line',line=>{
 const m=JSON.parse(line);if(!m.id)return;
 const result=m.method==='initialize'?{userAgent:'test'}:m.method==='thread/read'?{thread:{id:m.params.threadId,status:{type:state().loaded?'idle':'notLoaded'}}}:{};
 console.log(JSON.stringify({id:m.id,result}));
});else process.exit(2);`);
  const socketPath = process.platform === 'win32' ? '\\\\.\\pipe\\ovs-codex-test-' + Date.now() : join(root, 'daemon.sock');
  const http = createServer(), wss = new WebSocketServer({ server: http });
  wss.on('connection', ws => ws.on('message', async data => {
    const m = JSON.parse(data.toString()); if (!m.id) return;
    const stateValue = JSON.parse(await fs.readFile(state, 'utf8'));
    const result = m.method === 'initialize' ? {} : { thread: { id: stateValue.wrongThread ? 'another-thread' : m.params.threadId, status: { type: stateValue.loaded ? (stateValue.busy ? 'active' : 'idle') : 'notLoaded' } } };
    ws.send(JSON.stringify({ id: m.id, result }));
  }));
  await new Promise<void>(done => http.listen(socketPath, done));
  closers.push(async () => { for (const c of wss.clients) c.terminate(); wss.close(); await new Promise<void>(done => http.close(() => done())); });
  let endpoint = socketPath;
  if (useRendezvous && process.platform !== 'win32') {
    const directory = join(root, 'rendezvous-' + 'a'.repeat(60)); await fs.mkdir(directory);
    endpoint = join(directory, 'control.sock'); await fs.symlink(socketPath, endpoint);
  }
  if (useDefaultHome) {
    const directory = join(root, '.codex', 'app-server-control'); await fs.mkdir(directory, { recursive: true });
    await fs.symlink(socketPath, join(directory, 'app-server-control.sock'));
  }
  const client = connectCodexConversation({ threadId: thread, command: process.execPath, prefix: [bin], ...(useDefaultHome ? { env: {} } : { socketPath: endpoint }) });
  closers.push(() => client.close());
  return { client, calls, state };
}
it('queues an explicit message to the bound loaded Codex thread once without model, permission or resume overrides', async () => {
  const { client, calls } = await codex();
  expect(await client.status()).toMatchObject({ connected: true, busy: false, label: 'Codex' });
  const input = { requestId: 'send-1', text: 'Change scene 2' };
  expect(await Promise.all([client.send(input), client.send(input)])).toEqual([{ accepted: true }, { accepted: true }]);
  expect(await client.send({ ...input, text: 'Different content' })).toEqual({ accepted: false });
  expect((await fs.readFile(calls, 'utf8')).trim().split('\n').map(s => JSON.parse(s))).toEqual([['queue', '--thread', thread, '--message', input.text]]);
});
it('rejects a closed Codex thread and retains failed delivery without replaying on status or retry', async () => {
  const { client, calls, state } = await codex();
  await fs.writeFile(state, JSON.stringify({ loaded: false }));
  expect((await client.status()).connected).toBe(false);
  expect(await client.send({ requestId: 'closed', text: 'Change it' })).toEqual({ accepted: false });
  await expect(fs.stat(calls)).rejects.toMatchObject({ code: 'ENOENT' });
  await fs.writeFile(state, JSON.stringify({ loaded: true, fail: true }));
  const input = { requestId: 'uncertain', text: 'Change it' };
  expect(await client.send(input)).toEqual({ accepted: false });
  await fs.writeFile(state, JSON.stringify({ loaded: true, fail: false }));
  expect((await client.status()).connected).toBe(true);
  expect(await client.send(input)).toEqual({ accepted: false });
  expect((await fs.readFile(calls, 'utf8')).trim().split('\n')).toHaveLength(1);
});
it('reads the original busy state through a long rendezvous alias and rejects a mismatched thread', async () => {
  const { client, state, calls } = await codex(true);
  await fs.writeFile(state, JSON.stringify({ loaded: true, busy: true }));
  expect(await client.status()).toMatchObject({ connected: true, busy: true });
  await fs.writeFile(state, JSON.stringify({ loaded: true, wrongThread: true }));
  expect((await client.status()).connected).toBe(false);
  expect(await client.send({ requestId: 'wrong', text: 'No recipient substitution' })).toEqual({ accepted: false });
  await expect(fs.stat(calls)).rejects.toMatchObject({ code: 'ENOENT' });
});
it('keeps unsupported CLI versions unavailable without submitting a message', async () => {
  const { client, state, calls } = await codex();
  await fs.writeFile(state, JSON.stringify({ loaded: true, version: '0.159.9' }));
  expect((await client.status()).connected).toBe(false);
  expect(await client.send({ requestId: 'unsupported', text: 'No delivery' })).toEqual({ accepted: false });
  await expect(fs.stat(calls)).rejects.toMatchObject({ code: 'ENOENT' });
});
it.skipIf(process.platform === 'win32')('finds the default Codex home without an override and never starts a daemon', async () => {
  const { client, calls } = await codex(false, true);
  expect((await client.status()).connected).toBe(true);
  await expect(fs.stat(calls)).rejects.toMatchObject({ code: 'ENOENT' });
});
it('does not discover recipients from Orkas state, session names, or an invalid environment thread id', () => {
  expect(resolveOriginalConversation({ ORKAS_CANVAS_CLIENT: '/irrelevant', CODEX_SESSION_ID: thread })).toBeUndefined();
  expect(resolveOriginalConversation({ CODEX_THREAD_ID: 'latest' })).toBeUndefined();
});
it('sends through the existing opt-in Claude MCP channel, preserves request identity and revokes on shutdown', async () => {
  const events: unknown[] = [];
  const bridge = await createClaudeChannelBridge(async event => { events.push(event); });
  closers.push(() => bridge.close());
  const client = connectChannelConversation(bridge.file); closers.push(() => client.close());
  expect((await client.status()).connected).toBe(true);
  const input = { requestId: 'channel-1', text: 'Change scene 2' };
  expect(await Promise.all([client.send(input), client.send(input)])).toEqual([{ accepted: true }, { accepted: true }]);
  expect(events).toEqual([{ content: input.text, meta: { request_id: input.requestId } }]);
  await bridge.close();
  expect((await client.status()).connected).toBe(false);
  expect(await client.send({ requestId: 'after-close', text: 'No delivery' })).toEqual({ accepted: false });
  expect(events).toHaveLength(1);
  await expect(fs.stat(bridge.file)).rejects.toMatchObject({ code: 'ENOENT' });
});
it('does not replay a Claude notification whose receipt is uncertain, and rejects tampered capabilities', async () => {
  let count = 0;
  const bridge = await createClaudeChannelBridge(async () => { count++; throw new Error('transport closed'); });
  closers.push(() => bridge.close());
  const client = connectChannelConversation(bridge.file); closers.push(() => client.close());
  const input = { requestId: 'failed-1', text: 'Keep this draft' };
  expect(await client.send(input)).toEqual({ accepted: false });
  expect(await client.send(input)).toEqual({ accepted: false });
  expect(count).toBe(1);
  const bad = join(root, 'bad.json');
  const config = JSON.parse(await fs.readFile(bridge.file, 'utf8')); config.token = 'wrong';
  await fs.writeFile(bad, JSON.stringify(config), { mode: 0o600 });
  const attacker = connectChannelConversation(bad); closers.push(() => attacker.close());
  expect((await attacker.status()).connected).toBe(false);
  expect(await attacker.send({ requestId: 'denied', text: 'No delivery' })).toEqual({ accepted: false });
  expect(count).toBe(1);
});
