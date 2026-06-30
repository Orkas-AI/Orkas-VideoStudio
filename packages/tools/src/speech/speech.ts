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
    const t = await res.text();
    throw new Error(`TTS ${req.url} → ${res.status}: ${t.slice(0, 300)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_TTS_BYTES) throw new Error(`TTS response too large (${buf.byteLength} bytes)`);
  ensureParentDir(params.output);
  writeFileSync(params.output, buf);
  return { output: resolve(params.output), bytes: buf.byteLength };
}
