import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig, ensureParentDir, fetchWithTimeout, postJson } from '@orkas/video-studio-core';
import type { OvsConfig, ImageProviderConfig } from '@orkas/video-studio-core';

const IMAGE_TIMEOUT_MS = 120_000;

export interface ImageParams {
  prompt: string;
  output: string;
  model?: string;
  size?: string;
  /** Public image URLs, ordered exactly as referenced by `reference_bindings`. */
  reference_image_urls?: string[];
  /** Local image paths, ordered before URL references in `reference_bindings`. */
  reference_images?: string[];
  /** Provider-neutral role and preservation contract for each reference. */
  reference_bindings?: ImageReferenceBinding[];
  /** Explicit concepts or artifacts the provider should avoid. */
  negative_prompt?: string[];
}

export const IMAGE_REFERENCE_ROLES = [
  'style',
  'identity',
  'composition',
  'structure',
  'content',
  'mask',
  'edit_source',
] as const;
export type ImageReferenceRole = typeof IMAGE_REFERENCE_ROLES[number];

export interface ImageReferenceBinding {
  index: number;
  role: ImageReferenceRole;
  strength?: number;
  preserve?: string[];
  may_change?: string[];
  region?: string;
}

export interface NormalizedImageReferenceBinding {
  index: number;
  role: ImageReferenceRole;
  strength: number;
  preserve: string[];
  mayChange: string[];
  region?: string;
}

export interface ProviderRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

const DEFAULT_GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const IMAGE_REFERENCE_ROLE_SET = new Set<string>(IMAGE_REFERENCE_ROLES);
const MAX_IMAGE_REFERENCES = 4;

function normalizeStringList(value: unknown, label: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`${label} must be an array of non-empty strings`);
  }
  return value.map((item) => String(item).trim());
}

export function normalizeImageReferenceBindings(
  value: unknown,
  referenceCount: number,
): NormalizedImageReferenceBinding[] {
  if (!Number.isInteger(referenceCount) || referenceCount < 0) {
    throw new Error('referenceCount must be a non-negative integer');
  }
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('reference_bindings must be an array');
  const seen = new Set<number>();
  return value.map((raw, itemIndex) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(`reference_bindings[${itemIndex}] must be an object`);
    }
    const binding = raw as Record<string, unknown>;
    const index = Number(binding.index);
    const role = String(binding.role || '') as ImageReferenceRole;
    const strength = binding.strength === undefined ? 1 : Number(binding.strength);
    if (!Number.isInteger(index) || index < 0 || index >= referenceCount) {
      throw new Error(`reference_bindings[${itemIndex}].index is outside the reference list`);
    }
    if (seen.has(index)) throw new Error(`reference_bindings repeats reference index ${index}`);
    seen.add(index);
    if (!IMAGE_REFERENCE_ROLE_SET.has(role)) throw new Error(`reference_bindings[${itemIndex}].role is invalid`);
    if (!Number.isFinite(strength) || strength < 0 || strength > 1) {
      throw new Error(`reference_bindings[${itemIndex}].strength must be from 0 to 1`);
    }
    const preserve = normalizeStringList(binding.preserve, `reference_bindings[${itemIndex}].preserve`);
    const mayChange = normalizeStringList(
      binding.may_change ?? binding.mayChange,
      `reference_bindings[${itemIndex}].may_change`,
    );
    const region = binding.region === undefined ? undefined : String(binding.region).trim();
    if (binding.region !== undefined && !region) {
      throw new Error(`reference_bindings[${itemIndex}].region must be non-empty`);
    }
    return { index, role, strength, preserve, mayChange, ...(region ? { region } : {}) };
  });
}

export function compileImagePromptContract(
  prompt: string,
  bindings: readonly NormalizedImageReferenceBinding[],
  negativePrompt: readonly string[],
): string {
  const thesis = String(prompt || '').trim();
  if (!thesis) throw new Error('image: prompt is required');
  const sections = [thesis];
  if (bindings.length) {
    sections.push([
      'Reference contract:',
      ...bindings.map((binding) => {
        const details = [
          `Reference ${binding.index + 1}: role=${binding.role}; strength=${binding.strength.toFixed(2)}`,
          ...(binding.region ? [`target region=${binding.region}`] : []),
          ...(binding.preserve.length ? [`preserve=${binding.preserve.join(', ')}`] : []),
          ...(binding.mayChange.length ? [`may change=${binding.mayChange.join(', ')}`] : []),
        ];
        return `- ${details.join('; ')}.`;
      }),
    ].join('\n'));
  }
  if (negativePrompt.length) sections.push(`Avoid: ${negativePrompt.join('; ')}.`);
  return sections.join('\n\n');
}

