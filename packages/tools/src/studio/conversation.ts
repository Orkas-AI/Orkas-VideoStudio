import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as net from 'node:net';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { WebSocket, Agent } from 'undici';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

export type Conversation = {
  label: string;
  status(): Promise<{ connected: boolean; busy: boolean; label: string }>;
  send(input: { requestId: string; text: string }): Promise<{ accepted: boolean }>;
  close(): void;
};
const unavailable = { connected: false, busy: false, label: '' };
const validThread = (value: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const validInput = (v: any) => v && typeof v.requestId === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(v.requestId)
  && typeof v.text === 'string' && !!v.text.trim() && v.text.length <= 20000;

/** Receipts survive reconnects. An uncertain side effect is never replayed. */
function receipts(deliver: (input: { requestId: string; text: string }) => Promise<{ accepted: boolean }>) {
  const seen = new Map<string, { digest: string; result: Promise<{ accepted: boolean }> }>();
  return (input: { requestId: string; text: string }) => {
    if (!validInput(input)) return Promise.resolve({ accepted: false });
    const digest = createHash('sha256').update(input.text).digest('hex');
    const old = seen.get(input.requestId);
    if (old) return old.digest === digest ? old.result : Promise.resolve({ accepted: false });
    if (seen.size >= 1024) return Promise.resolve({ accepted: false });
    const result = Promise.resolve().then(() => deliver(input)).catch(() => ({ accepted: false }));
    seen.set(input.requestId, { digest, result }); return result;
  };
}

/** Bounded JSONL transport for an existing service; never starts an Agent/server. */
function lines(open: () => { input: NodeJS.WritableStream; output: NodeJS.ReadableStream; close(): void; onClose(fn: () => void): void }) {
  let channel: ReturnType<typeof open> | undefined, buffer = '', sequence = 0, closed = false;
  const pending = new Map<number, { resolve(value: any): void; timer: ReturnType<typeof setTimeout> }>();
  function disconnect() {
    const old = channel; channel = undefined; buffer = ''; old?.close();
    for (const item of pending.values()) { clearTimeout(item.timer); item.resolve(undefined); } pending.clear();
  }
  function start() {
    if (closed) throw new Error('Conversation closed');
    if (channel) return channel;
    const current = open(); channel = current;
    current.onClose(() => { if (channel === current) disconnect(); });
    current.input.on('error', () => { if (channel === current) disconnect(); });
    current.output.on('data', chunk => {
      if (channel !== current) return;
      buffer += chunk;
      if (Buffer.byteLength(buffer) > 131072) { disconnect(); return; }
      while (buffer.includes('\n')) {
        const end = buffer.indexOf('\n'), line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        try { const value = JSON.parse(line), item = pending.get(value.id);
          if (item) { pending.delete(value.id); clearTimeout(item.timer); item.resolve(value); }
        } catch { disconnect(); return; }
      }
    });
    return current;
  }
  return {
    async request(method: string, params: unknown = {}, extra: object = {}) {
      if (closed || pending.size >= 8) return undefined;
      try { const target = start(), id = ++sequence;
        return await new Promise<any>(resolve => {
          const timer = setTimeout(disconnect, 10000); pending.set(id, { resolve, timer });
          target.input.write(JSON.stringify({ jsonrpc: '2.0', id, method, params, ...extra }) + '\n');
        });
      } catch { return undefined; }
    },
    close() { closed = true; disconnect(); },
  };
}
async function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<{ ok: boolean; text: string }> {
  return new Promise(resolve => {
    const p = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, timeout: 10000, killSignal: 'SIGKILL' });
    let text = '', size = 0;
    for (const stream of [p.stdout, p.stderr]) stream.on('data', chunk => {
      size += chunk.length;
      if (size > 65536) p.kill('SIGKILL'); else if (stream === p.stdout) text += chunk;
    });
    p.once('error', () => resolve({ ok: false, text: '' }));
    p.once('close', code => resolve({ ok: code === 0 && size <= 65536, text }));
  });
}

