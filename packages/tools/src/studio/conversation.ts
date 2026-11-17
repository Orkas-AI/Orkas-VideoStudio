import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

/** Launch configuration comes from the originating host, never browser input. */
export function connectOriginalConversation(clientPath: string) {
  let child: ChildProcessWithoutNullStreams | undefined;
  let closed = false, sequence = 0, buffer = '';
  const pending = new Map<number, { resolve(value: any): void; timer: ReturnType<typeof setTimeout> }>();
  function disconnect() {
    const current = child; child = undefined; buffer = '';
    current?.kill();
    for (const item of pending.values()) { clearTimeout(item.timer); item.resolve({ ok: false }); }
    pending.clear();
  }
  function start() {
    if (closed) throw new Error('Conversation client closed');
    if (child) return child;
    const current = spawn(process.execPath, [clientPath], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    child = current;
    current.stdin.on('error', () => { if (child === current) disconnect(); });
    current.once('error', () => { if (child === current) disconnect(); });
    current.once('close', () => { if (child === current) disconnect(); });
    current.stderr.resume(); // Companion diagnostics are never exposed as user copy.
    current.stdout.setEncoding('utf8');
    current.stdout.on('data', chunk => {
      if (child !== current) return;
      buffer += chunk;
      if (Buffer.byteLength(buffer) > 131072) { disconnect(); return; }
      while (buffer.includes('\n')) {
        const end = buffer.indexOf('\n'), line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        try {
          const value = JSON.parse(line), item = pending.get(value.id);
          if (item) { pending.delete(value.id); clearTimeout(item.timer); item.resolve(value); }
        } catch { disconnect(); return; }
      }
    });
    return current;
  }
  async function request(method: 'status' | 'send', params: Record<string, string> = {}) {
    if (closed || pending.size >= 8) return { ok: false };
    try {
      const target = start(), id = ++sequence;
      return await new Promise<any>(resolve => {
        const timer = setTimeout(disconnect, method === 'send' ? 25000 : 10000);
        pending.set(id, { resolve, timer });
        target.stdin.write(JSON.stringify({ id, method, params }) + '\n', error => { if (error && child === target) disconnect(); });
      });
    } catch { return { ok: false }; }
  }
  return {
    label: '',
    async status() {
      const response = await request('status');
      return response.ok && response.result?.connected === true
        ? { connected: true, busy: response.result.busy === true, label: String(response.result.label || '') }
        : { connected: false, busy: false, label: '' };
    },
    async send(input: { requestId: string; text: string }) {
      const response = await request('send', { request_id: input.requestId, text: input.text });
      return { accepted: response.ok === true && response.result?.accepted === true };
    },
    close() { closed = true; disconnect(); },
  };
}
