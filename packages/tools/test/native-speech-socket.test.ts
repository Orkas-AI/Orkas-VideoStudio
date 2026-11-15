import { expect, it } from 'vitest';
import { WebSocketServer } from 'ws';
import { synthesizeNativeWebSocket } from '../src/speech/native-websocket.js';
async function server(run: (url: string, wss: WebSocketServer) => Promise<void>) {
  const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await new Promise<void>(resolve => wss.once('listening', resolve));
  try { await run(`http://127.0.0.1:${(wss.address() as any).port}`, wss); }
  finally { for (const client of wss.clients) client.terminate(); await new Promise<void>(resolve => wss.close(() => resolve())); }
}
it('completes one duplex task with matching receipt, ordered text and actual audio bytes', async () => {
  await server(async (url, wss) => {
    const actions: string[] = []; let connections = 0;
    wss.on('connection', (socket, request) => {
      connections++; expect(request.headers.authorization).toBe('Bearer local-key');
      socket.on('message', data => {
        const frame = JSON.parse(data.toString()); actions.push(frame.header.action);
        if (frame.header.action === 'run-task') socket.send(JSON.stringify({ header: { task_id: frame.header.task_id, event: 'task-started' } }));
        if (frame.header.action === 'continue-task') expect(frame.payload.input.text).toBe('Hello');
        if (frame.header.action === 'finish-task') { socket.send(Buffer.from('audio-bytes')); socket.send(JSON.stringify({ header: { task_id: frame.header.task_id, event: 'task-finished' } })); }
      });
    });
    const result = await synthesizeNativeWebSocket({ provider: 'aliyun', model: 'cosyvoice-v3.5-plus', baseUrl: url, apiKey: 'local-key' }, { text: 'Hello', voice: 'enrolled' }, AbortSignal.timeout(3000), 'mp3');
    expect(result).toEqual({ ok: true, audio: Buffer.from('audio-bytes') });
    expect(actions).toEqual(['run-task', 'continue-task', 'finish-task']); expect(connections).toBe(1);
  });
});
it('does not reconnect or replay after incomplete paid audio, and aborts a pending task', async () => {
  await server(async (url, wss) => {
    let connections = 0; wss.on('connection', socket => { connections++; socket.once('message', () => socket.close()); });
    const profile = { provider: 'elevenlabs', model: 'eleven_v4_turbo', baseUrl: url, apiKey: 'local-key' };
    const result = await synthesizeNativeWebSocket(profile, { text: 'Hello', voice: 'voice' }, AbortSignal.timeout(3000), 'mp3', 'mp3_44100_128');
    expect(result).toMatchObject({ ok: false, dispatched: true }); expect(connections).toBe(1);
  });
  await server(async (url, wss) => {
    const controller = new AbortController();
    wss.on('connection', socket => socket.once('message', () => controller.abort()));
    expect(await synthesizeNativeWebSocket({ provider: 'aliyun', model: 'cosyvoice-v3.5-plus', baseUrl: url, apiKey: 'local-key' }, { text: 'Hello', voice: 'voice', signal: controller.signal }, controller.signal, 'mp3')).toMatchObject({ ok: false, errorCode: 'E_TTS_ABORTED', dispatched: true });
  });
});
it('rejects an alien task receipt and malformed final audio without another connection', async () => {
  for (const provider of ['aliyun', 'elevenlabs']) await server(async (url, wss) => {
    let calls = 0; wss.on('connection', socket => { calls++; socket.once('message', () => socket.send(JSON.stringify(provider === 'aliyun' ? { header: { task_id: 'alien', event: 'task-started' } } : { audio: 'YR==', is_final: true }))); });
    expect(await synthesizeNativeWebSocket({ provider, model: provider === 'aliyun' ? 'cosyvoice-v3.5-plus' : 'eleven_v4_turbo', baseUrl: url, apiKey: 'local-key' }, { text: 'Hello', voice: 'voice' }, AbortSignal.timeout(3000), 'mp3', 'mp3_44100_128')).toMatchObject({ ok: false, dispatched: true }); expect(calls).toBe(1);
  });
});