export function connectCodexConversation(options: { threadId: string; command?: string; prefix?: string[]; env?: NodeJS.ProcessEnv; socketPath?: string }): Conversation {
  const command = options.command ?? 'codex', prefix = options.prefix ?? [], env = { ...(options.env ?? process.env) };
  const threadId = options.threadId;
  let closed = false, initialized: Promise<boolean> | undefined;
  const socketPath = options.socketPath ?? join(env.CODEX_HOME || join(homedir(), '.codex'), 'app-server-control', 'app-server-control.sock');
  let physicalSocket = socketPath;
  const dispatcher = new Agent({ connect: (_options, callback) => {
    const socket = net.createConnection(physicalSocket);
    const onError = (error: Error) => callback(error, null);
    socket.once('error', onError);
    socket.once('connect', () => { socket.removeListener('error', onError); callback(null, socket); });
    return socket;
  } });
  let ws: WebSocket | undefined, sequence = 0;
  const pending = new Map<number, { resolve(value: any): void; timer: ReturnType<typeof setTimeout> }>();
  function disconnect() {
    const old = ws; ws = undefined; initialized = undefined; old?.close();
    for (const item of pending.values()) { clearTimeout(item.timer); item.resolve(undefined); } pending.clear();
  }
  function request(method: string, params: unknown) {
    if (!ws || ws.readyState !== WebSocket.OPEN || pending.size >= 8) return Promise.resolve(undefined);
    return new Promise<any>(resolve => {
      const id = ++sequence, timer = setTimeout(disconnect, 10000);
      pending.set(id, { resolve, timer }); ws!.send(JSON.stringify({ id, method, params }));
    });
  }
  const ready = () => initialized ??= (async () => {
    if (!validThread(threadId)) return false;
    const v = await run(command, [...prefix, '--version'], env);
    // Minimum verified CLI/queue contract, independent of model access.
    const m = /^codex-cli (\d+)\.(\d+)\.(\d+)\s*$/.exec(v.text.trim());
    if (!v.ok || !m || !(+m[1] > 0 || +m[2] > 160 || +m[2] === 160 && +m[3] >= 1) || closed) return false;
    // Codex may advertise a long rendezvous symlink; connect to its short physical path.
    physicalSocket = process.platform === 'win32' && socketPath.startsWith('\\\\.\\pipe\\') ? socketPath : await fs.realpath(socketPath).catch(() => '');
    if (!physicalSocket || closed) return false;
    const current = new WebSocket('ws://localhost/', { dispatcher }); ws = current;
    current.addEventListener('message', event => {
      if (ws !== current) return;
      if (typeof event.data !== 'string' || Buffer.byteLength(event.data) > 131072) { disconnect(); return; }
      try { const value = JSON.parse(event.data), item = pending.get(value.id);
        if (item) { pending.delete(value.id); clearTimeout(item.timer); item.resolve(value); }
      } catch { disconnect(); }
    });
    const opened = await new Promise<boolean>(done => {
      const timer = setTimeout(() => { done(false); disconnect(); }, 5000);
      current.addEventListener('open', () => { clearTimeout(timer); done(true); }, { once: true });
      current.addEventListener('error', () => { clearTimeout(timer); done(false); if (ws === current) disconnect(); }, { once: true });
      current.addEventListener('close', () => { clearTimeout(timer); done(false); if (ws === current) disconnect(); }, { once: true });
    });
    if (!opened || closed) return false;
    const response = await request('initialize', { clientInfo: { name: 'ovs_canvas', version: '1' } });
    if (!response?.result) return false;
    ws?.send(JSON.stringify({ method: 'initialized' })); return true;
  })();
  async function status() {
    if (closed || !await ready()) return unavailable;
    const response = await request('thread/read', { threadId, includeTurns: false });
    const thread = response?.result?.thread, type = thread?.status?.type;
    return thread?.id === threadId && ['idle', 'active', 'systemError'].includes(type)
      ? { connected: true, busy: type === 'active', label: 'Codex' } : unavailable;
  }
  return { label: 'Codex', status,
    send: receipts(async input => {
      if (!(await status()).connected || closed) return { accepted: false };
      // Queue uses the original session's settings. No resume/fork/exec fallback.
      const result = await run(command, [...prefix, 'queue', '--thread', threadId, '--message', input.text], env);
      return { accepted: result.ok };
    }),
    close() { closed = true; disconnect(); void dispatcher.destroy(); },
  };
}

