import { randomUUID } from 'node:crypto';
import { ttsModelPreset, TTS_MODELS, fetchAndReadWithTimeout, readResponseBytes, type TtsProviderConfig } from '@orkas/video-studio-core';
import type { SpeakParams, HttpRequestShape } from './speech.js';
import { decodeSpeechBase64, synthesizeNativeWebSocket } from './native-websocket.js';
import { convertTtsWav, wrapPcm16MonoWav } from './audio.js';
const MAX = 50 * 1024 * 1024;
export function nativeSpeechRequest(cfg: TtsProviderConfig, p: SpeakParams): HttpRequestShape & { voice: string; format: string; model: string; socket: boolean } {
  const provider = cfg.provider ?? 'openai-compatible';
  const model = p.model ?? cfg.model ?? TTS_MODELS[provider]?.[0]?.id;
  const preset = model ? ttsModelPreset(provider, model) : undefined;
  if (!preset || !cfg.api_key) throw new Error('Configure a supported native speech model and API key.');
  const voice = p.voice ?? cfg.voice ?? preset.defaultVoice;
  const format = (p.format ?? cfg.format ?? 'mp3').toLowerCase();
  if (!voice || !preset.formats.includes(format) || p.speed !== undefined && (!Number.isFinite(p.speed) || (preset.speed ? p.speed < preset.speed[0] || p.speed > preset.speed[1] : p.speed !== 1)) || !p.text.trim() || Array.from(p.text).length > (preset.maxCharacters ?? 100_000)) throw new Error('Check the speech voice, text length, format and speed before generating.');
  const bases: Record<string, string> = { doubao: 'https://openspeech.bytedance.com', minimax: 'https://api.minimax.io/v1', google: 'https://generativelanguage.googleapis.com/v1beta', elevenlabs: 'https://api.elevenlabs.io/v1' };
  const base = (cfg.base_url ?? bases[provider] ?? '').replace(/\/+$/, '');
  if (!base) throw new Error('Configure the native speech base URL.');
  let url = '', body: Record<string, unknown> = {};
  let headers: Record<string, string> = { Authorization: `Bearer ${cfg.api_key}`, 'Content-Type': 'application/json' };
  const socket = model!.startsWith('cosyvoice-') || model === 'eleven_v4_turbo';
  if (provider === 'doubao') {
    const v = voice.toLowerCase();
    const resource = cfg.resource_id?.trim() || (v.startsWith('s_') ? 'seed-icl-2.0' : /_(moon|mars)_/.test(v) || v.startsWith('icl_') ? 'seed-tts-1.0' : 'seed-tts-2.0');
    const codec = format === 'wav' ? 'pcm' : ['opus', 'ogg'].includes(format) ? 'ogg_opus' : format;
    url = base + '/api/v3/tts/unidirectional';
    headers = { 'X-Api-Key': cfg.api_key!, 'X-Api-Resource-Id': resource, 'X-Api-Request-Id': randomUUID(), 'Content-Type': 'application/json' };
    body = { user: { uid: 'ovs' }, req_params: { text: p.text, speaker: voice, ...(resource === 'seed-icl-2.0' ? { model: 'seed-tts-2.0-standard' } : {}), audio_params: { format: codec, sample_rate: codec === 'ogg_opus' ? 48000 : 24000, ...(p.speed === undefined ? {} : { speech_rate: Math.round((p.speed - 1) * 100) }) } } };
  }
  if (provider === 'minimax') { url = base + '/t2a_v2'; body = { model, text: p.text, stream: false, output_format: 'hex', voice_setting: { voice_id: voice, speed: p.speed ?? 1 }, audio_setting: { format, sample_rate: format === 'opus' ? 24000 : 32000, bitrate: 128000, channel: 1 } }; }
  if (provider === 'aliyun') { url = base + '/api/v1/services/audio/tts/SpeechSynthesizer'; body = { model, input: { text: p.text, voice, format, sample_rate: 24000, rate: p.speed ?? 1 } }; }
  if (provider === 'google') { url = base + '/interactions'; headers = { 'x-goog-api-key': cfg.api_key!, 'Content-Type': 'application/json' }; body = { model, input: [{ type: 'user_input', content: [{ type: 'text', text: p.text }] }], response_format: { type: 'audio' }, generation_config: { speech_config: [{ voice }] }, store: false }; }
  if (provider === 'elevenlabs') {
    if (p.speed !== undefined && (p.speed < .7 || p.speed > 1.2)) throw new Error('ElevenLabs speed must be between 0.7 and 1.2.');
    const codecs: Record<string, string> = { mp3: 'mp3_44100_128', wav: 'pcm_24000', pcm: 'pcm_24000', opus: 'opus_48000_128' };
    url = base + '/text-to-speech/' + encodeURIComponent(voice) + '?' + new URLSearchParams({ output_format: codecs[format] }); headers = { 'xi-api-key': cfg.api_key!, 'Content-Type': 'application/json' };
    body = { text: p.text, model_id: model };
  }
  return { url, headers, body, voice, format, model: model!, socket };
}
export async function synthesizeNativeSpeech(cfg: TtsProviderConfig, p: SpeakParams, parent?: AbortSignal): Promise<Buffer> {
  parent?.throwIfAborted();
  const req = nativeSpeechRequest(cfg, p), signal = parent ? AbortSignal.any([parent, AbortSignal.timeout(60_000)]) : AbortSignal.timeout(60_000);
  if (req.socket) {
    const base = cfg.base_url ?? (cfg.provider === 'elevenlabs' ? 'https://api.elevenlabs.io/v1' : '');
    const codec = ({ mp3: 'mp3_44100_128', wav: 'pcm_24000', pcm: 'pcm_24000', opus: 'opus_48000_128' } as Record<string, string>)[req.format];
    const result = await synthesizeNativeWebSocket({ provider: cfg.provider!, model: req.model, apiKey: cfg.api_key!, baseUrl: base, proxyUrl: cfg.proxy_url }, { ...p, voice: req.voice, signal: parent }, signal, req.format, codec);
    if (!result.ok) throw new Error(`Speech did not complete (${result.errorCode}); check the selected provider before manually retrying.`);
    return cfg.provider === 'elevenlabs' && req.format === 'wav' ? wrapPcm16MonoWav(result.audio) : result.audio;
  }
  return fetchAndReadWithTimeout(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body), signal, timeoutMs: 60_000, redirect: 'error' }, async (response, bounded) => {
    if (!response.ok) { await response.body?.cancel(); throw new Error(`The speech provider rejected the request (HTTP ${response.status}); check the model and credentials before retrying.`); }
    const bytes = await readResponseBytes(response, cfg.provider === 'aliyun' ? 1024 * 1024 : MAX * 2 + 1024 * 1024, bounded);
    if (cfg.provider === 'elevenlabs') {
      if (/^(application\/(json|xml|problem\+json)|text\/)/i.test(response.headers.get('content-type') ?? '') || !bytes.length || bytes.length > MAX) throw new Error('Speech did not return complete audio.');
      return req.format === 'wav' ? wrapPcm16MonoWav(bytes) : bytes;
    }
    if (cfg.provider === 'doubao') {
      const chunks: Buffer[] = []; let done = false, total = 0;
      for (const raw of bytes.toString('utf8').split('\n')) {
        const line = raw.trim().replace(/^data:\s*/, ''); if (!line) continue;
        let row: any; try { row = JSON.parse(line); } catch { continue; }
        if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
        const code = Number(row.code);
        if (code === 20000000) { done = true; continue; }
        if (Number.isFinite(code) && code !== 0) throw new Error('Speech did not complete; the provider may already have charged.');
        if (code === 0 && typeof row.data === 'string') {
          const chunk = decodeSpeechBase64(row.data);
          if (!chunk || done || (total += chunk.length) > MAX - (req.format === 'wav' ? 44 : 0)) throw new Error('Speech did not return complete audio.');
          chunks.push(chunk);
        }
      }
      if (!done || !chunks.length) throw new Error('Speech did not complete; no audio was saved.');
      const audio = Buffer.concat(chunks, total);
      return req.format === 'wav' ? wrapPcm16MonoWav(audio) : audio;
    }
    const data = JSON.parse(bytes.toString('utf8'));
    if (cfg.provider === 'minimax') {
      const hex = data.data?.audio;
      if (data.base_resp?.status_code === 0 && data.data?.status === 2 && typeof hex === 'string' && hex.length > 0 && hex.length <= MAX * 2 && hex.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(hex)) return Buffer.from(hex, 'hex');
    } else if (cfg.provider === 'google') {
      const outputs = data.status === 'completed' && Array.isArray(data.steps) ? data.steps.filter((s: any) => s?.type === 'model_output').flatMap((s: any) => Array.isArray(s.content) ? s.content : []).filter((c: any) => c?.type === 'audio') : [];
      if (outputs.length === 1 && outputs[0].mime_type === 'audio/wav') {
        const wav = decodeSpeechBase64(outputs[0].data);
        const audio = wav ? await convertTtsWav(wav, req.format, bounded) : undefined;
        if (audio?.length) return audio;
      }
    } else if (cfg.provider === 'aliyun' && data.output?.finish_reason === 'stop' && !data.code) {
      const url = new URL(data.output.audio.url);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port || url.hostname !== 'dashscope-result-bj.oss-cn-beijing.aliyuncs.com') throw new Error('Speech returned an unsupported download URL.');
      url.protocol = 'https:';
      return fetchAndReadWithTimeout(url.href, { signal: bounded, redirect: 'error', timeoutMs: 60_000 }, async (res, timeout) => {
        if (!res.ok || /^(application\/(json|xml|problem\+json)|text\/)/i.test(res.headers.get('content-type') ?? '')) { await res.body?.cancel(); throw new Error('Speech did not return complete audio.'); }
        const audio = await readResponseBytes(res, MAX, timeout);
        if (!audio.length) throw new Error('Speech returned empty audio.');
        return audio;
      });
    }
    throw new Error('Speech did not return a complete audio artifact.');
  });
}
