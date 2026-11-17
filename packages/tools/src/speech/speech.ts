import { writeGenerationRecord } from '../generation-record.js';
import { nativeSpeechRequest, synthesizeNativeSpeech } from './native.js';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, statSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig, ensureParentDir, fetchAndReadWithTimeout, readResponseBytes, ttsModelPreset, TTS_MODELS } from '@orkas/video-studio-core';
import type { OvsConfig, TtsProviderConfig } from '@orkas/video-studio-core';

const MAX_TTS_BYTES = 50 * 1024 * 1024; // guard against an unbounded audio body
const TTS_TIMEOUT_MS = 60_000;

export interface SpeakParams {
  text: string;
  output: string;
  voice?: string;
  model?: string;
  format?: string;
  speed?: number;
  /** Language is approval/receipt metadata; the compatible API receives text. */
  language?: string;
}

export interface HttpRequestShape {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

/**
 * Build an OpenAI-compatible TTS request (`POST {base}/audio/speech`). Covers
 * OpenAI and any OpenAI-compatible endpoint (ElevenLabs-compatible, Volcengine,
 * etc.). The voice id is BYO — pick one your provider offers. Pure/testable.
 */
export function buildOpenAITtsRequest(cfg: TtsProviderConfig, p: SpeakParams): HttpRequestShape {
  if (!cfg.base_url && cfg.provider !== 'openai') throw new Error('TTS: no base_url configured');
  if (!cfg.api_key) throw new Error('TTS: no api_key configured');
  const url = `${(cfg.base_url ?? 'https://api.openai.com/v1').replace(/\/+$/, '')}/audio/speech`;
  const body: Record<string, unknown> = {
    model: p.model ?? cfg.model ?? (cfg.provider === 'openai' ? 'gpt-4o-mini-tts' : 'tts-1'),
    input: p.text,
    voice: p.voice ?? cfg.voice ?? 'alloy',
    response_format: p.format ?? cfg.format ?? 'mp3',
  };
  if (typeof p.speed === 'number' && Number.isFinite(p.speed)) body.speed = p.speed;
  return { url, headers: { authorization: `Bearer ${cfg.api_key}`, 'content-type': 'application/json' }, body };
}

export interface SpeakResult {
  output: string;
  bytes: number;
  receipt_path: string;
  reused: boolean;
}

export interface SpeechCapabilities {
  configured: boolean;
  route_ref: string;
  model: string;
  voice: string;
  format: string;
  supports_speed: boolean;
  missing: string[];
}

function isClearlyNonAudioResponse(res: Response): boolean {
  const contentType = String(res.headers.get('content-type') || '').split(';', 1)[0]!.trim().toLowerCase();
  return [
    'application/json',
    'application/problem+json',
    'application/xml',
    'text/xml',
    'text/html',
    'text/plain',
  ].includes(contentType);
}

function providerHttpFailure(status: number): Error {
  if (status === 401 || status === 403) {
    return new Error('TTS provider rejected the configured credentials; update provider settings before retrying');
  }
  if (status === 400 || status === 404 || status === 422) {
    return new Error('TTS provider rejected the request; verify model, voice, language, and format before retrying');
  }
  if (status === 429) return new Error('TTS provider is rate limited; wait before starting a new retry');
  return new Error(status >= 500 ? 'TTS provider is temporarily unavailable' : 'TTS provider could not complete the request');
}

/** Return the executable BYO speech selection without exposing its API key. */
export function capabilities(config: OvsConfig = loadConfig()): SpeechCapabilities {
  const cfg = config.tts ?? {};
  const missing: string[] = [];
  const native = cfg.provider && cfg.provider !== 'openai-compatible' && cfg.provider !== 'openai';
  const preset = native ? ttsModelPreset(cfg.provider!, cfg.model ?? TTS_MODELS[cfg.provider!]?.[0]?.id ?? '') : undefined;
  if (!cfg.base_url && cfg.provider !== 'openai' && (!native || cfg.provider === 'aliyun')) missing.push('tts.base_url');
  if (native && !preset) missing.push('tts.model');
  if (native && !cfg.voice && !preset?.defaultVoice) missing.push('tts.voice');
  if (!cfg.api_key) missing.push('tts.api_key');
  return {
    configured: missing.length === 0,
    route_ref: cfg.provider ?? 'openai-compatible',
    model: cfg.model ?? preset?.id ?? (cfg.provider === 'openai' ? 'gpt-4o-mini-tts' : 'tts-1'),
    voice: cfg.voice ?? preset?.defaultVoice ?? (native ? '' : 'alloy'),
    format: cfg.format ?? 'mp3',
    supports_speed: !native || Boolean(preset?.speed),
    missing,
  };
}

/** Synthesize narration to an audio file via the configured BYO TTS provider. */
export async function speak(params: SpeakParams, config: OvsConfig = loadConfig(), opts: { signal?: AbortSignal } = {}): Promise<SpeakResult> {
  opts.signal?.throwIfAborted();
  const cfg = config.tts;
  const native = cfg?.provider && cfg.provider !== 'openai-compatible' && cfg.provider !== 'openai';
  if (!cfg?.api_key || !native && !cfg.base_url && cfg.provider !== 'openai') {
    throw new Error(
      'No TTS provider configured. Set tts.base_url + tts.api_key in ~/.config/orkas-video-studio/config.json, or OVS_TTS_BASE_URL / OVS_TTS_API_KEY.',
    );
  }
  const req = native ? nativeSpeechRequest(cfg, params) : buildOpenAITtsRequest(cfg, params);
  const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
  const requestSignature = digest(JSON.stringify({ url: req.url, body: req.body, language: params.language ?? '' }));
  const receiptPath = `${resolve(params.output)}.receipt.json`;
  // A cross-process claim prevents two paid dispatches to the same output.
  // Never reclaim an unknown owner's lock automatically after a crash.
  ensureParentDir(params.output);
  const lockPath = `${resolve(params.output)}.speak.lock`;
  let lock: number;
  try { lock = openSync(lockPath, 'wx'); }
  catch { throw new Error('Another speech request is in progress for this output; resolve its result before retrying.'); }
  const provenance = () => {
    const profile = capabilities(config);
    return { kind: 'audio' as const, prompt: params.text, model: `${profile.route_ref}/${params.model ?? profile.model}`,
      request: { route_ref: profile.route_ref, voice_ref: params.voice ?? profile.voice, language: params.language, speed: params.speed, format: params.format ?? profile.format } };
  };
  try {
  let cached: Buffer | undefined;
  try {
    if (statSync(receiptPath).size > 64 * 1024) throw new Error('Speech receipt exceeds 64 KiB.');
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
    if (receipt.request_signature === requestSignature) {
      const previous = statSync(params.output);
      if (!previous.isFile() || previous.size > MAX_TTS_BYTES) throw new Error('Cached speech exceeds 50 MiB.');
      const audio = readFileSync(params.output);
      if (audio.length > 0 && digest(audio) === receipt.audio_sha256) cached = audio;
    }
  } catch { /* No verified matching receipt: never claim an existing file matches. */ }
  if (cached) { await writeGenerationRecord(params.output, provenance()); return { output: resolve(params.output), bytes: cached.length, receipt_path: receiptPath, reused: true }; }
  const buf = native ? await synthesizeNativeSpeech(cfg, params, opts.signal) : await fetchAndReadWithTimeout(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify(req.body),
    timeoutMs: TTS_TIMEOUT_MS,
    signal: opts.signal,
  }, async (res, signal) => {
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      throw providerHttpFailure(res.status);
    }
    if (isClearlyNonAudioResponse(res)) {
      await res.body?.cancel().catch(() => {});
      throw new Error('TTS provider returned a non-audio response; no audio file was saved');
    }
    return readResponseBytes(res, MAX_TTS_BYTES, signal);
  });
  opts.signal?.throwIfAborted();
  if (!buf.byteLength) throw new Error('TTS provider returned empty audio');
  try {
    ensureParentDir(params.output);
    writeFileSync(params.output, buf);
    writeFileSync(receiptPath, JSON.stringify({ schema_version: 1, request_signature: requestSignature, audio_sha256: digest(buf), bytes: buf.length }, null, 2) + '\n');
  } catch (error) {
    throw new Error(
      'Speech was generated but could not be saved; fix the output path before retrying because the provider may already have charged for this request',
      { cause: error },
    );
  }
  await writeGenerationRecord(params.output, provenance());
  return { output: resolve(params.output), bytes: buf.byteLength, receipt_path: receiptPath, reused: false };
  } finally { closeSync(lock); unlinkSync(lockPath); }
}
