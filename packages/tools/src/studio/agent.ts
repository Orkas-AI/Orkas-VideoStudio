import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { acquireLease } from './lease.js';
import { isPathAllowed } from './host.js';
import { readTimelineJson } from '../composition/timeline.js';
import { writeBytesAtomic } from './host.js';

export type AgentOptions = { engine: 'codex' | 'claude'; root: string; resume?: string; newSession?: boolean; recover?: boolean; command?: string; prefixArgs?: string[] };
type Message = { role: 'user' | 'assistant'; text: string };
type NativeRequest = { id: string; kind: 'approval' | 'question'; title: string; detail: string; questions?: any[] };
type PendingRequest = { public: NativeRequest; native: any };
const MAX_RECORD = 2 * 1024 * 1024;
const MAX_TEXT = 200_000;

/** One browser-owned native conversation. No prompt rewriting, retries or fallback sessions. */
export class NativeAgent {
  private child?: ChildProcessWithoutNullStreams;
  private ready?: Promise<void>;
  private nextId = 0;
  private pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();
  private requests = new Map<string, PendingRequest>();
  private messages: Message[] = [];
  private thread?: string;
  private turn?: string;
  private busy = false;
  private status = 'idle';
  private generation = 0;
  private closed = false;
  private watchdog?: NodeJS.Timeout;
  private lease?: Awaited<ReturnType<typeof acquireLease>>;
  private sessionLease?: Awaited<ReturnType<typeof acquireLease>>;
  private closing?: Promise<void>;
  private claiming?: Promise<void>;
  private items = new Map<string, string>();
  private background = new Set<string>();
  private resultStatus?: string;
  constructor(private options: AgentOptions) {}

