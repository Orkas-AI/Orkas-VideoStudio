import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig, ensureParentDir, fetchWithTimeout, postJson } from '@orkas/video-studio-core';
import type { OvsConfig, ImageProviderConfig } from '@orkas/video-studio-core';

const IMAGE_TIMEOUT_MS = 120_000;

export interface ImageParams {
  prompt: string;
  output: string;
  model?: string;
  size?: string;
}

export interface ProviderRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

const DEFAULT_GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** OpenAI-compatible image request (`POST {base}/images/generations`). Also
 *  covers Volcengine/Doubao Seedream, which speaks the same shape. */
export function buildOpenAIImageRequest(cfg: ImageProviderConfig, p: ImageParams): ProviderRequest {
  if (!cfg.base_url) throw new Error('image: no base_url configured');
  if (!cfg.api_key) throw new Error('image: no api_key configured');
  return {
    url: `${cfg.base_url.replace(/\/+$/, '')}/images/generations`,
    headers: { authorization: `Bearer ${cfg.api_key}`, 'content-type': 'application/json' },
    body: {
      model: p.model ?? cfg.model ?? 'gpt-image-1',
      prompt: p.prompt,
      size: p.size ?? '1024x1024',
      n: 1,
      response_format: 'b64_json',
    },
  };
}

/** Google Gemini image generation via `:generateContent` (x-goog-api-key). */
export function buildGeminiImageRequest(cfg: ImageProviderConfig, p: ImageParams): ProviderRequest {
  if (!cfg.api_key) throw new Error('image: no api_key configured');
  const base = (cfg.base_url ?? DEFAULT_GEMINI_BASE).replace(/\/+$/, '');
  const model = p.model ?? cfg.model ?? 'gemini-2.0-flash-preview-image-generation';
  return {
    url: `${base}/models/${model}:generateContent`,
    headers: { 'x-goog-api-key': cfg.api_key, 'content-type': 'application/json' },
    body: {
      contents: [{ parts: [{ text: p.prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    },
  };
}

async function fetchBytes(url: string): Promise<Buffer> {
  const res = await fetchWithTimeout(url, { method: 'GET', timeoutMs: IMAGE_TIMEOUT_MS });
  if (!res.ok) throw new Error(`image download ${url} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

interface OpenAIImageResp {
  data?: Array<{ b64_json?: string; url?: string }>;
}
interface GeminiImageResp {
  candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }>;
}

async function decodeOpenAI(resp: unknown): Promise<Buffer> {
  const d = (resp as OpenAIImageResp).data?.[0];
  if (d?.b64_json) return Buffer.from(d.b64_json, 'base64');
  if (d?.url) return fetchBytes(d.url);
  throw new Error('image: provider response had neither b64_json nor url');
}

function decodeGemini(resp: unknown): Buffer {
  const parts = (resp as GeminiImageResp).candidates?.[0]?.content?.parts ?? [];
  const inline = parts.find((p) => p.inlineData?.data)?.inlineData?.data;
  if (!inline) throw new Error('image: Gemini response had no inline image data');
  return Buffer.from(inline, 'base64');
}

export interface ImageResult {
  output: string;
  bytes: number;
}

/** Generate an image with the configured BYO image provider. */
export async function generateImage(params: ImageParams, config: OvsConfig = loadConfig()): Promise<ImageResult> {
  const cfg = config.image;
  if (!cfg?.api_key) {
    throw new Error('No image provider configured. Set image.provider/base_url/api_key in config, or OVS_IMAGE_* env vars.');
  }
  const provider = cfg.provider ?? 'openai';
  let buf: Buffer;
  if (provider === 'gemini') {
    const req = buildGeminiImageRequest(cfg, params);
    const resp = await postJson(req.url, req.body, req.headers, IMAGE_TIMEOUT_MS);
    buf = decodeGemini(resp);
  } else {
    const req = buildOpenAIImageRequest(cfg, params);
    const resp = await postJson(req.url, req.body, req.headers, IMAGE_TIMEOUT_MS);
    buf = await decodeOpenAI(resp);
  }
  ensureParentDir(params.output);
  writeFileSync(params.output, buf);
  return { output: resolve(params.output), bytes: buf.byteLength };
}
