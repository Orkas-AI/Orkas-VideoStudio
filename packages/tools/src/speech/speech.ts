import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig, ensureParentDir, fetchWithTimeout } from '@orkas/video-studio-core';
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
  if (!cfg.base_url) throw new Error('TTS: no base_url configured');
  if (!cfg.api_key) throw new Error('TTS: no api_key configured');
  const url = `${cfg.base_url.replace(/\/+$/, '')}/audio/speech`;
  const body: Record<string, unknown> = {
    model: p.model ?? cfg.model ?? 'tts-1',
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
}

export interface SpeechCapabilities {
  configured: boolean;
  route_ref: 'openai-compatible';
  model: string;
  voice: string;
  format: string;
  supports_speed: true;
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
  if (!cfg.base_url) missing.push('tts.base_url');
  if (!cfg.api_key) missing.push('tts.api_key');
  return {
    configured: missing.length === 0,
    route_ref: 'openai-compatible',
    model: cfg.model ?? 'tts-1',
    voice: cfg.voice ?? 'alloy',
    format: cfg.format ?? 'mp3',
    supports_speed: true,
    missing,
  };
}

/** Synthesize narration to an audio file via the configured BYO TTS provider. */
export async function speak(params: SpeakParams, config: OvsConfig = loadConfig()): Promise<SpeakResult> {
  const cfg = config.tts;
  if (!cfg?.base_url || !cfg.api_key) {
    throw new Error(
      'No TTS provider configured. Set tts.base_url + tts.api_key in ~/.config/orkas-video-studio/config.json, or OVS_TTS_BASE_URL / OVS_TTS_API_KEY.',
    );
  }
  const req = buildOpenAITtsRequest(cfg, params);
  const res = await fetchWithTimeout(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify(req.body),
    timeoutMs: TTS_TIMEOUT_MS,
  });
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    throw providerHttpFailure(res.status);
  }
  if (isClearlyNonAudioResponse(res)) {
    await res.body?.cancel().catch(() => {});
    throw new Error('TTS provider returned a non-audio response; no audio file was saved');
  }
  const declared = Number(res.headers.get('content-length') || 0);
  if (declared > MAX_TTS_BYTES) {
    await res.body?.cancel().catch(() => {});
    throw new Error('TTS response was too large and was not saved');
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_TTS_BYTES) throw new Error('TTS response was too large and was not saved');
  if (!buf.byteLength) throw new Error('TTS provider returned empty audio');
  try {
    ensureParentDir(params.output);
    writeFileSync(params.output, buf);
  } catch (error) {
    throw new Error(
      'Speech was generated but could not be saved; fix the output path before retrying because the provider may already have charged for this request',
      { cause: error },
    );
  }
  return { output: resolve(params.output), bytes: buf.byteLength };
}
