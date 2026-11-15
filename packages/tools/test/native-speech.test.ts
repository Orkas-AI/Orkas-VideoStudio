import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeSpeechBase64 } from '../src/speech/native-websocket.js';
import { synthesizeNativeSpeech } from '../src/speech/native.js';
afterEach(() => vi.unstubAllGlobals());
describe('native BYO speech', () => {
  it('rejects truncated or noncanonical audio encoding', () => {
    expect(decodeSpeechBase64('YQ==')).toEqual(Buffer.from('a'));
    for (const value of ['', 'YQ', 'YQ=', 'YR==', 'YQ==\n', '!!==']) expect(decodeSpeechBase64(value)).toBeUndefined();
  });
  it('reads a complete MiniMax audio envelope once and rejects a nonterminal envelope', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ base_resp: { status_code: 0 }, data: { status: 2, audio: '494433' } })));
    vi.stubGlobal('fetch', fetch);
    const cfg = { provider: 'minimax' as const, base_url: 'https://speech.invalid', api_key: 'test', model: 'speech-2.8-hd', voice: 'voice' };
    expect(await synthesizeNativeSpeech(cfg, { text: 'Hello', output: 'unused.mp3' })).toEqual(Buffer.from('ID3'));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ voice_setting: { voice_id: 'voice' } });
    fetch.mockResolvedValue(new Response(JSON.stringify({ base_resp: { status_code: 0 }, data: { status: 1, audio: '494433' } })));
    await expect(synthesizeNativeSpeech(cfg, { text: 'Hello', output: 'unused.mp3' })).rejects.toThrow(/complete/);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('rejects a clone-only voice or unsupported speed before dispatch', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(synthesizeNativeSpeech({ provider: 'aliyun', base_url: 'https://speech.invalid', api_key: 'test', model: 'cosyvoice-v3.5-plus' }, { text: 'Hello', output: 'unused.mp3' })).rejects.toThrow(/voice/);
    await expect(synthesizeNativeSpeech({ provider: 'google', base_url: 'https://speech.invalid', api_key: 'test', model: 'gemini-3.8-flash-tts' }, { text: 'Hello', speed: 2, output: 'unused.mp3' })).rejects.toThrow(/speed/);
    expect(fetch).not.toHaveBeenCalled();
  });
});

import { nativeSpeechRequest } from '../src/speech/native.js';
import { wrapPcm16MonoWav } from '../src/speech/audio.js';
it('uses Doubao V3 NDJSON completion, the cloned voice resource and distinct request UUIDs without accepting truncated audio', async () => {
  const cfg = { provider: 'doubao', api_key: 'test', voice: 'S_user-owned', format: 'wav' } as any;
  const p = { text: 'Exact line', output: 'unused.wav', speed: 1.1 };
  const a = nativeSpeechRequest(cfg, p), b = nativeSpeechRequest(cfg, p);
  expect(a.url).toBe('https://openspeech.bytedance.com/api/v3/tts/unidirectional');
  expect(a.headers['X-Api-Resource-Id']).toBe('seed-icl-2.0');
  expect(a.headers['X-Api-Request-Id']).not.toBe(b.headers['X-Api-Request-Id']);
  expect(a.body).toMatchObject({ req_params: { speaker: 'S_user-owned', model: 'seed-tts-2.0-standard', audio_params: { format: 'pcm', speech_rate: 10 } } });
  const pcm = Buffer.alloc(480, 1), chunk = JSON.stringify({ code: 0, data: pcm.toString('base64') });
  const fetch = vi.fn().mockResolvedValueOnce(new Response(chunk + '\n{"code":20000000}\n')).mockResolvedValueOnce(new Response(chunk));vi.stubGlobal('fetch', fetch);
  expect(await synthesizeNativeSpeech(cfg, p)).toEqual(wrapPcm16MonoWav(pcm));
  await expect(synthesizeNativeSpeech(cfg, p)).rejects.toThrow(/complete/);
  expect(fetch).toHaveBeenCalledTimes(2);
});
it('reads Google REST interaction steps and Alibaba complete receipts, keeping API keys away from audio downloads', async () => {
  const wav = wrapPcm16MonoWav(Buffer.alloc(480, 1));
  let count = 0;
  const fetch = vi.fn(async (url: any, init: any) => {
    count++;
    if (String(url).endsWith('/interactions')) return Response.json({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'audio', mime_type: 'audio/wav', data: wav.toString('base64') }] }] });
    if (String(url).includes('oss-cn-beijing')) { expect(init.headers).toBeUndefined(); return new Response(Buffer.from('ID3'), { headers: { 'content-type': 'audio/mpeg' } }); }
    return Response.json({ output: { finish_reason: 'stop', audio: { url: 'https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/audio.mp3' } } });
  });vi.stubGlobal('fetch', fetch);
  expect(await synthesizeNativeSpeech({ provider: 'google', api_key: 'test', format: 'wav' }, { text: 'Line', output: 'unused.wav' })).toEqual(wav);
  expect(await synthesizeNativeSpeech({ provider: 'aliyun', base_url: 'https://workspace.cn-beijing.maas.aliyuncs.com', api_key: 'test' }, { text: 'Line', output: 'unused.mp3' })).toEqual(Buffer.from('ID3'));
  expect(count).toBe(3);
});
it('does not forward Alibaba credentials to an untrusted result host or accept unfinished Google speech', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ output: { finish_reason: 'stop', audio: { url: 'https://attacker.invalid/audio' } } })).mockResolvedValueOnce(Response.json({ status: 'in_progress', steps: [] }));vi.stubGlobal('fetch', fetch);
  await expect(synthesizeNativeSpeech({ provider: 'aliyun', base_url: 'https://speech.invalid', api_key: 'test' }, { text: 'Line', output: 'unused.mp3' })).rejects.toThrow(/unsupported/);
  await expect(synthesizeNativeSpeech({ provider: 'google', api_key: 'test' }, { text: 'Line', output: 'unused.mp3' })).rejects.toThrow(/complete/);
  expect(fetch).toHaveBeenCalledTimes(2);
});
it('wraps native Eleven v4 PCM only for WAV, omits unsupported neutral speed settings, and refuses JSON errors', async () => {
  const pcm = Buffer.alloc(240, 1), cfg = { provider: 'elevenlabs' as const, api_key: 'test', model: 'eleven_v4', voice: 'enrolled', format: 'wav' };
  const req = nativeSpeechRequest(cfg, { text: 'Line', output: 'unused.wav', speed: 1 });
  expect(req.body).toEqual({ text: 'Line', model_id: 'eleven_v4' });
  const fetch = vi.fn().mockResolvedValueOnce(new Response(pcm)).mockResolvedValueOnce(Response.json({ error: 'failure' }));vi.stubGlobal('fetch', fetch);
  expect(await synthesizeNativeSpeech(cfg, { text: 'Line', output: 'unused.wav' })).toEqual(wrapPcm16MonoWav(pcm));
  await expect(synthesizeNativeSpeech(cfg, { text: 'Line', output: 'unused.wav' })).rejects.toThrow(/audio/);
});