  state() {
    return { engine: this.options.engine, connected: !!this.child && !this.closed, busy: this.busy, status: this.status,
      generation: this.generation, messages: this.messages, requests: [...this.requests.values()].map(r => r.public) };
  }
  private write(value: unknown) {
    if (!this.child?.stdin.writable) throw new Error('agent_unavailable');
    this.child.stdin.write(`${JSON.stringify(value)}\n`);
  }
  private rpc(method: string, params: unknown): Promise<any> {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('agent_timeout')); }, 30_000);
      this.pending.set(id, { resolve, reject, timer });
      try { this.write({ id, method, params }); }
      catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }
  private append(text: string, delta: boolean) {
    const last = this.messages.at(-1);
    if (delta && last?.role === 'assistant') last.text = (last.text + text).slice(0, MAX_TEXT);
    else this.messages.push({ role: 'assistant', text: text.slice(0, MAX_TEXT) });
    this.messages = this.messages.slice(-100);
    while (this.messages.length > 1 && this.messages.reduce((size, message) => size + message.text.length, 0) > MAX_TEXT) this.messages.shift();
  }
  private finish(status: string) {
    this.busy = false; this.status = status; this.turn = undefined;
    this.requests.clear(); this.generation++;
    clearTimeout(this.watchdog);
    this.background.clear(); this.resultStatus = undefined;
  }
  private async persist() {
    if (this.thread) await writeBytesAtomic(join(this.options.root, '.ovs-studio-session.json'), Buffer.from(JSON.stringify({ engine: this.options.engine, session: this.thread })));
  }
  private receive(message: any) {
    if (typeof message.id === 'number' && !message.method) {
      const pending = this.pending.get(message.id);
      if (pending) { clearTimeout(pending.timer); this.pending.delete(message.id); message.error ? pending.reject(new Error('agent_request_failed')) : pending.resolve(message.result); }
      return;
    }
    if (this.options.engine === 'codex') {
      const p = message.params ?? {};
      if (message.id !== undefined && message.method) {
        const id = randomUUID();
        const question = message.method === 'item/tool/requestUserInput';
        const approval = ['item/commandExecution/requestApproval', 'item/fileChange/requestApproval', 'item/permissions/requestApproval'].includes(message.method);
        if (!question && !approval) { this.write({ id: message.id, error: { code: -32601, message: 'Unsupported host request.' } }); return; }
        if (this.requests.size >= 32) { this.write({ id: message.id, error: { code: -32000, message: 'Too many pending user requests.' } }); return; }
        this.requests.set(id, { public: { id, kind: question ? 'question' : 'approval', title: String(p.reason ?? '').slice(0, 2000),
          detail: String(p.command ?? this.items.get(p.itemId) ?? (p.permissions ? JSON.stringify(p.permissions, null, 2) : '')).slice(0, 20_000), ...(question ? { questions: p.questions ?? [] } : {}) }, native: message });
        this.status = 'waiting';
      } else if (message.method === 'item/started' && p.item?.type === 'fileChange') {
        if (this.items.size >= 100) this.items.delete(this.items.keys().next().value!);
        this.items.set(p.item.id, (p.item.changes ?? []).map((change: any) => `${change.path}\n${change.diff ?? ''}`).join('\n').slice(0, 20_000));
      } else if (message.method === 'item/agentMessage/delta') this.append(String(p.delta ?? ''), true);
      else if (message.method === 'turn/started') this.turn = p.turn?.id;
      else if (message.method === 'turn/completed') this.finish(p.turn?.status === 'completed' ? 'completed' : p.turn?.status === 'interrupted' ? 'stopped' : 'failed');
      else if (message.method === 'error' && p.willRetry !== true) this.finish('failed');
    } else {
      if (message.type === 'system' && message.subtype === 'init') {
        if (typeof message.session_id !== 'string' || this.thread && this.thread !== message.session_id) {
          void this.close().then(() => this.finish('failed')); return;
        }
        this.thread = message.session_id; void this.claimSession().then(() => this.persist()).catch(() => { void this.close().then(() => this.finish('failed')); });
      } else if (message.type === 'system' && message.subtype === 'task_started' && typeof message.task_id === 'string') {
        this.background.add(message.task_id);
      } else if (message.type === 'system' && message.subtype === 'task_notification') {
        this.background.delete(message.task_id);
        if (message.status === 'failed') this.resultStatus = 'failed';
        if (!this.background.size && this.resultStatus) this.finish(this.resultStatus);
      } else if (message.type === 'control_request') {
        const r = message.request ?? {};
        if (r.subtype !== 'can_use_tool') { this.write({ type: 'control_response', response: { subtype: 'error', request_id: message.request_id, error: 'Unsupported host request.' } }); return; }
        const id = randomUUID(), question = r.tool_name === 'AskUserQuestion';
        this.requests.set(id, { public: { id, kind: question ? 'question' : 'approval', title: String(r.tool_name),
          detail: String(r.input?.command ?? r.input?.file_path ?? r.description ?? '').slice(0, 20_000),
          ...(question ? { questions: (r.input?.questions ?? []).map((q: any, index: number) => ({ ...q, id: `q${index}` })) } : {}) }, native: message });
        this.status = 'waiting';
      } else if (message.type === 'assistant') {
        for (const c of message.message?.content ?? []) if (c.type === 'text') this.append(String(c.text), false);
      } else if (message.type === 'result') {
        this.resultStatus = message.is_error || message.subtype !== 'success' ? 'failed' : this.resultStatus ?? 'completed';
        if (!this.background.size) this.finish(this.resultStatus);
      }
    }
  }
  private async open() {
    const command = this.options.command ?? this.options.engine;
    const prefix = this.options.prefixArgs ?? [];
    const version = await new Promise<string>((resolveVersion, reject) => {
      const probe = spawn(command, [...prefix, '--version'], { cwd: this.options.root, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true, shell: process.platform === 'win32' });
      let output = '';
      const timer = setTimeout(() => { probe.kill(); reject(new Error('agent_unavailable')); }, 10_000);
      probe.stdout.on('data', chunk => { output = (output + chunk).slice(0, 1024); });
      probe.on('error', () => { clearTimeout(timer); reject(new Error('agent_unavailable')); });
      probe.on('close', code => { clearTimeout(timer); code === 0 ? resolveVersion(output) : reject(new Error('agent_unavailable')); });
    });
    const match = /\b(\d+)\.(\d+)\.(\d+)\b/.exec(version);
    const minimum = this.options.engine === 'codex' ? [0, 160, 1] : [2, 1, 148];
    if (!match || match.slice(1).map(Number).reduce((order, n, index) => order || Math.sign(n - minimum[index]), 0) < 0) throw new Error('agent_version');
    if (!isPathAllowed(join(this.options.root, '.ovs-studio-session.json'), [this.options.root])) throw new Error('agent_session');
    const stored = await readTimelineJson(join(this.options.root, '.ovs-studio-session.json'), null) as { engine?: string; session?: string } | null;
    this.thread = this.options.resume ?? (!this.options.newSession && stored?.engine === this.options.engine ? stored.session : undefined);
    if (this.thread && !/^[A-Za-z0-9_-]{1,200}$/.test(this.thread)) throw new Error('agent_session');
    const lockPath = join(this.options.root, '.ovs-studio-agent.lock');
    if (!isPathAllowed(lockPath, [this.options.root])) throw new Error('agent_session');
    this.lease = await acquireLease(lockPath, this.options.recover).catch(() => { throw new Error('agent_busy'); });
    if (this.thread) await this.claimSession();
    const args = this.options.engine === 'codex' ? ['app-server', '--listen', 'stdio://']
      : ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--permission-prompt-tool', 'stdio', ...(this.thread ? ['--resume', this.thread] : [])];
    if (this.closed) throw new Error('agent_unavailable');
    const child = spawn(command, [...prefix, ...args], { cwd: this.options.root, stdio: 'pipe', windowsHide: true, shell: process.platform === 'win32', detached: process.platform !== 'win32' });
    this.child = child;
    await this.lease.update(child.pid);
    await this.sessionLease?.update(child.pid);
    let buffer = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      buffer += chunk;
      if (buffer.length > MAX_RECORD) { child.kill(); this.finish('failed'); return; }
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
        if (!line.trim()) continue;
        try { this.receive(JSON.parse(line)); } catch { child.kill(); this.finish('failed'); }
      }
    });
    // Native diagnostics may contain credentials or private paths. Do not forward raw stderr.
    child.stderr.resume();
    child.stdin.on('error', () => this.finish('failed'));
    child.on('error', () => this.finish('failed'));
    child.on('close', () => {
      if (this.child === child) this.child = undefined;
      if (!this.closed) { this.closed = true; this.finish('failed'); void this.close(); }
      for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('agent_unavailable')); }
      this.pending.clear();
    });
    if (this.options.engine === 'codex') {
      await this.rpc('initialize', { clientInfo: { name: 'ovs-studio', version: '1.0.0' }, capabilities: { experimentalApi: true } });
      this.write({ method: 'initialized', params: {} });
      const result = await this.rpc(this.thread ? 'thread/resume' : 'thread/start', { ...(this.thread ? { threadId: this.thread } : {}), cwd: this.options.root });
      if (!result?.thread?.id || this.thread && this.thread !== result.thread.id || (result.cwd ?? result.thread.cwd) && resolve(result.cwd ?? result.thread.cwd) !== resolve(this.options.root)) throw new Error('agent_session');
      if ((result.thread.turns ?? []).some((turn: any) => turn.status === 'inProgress')) throw new Error('agent_busy');
      this.thread = result.thread.id;
      if (!this.sessionLease) await this.claimSession();
      await this.persist();
    }
  }
  async send(text: string) {
    if (this.busy) throw new Error('agent_busy');
    if (this.closed) {
      await this.close();
      // A new explicit submission resumes the saved conversation, never the failed turn.
      this.options = { ...this.options, resume: this.thread ?? this.options.resume, newSession: false };
      this.closed = false; this.ready = undefined; this.closing = undefined; this.claiming = undefined;
    }
    if (typeof text !== 'string' || !text.trim() || text.length > 20_000) throw new Error('invalid');
    this.busy = true; this.status = 'running';
    try {
      this.ready ??= this.open();
      await this.ready;
      if (this.closed) throw new Error('agent_unavailable');
      this.messages.push({ role: 'user', text }); this.messages = this.messages.slice(-100);
      this.watchdog = setTimeout(() => { void this.stop(); }, 60 * 60_000);
      if (this.options.engine === 'codex') {
        const result = await this.rpc('turn/start', { threadId: this.thread, input: [{ type: 'text', text, text_elements: [] }] });
        if (this.busy) this.turn = result.turn?.id;
      } else this.write({ type: 'user', message: { role: 'user', content: [{ type: 'text', text }] } });
      return { ok: true };
    } catch (error) { this.finish('failed'); await this.close(); throw error; }
  }
  async respond(id: string, answer: { allow?: boolean; answers?: Record<string, string[]> }) {
    const request = this.requests.get(id);
    if (!request) throw new Error('changed');
    const message = request.native;
    if (this.options.engine === 'codex') {
      const result = request.public.kind === 'question' ? { answers: answer.allow ? Object.fromEntries(Object.entries(answer.answers ?? {}).map(([key, value]) => [key, { answers: value }])) : {} }
        : message.method === 'item/permissions/requestApproval' ? { permissions: answer.allow ? message.params.permissions : {}, scope: 'turn' }
        : { decision: answer.allow ? 'accept' : 'decline' };
      this.write({ id: message.id, result });
    } else {
      const original = message.request.input ?? {};
      const answers = Object.fromEntries((request.public.questions ?? []).map(q => [q.question, (answer.answers?.[q.id] ?? []).join(', ')]));
      this.write({ type: 'control_response', response: { subtype: 'success', request_id: message.request_id,
        response: answer.allow ? { behavior: 'allow', updatedInput: { ...original, ...(request.public.kind === 'question' ? { answers } : {}) } } : { behavior: 'deny', message: 'The user declined this request.' } } });
    }
    this.requests.delete(id); this.status = this.requests.size ? 'waiting' : 'running';
  }
  async stop() {
    if (!this.busy) return;
    try {
      if (this.options.engine === 'codex' && this.turn) await this.rpc('turn/interrupt', { threadId: this.thread, turnId: this.turn });
      else if (this.options.engine === 'claude') this.write({ type: 'control_request', request_id: randomUUID(), request: { subtype: 'interrupt' } });
    } finally { await this.close(); this.finish('stopped'); }
  }
  private claimSession() { this.claiming ??= this.claimSessionOnce(); return this.claiming; }
  private async claimSessionOnce() {
    if (this.sessionLease || !this.thread) return;
    const directory = join(tmpdir(), `ovs-studio-sessions-${process.getuid?.() ?? 'user'}`);
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const name = createHash('sha256').update(`${this.options.engine}:${this.thread}`).digest('hex');
    this.sessionLease = await acquireLease(join(directory, name + '.lock'), this.options.recover).catch(() => { throw new Error('agent_busy'); });
    await this.sessionLease.update(this.child?.pid);
  }
  close() {
    this.closing ??= this.closeOnce();
    return this.closing;
  }
  private async closeOnce() {
    this.closed = true; clearTimeout(this.watchdog);
    const child = this.child;
    if (child) {
      await new Promise<void>(resolveClose => {
        const kill = (signal: NodeJS.Signals) => {
          if (!child.pid) return;
          if (process.platform === 'win32') {
            const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
            killer.on('error', () => child.kill(signal));
          } else { try { process.kill(-child.pid, signal); } catch { child.kill(signal); } }
        };
        const timer = setTimeout(() => kill('SIGKILL'), 2000);
        child.once('close', () => { clearTimeout(timer); resolveClose(); });
        child.stdin.end(); kill('SIGTERM');
      });
    }
    await this.claiming?.catch(() => {});
    await this.sessionLease?.release(); this.sessionLease = undefined;
    await this.lease?.release(); this.lease = undefined;
    if (this.busy) this.finish('stopped');
  }
}