function normalizedPrompt(p: ImageParams): string {
  const localReferences = p.reference_images ?? [];
  const remoteReferences = p.reference_image_urls ?? [];
  const referenceCount = localReferences.length + remoteReferences.length;
  if (referenceCount > MAX_IMAGE_REFERENCES) {
    throw new Error(`image: at most ${MAX_IMAGE_REFERENCES} reference images are supported`);
  }
  if ([...localReferences, ...remoteReferences].some((value) => typeof value !== 'string' || !value.trim())) {
    throw new Error('image: reference image paths and URLs must be non-empty strings');
  }
  const bindings = normalizeImageReferenceBindings(p.reference_bindings, referenceCount);
  const negative = normalizeStringList(p.negative_prompt, 'negative_prompt');
  return compileImagePromptContract(p.prompt, bindings, negative);
}

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
      prompt: normalizedPrompt(p),
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
      contents: [{ parts: [{ text: normalizedPrompt(p) }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    },
  };
}

async function fetchBytes(url: string): Promise<Buffer> {
  const res = await fetchWithTimeout(url, { method: 'GET', timeoutMs: IMAGE_TIMEOUT_MS });
  if (!res.ok) throw new Error(`image download failed with HTTP ${res.status}`);
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

function detectImageMimeType(buf: Buffer): string {
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'image/png';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return '';
}

function parseImageDimensions(buf: Buffer, mimeType: string): { width: number; height: number } {
  try {
    if (mimeType === 'image/png') return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    if (mimeType === 'image/jpeg') {
      let offset = 2;
      while (offset < buf.length - 9) {
        if (buf[offset] !== 0xff) { offset += 1; continue; }
        const marker = buf[offset + 1]!;
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
        }
        if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x00) {
          offset += 2;
        } else {
          offset += 2 + buf.readUInt16BE(offset + 2);
        }
      }
    }
    if (mimeType === 'image/webp') {
      const format = buf.toString('ascii', 12, 16);
      if (format === 'VP8X') {
        return {
          width: 1 + (buf[24]! | (buf[25]! << 8) | (buf[26]! << 16)),
          height: 1 + (buf[27]! | (buf[28]! << 8) | (buf[29]! << 16)),
        };
      }
      if (format === 'VP8 ') {
        return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      }
      if (format === 'VP8L') {
        return {
          width: 1 + (((buf[22]! & 0x3f) << 8) | buf[21]!),
          height: 1 + (((buf[24]! & 0x0f) << 10) | (buf[23]! << 2) | ((buf[22]! & 0xc0) >> 6)),
        };
      }
    }
  } catch {
    return { width: 0, height: 0 };
  }
  return { width: 0, height: 0 };
}

export function validateGeneratedImage(buf: Buffer): { mime_type: string; width: number; height: number } {
  const mime_type = detectImageMimeType(buf);
  if (!mime_type) throw new Error('image provider returned invalid or unsupported image bytes');
  const { width, height } = parseImageDimensions(buf, mime_type);
  if (width <= 0 || height <= 0) throw new Error(`image provider returned malformed ${mime_type} data`);
  return { mime_type, width, height };
}

export interface ImageResult {
  output: string;
  bytes: number;
  mime_type: string;
  width: number;
  height: number;
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
    const references = [
      ...(params.reference_images ?? []).map((path) => ({ kind: 'local' as const, value: path })),
      ...(params.reference_image_urls ?? []).map((url) => ({ kind: 'remote' as const, value: url })),
    ];
    if (references.length) {
      const contents = req.body.contents as Array<{ parts: Array<Record<string, unknown>> }>;
      const textPart = contents[0]!.parts[0]!;
      const inlineParts = await Promise.all(references.map(async ({ kind, value }) => {
        const reference = kind === 'local' ? readFileSync(value) : await fetchBytes(value);
        const metadata = validateGeneratedImage(reference);
        return { inlineData: { data: reference.toString('base64'), mimeType: metadata.mime_type } };
      }));
      contents[0]!.parts = [...inlineParts, textPart];
    }
    const resp = await postJson(req.url, req.body, req.headers, IMAGE_TIMEOUT_MS);
    buf = decodeGemini(resp);
  } else {
    if (params.reference_images?.length || params.reference_image_urls?.length) {
      throw new Error('image: this OpenAI-compatible generation route does not support reference images; use Gemini or omit references');
    }
    const req = buildOpenAIImageRequest(cfg, params);
    const resp = await postJson(req.url, req.body, req.headers, IMAGE_TIMEOUT_MS);
    buf = await decodeOpenAI(resp);
  }
  const metadata = validateGeneratedImage(buf);
  try {
    ensureParentDir(params.output);
    writeFileSync(params.output, buf);
  } catch (error) {
    throw new Error(
      'Image was generated but could not be saved; fix the output path before retrying because the provider may already have charged for this request',
      { cause: error },
    );
  }
  return { output: resolve(params.output), bytes: buf.byteLength, ...metadata };
}