type ChannelConfig = { socket: string; token: string };
export function connectChannelConversation(file: string): Conversation {
  let closed = false;
  let config: ChannelConfig | undefined;
  let transport: ReturnType<typeof lines> | undefined;
  async function request(method: string, params = {}) {
    if (closed) return undefined;
    try {
      if (!config) {
        const stat = await fs.lstat(file);
        if (!stat.isFile() || stat.size > 4096 || process.platform !== 'win32' && (stat.uid !== process.getuid?.() || (stat.mode & 0o077))) return undefined;
        const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
        if (typeof parsed.socket !== 'string' || typeof parsed.token !== 'string' || !/^[a-f0-9]{64}$/.test(parsed.token)) return undefined;
        config = parsed;
        transport = lines(() => {
          const socket = net.createConnection(config!.socket); socket.setEncoding('utf8');
          return { input: socket, output: socket, close: () => socket.destroy(), onClose(fn) { socket.once('error', fn); socket.once('close', fn); } };
        });
      }
      return await transport!.request(method, params, { token: config!.token });
    } catch { return undefined; }
  }
  return { label: 'Claude Code',
    async status() { return (await request('status'))?.result?.connected === true ? { connected: true, busy: false, label: 'Claude Code' } : unavailable; },
    send: receipts(async input => ({ accepted: (await request('send', input))?.result?.accepted === true })),
    close() { closed = true; transport?.close(); },
  };
}

/** Owned by the already-running opt-in MCP channel. The browser never gets this capability. */
export async function createClaudeChannelBridge(deliver: (event: { content: string; meta: { request_id: string } }) => Promise<void>, file?: string) {
  const directory = await fs.mkdtemp(join(tmpdir(), 'ovs-channel-')); await fs.chmod(directory, 0o700);
  const socketPath = process.platform === 'win32' ? `\\\\.\\pipe\\ovs-${randomBytes(16).toString('hex')}` : join(directory, 'channel.sock');
  const token = randomBytes(32).toString('hex'), sockets = new Set<net.Socket>();
  let closed = false;
  const send = receipts(async input => { if (closed) return { accepted: false }; await deliver({ content: input.text, meta: { request_id: input.requestId } }); return { accepted: true }; });
  const server = net.createServer(socket => {
    sockets.add(socket); socket.setEncoding('utf8'); socket.on('error', () => {}); socket.once('close', () => sockets.delete(socket));
    socket.setTimeout(30000, () => socket.destroy());
    let buffer = '', pending = 0;
    socket.on('data', chunk => {
      buffer += chunk;
      if (Buffer.byteLength(buffer) > 131072) { socket.destroy(); return; }
      while (buffer.includes('\n')) {
        const end = buffer.indexOf('\n'), line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        if (++pending > 8) { socket.destroy(); return; }
        void (async () => {
          let id: unknown = null, result: unknown = undefined;
          try {
            const m = JSON.parse(line); id = m.id;
            const supplied = Buffer.from(typeof m.token === 'string' ? m.token : '');
            if (!closed && supplied.length === token.length && timingSafeEqual(supplied, Buffer.from(token))
              && !Object.keys(m).some(k => !['jsonrpc', 'id', 'method', 'params', 'token'].includes(k))) {
              if (m.method === 'status' && m.params && !Object.keys(m.params).length) result = { connected: true };
              if (m.method === 'send' && validInput(m.params) && !Object.keys(m.params).some(k => !['requestId', 'text'].includes(k))) result = await send(m.params);
            }
          } catch { /* A malformed request cannot dispatch. */ }
          if (!closed && !socket.destroyed) socket.write(JSON.stringify({ id, result }) + '\n');
        })().finally(() => pending--);
      }
    });
  });
  server.maxConnections = 4;
  const configFile = file ?? join(directory, 'connection.json');
  let wroteConfig = false;
  async function close() {
    if (closed) return; closed = true;
    for (const socket of sockets) socket.destroy();
    if (server.listening) await new Promise<void>(done => server.close(() => done()));
    if (wroteConfig) await fs.rm(configFile, { force: true });
    await fs.rm(directory, { recursive: true, force: true });
  }
  try {
    await new Promise<void>((done, fail) => { server.once('error', fail); server.listen(socketPath, done); });
    if (process.platform !== 'win32') await fs.chmod(socketPath, 0o600);
    await fs.writeFile(configFile, JSON.stringify({ socket: socketPath, token }), { flag: 'wx', mode: 0o600 }); wroteConfig = true;
    return { file: configFile, close };
  } catch (error) { await close(); throw error; }
}

export function resolveOriginalConversation(env: NodeJS.ProcessEnv = process.env): Conversation | undefined {
  if (env.OVS_CONVERSATION_FILE) return connectChannelConversation(env.OVS_CONVERSATION_FILE);
  if (!env.CLAUDECODE && env.CODEX_THREAD_ID && validThread(env.CODEX_THREAD_ID)) return connectCodexConversation({ threadId: env.CODEX_THREAD_ID, env });
  return undefined;
}
