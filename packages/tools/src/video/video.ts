import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig, ensureParentDir, fetchWithTimeout, postJson, getJson } from '@orkas/video-studio-core';
import type { OvsConfig, VideoProviderConfig } from '@orkas/video-studio-core';

const ARK_DEFAULT_BASE = 'https://ark.cn-beijing.volces.com/api/v3';
const DEFAULT_MODEL = 'doubao-seedance-2-0-260128';
const ATLAS_DEFAULT_BASE = 'https://api.atlascloud.ai/api/v1';
const ATLAS_DEFAULT_MODEL = 'bytedance/seedance-2.0/text-to-video';
// Atlas exposes image-to-video as its OWN model id, and the text-to-video
// model's schema has no `image` field — a first frame sent to it is ignored
// or rejected, never used.
const ATLAS_DEFAULT_I2V_MODEL = 'bytedance/seedance-2.0/image-to-video';
const MUAPI_DEFAULT_BASE = 'https://api.muapi.ai/api/v1';
const MUAPI_DEFAULT_T2V_MODEL = 'kling-v2.1-master-t2v';
const MUAPI_DEFAULT_I2V_MODEL = 'kling-v2.1-master-i2v';
const MUAPI_MODEL_KINDS = {
  'kling-v2.1-master-t2v': 't2v',
  'kling-v2.1-master-i2v': 'i2v',
  'kling-v2.1-standard-i2v': 'i2v',
  'kling-v2.1-pro-i2v': 'i2v',
} as const;
const MUAPI_SUPPORTED_MODELS = Object.keys(MUAPI_MODEL_KINDS).join(', ');
const MUAPI_SUPPORTED_RATIOS = ['16:9', '9:16', '1:1'] as const;
const MUAPI_SUPPORTED_DURATIONS = [5, 10] as const;
const POLL_INTERVAL_MS = 10_000;
const POLL_TIMEOUT_MS = 30_000; // per-poll request timeout — one slow poll must not fail the task
const TASK_TIMEOUT_MS = 60 * 60 * 1000;
const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000;

export interface VideoParams {
  prompt: string;
  output: string;
  model?: string;
  /** Optional first-frame reference as a PUBLIC image URL (image-to-video). */
  image_url?: string;
  /** Public reference images. Seedance accepts up to nine. */
  reference_image_urls?: string[];
  /** Source videos for provider-supported edit/reference workflows (maximum three). */
  reference_video_urls?: string[];
  operation?: 'generate' | 'edit';
  quality?: 'economy' | 'balanced' | 'quality';
  ratio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9';
  duration?: number;
  resolution?: '480p' | '720p' | '1080p';
  generate_audio?: boolean;
}

export interface ProviderRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

function arkBase(cfg: VideoProviderConfig): string {
  return (cfg.base_url ?? ARK_DEFAULT_BASE).replace(/\/+$/, '');
}

function atlasBase(cfg: VideoProviderConfig): string {
  return (cfg.base_url ?? ATLAS_DEFAULT_BASE).replace(/\/+$/, '');
}

function muapiBase(cfg: VideoProviderConfig): string {
  return (cfg.base_url ?? MUAPI_DEFAULT_BASE).replace(/\/+$/, '');
}

/** Build an Atlas Cloud media task request (`POST {base}/model/generateVideo`). */
export function buildAtlasCreateRequest(cfg: VideoProviderConfig, p: VideoParams): ProviderRequest {
  if (!cfg.api_key) throw new Error('video: no api_key configured');
  if (p.operation !== undefined && p.operation !== 'generate') {
    throw new Error('video: Atlas Cloud currently supports the generate operation');
  }
  if (p.reference_video_urls?.length || p.reference_image_urls?.length) {
    throw new Error('video: Atlas Cloud accepts a single first-frame image_url; additional references are not supported');
  }
  const duration = p.duration ?? 5;
  if (!Number.isFinite(duration) || duration < 4 || duration > 15) {
    throw new Error('video: duration must be between 4 and 15 seconds');
  }
  // Default the model by task type, and fail closed on an explicit mismatch:
  // a text-to-video model given a first frame would silently produce a video
  // that ignores the image, which is a wrong delivery, not an error.
  const model = p.model ?? cfg.model ?? (p.image_url ? ATLAS_DEFAULT_I2V_MODEL : ATLAS_DEFAULT_MODEL);
  if (p.image_url && /text-to-video/i.test(model)) {
    throw new Error(`video: model "${model}" is text-to-video and has no image input; use an image-to-video model (e.g. ${ATLAS_DEFAULT_I2V_MODEL}) for a first-frame image_url`);
  }
  if (!p.image_url && /image-to-video/i.test(model)) {
    throw new Error(`video: model "${model}" requires a first-frame image_url; pass one, or use a text-to-video model (e.g. ${ATLAS_DEFAULT_MODEL})`);
  }
  return {
    url: `${atlasBase(cfg)}/model/generateVideo`,
    headers: { authorization: `Bearer ${cfg.api_key}`, 'content-type': 'application/json' },
    body: {
      model,
      prompt: p.prompt,
      duration,
      resolution: p.resolution ?? '720p',
      ratio: p.ratio ?? '16:9',
      generate_audio: p.generate_audio !== false,
      ...(p.image_url ? { image: p.image_url } : {}),
    },
  };
}

/** Build a MuAPI submit request (`POST {base}/{model-endpoint}`). */
export function buildMuapiCreateRequest(cfg: VideoProviderConfig, p: VideoParams): ProviderRequest {
  if (!cfg.api_key) throw new Error('video: no api_key configured');
  if (!p.prompt.trim()) throw new Error('video: prompt is required');
  if (p.operation !== undefined && p.operation !== 'generate') {
    throw new Error('video: MuAPI currently supports the generate operation');
  }
  if (p.reference_image_urls?.length || p.reference_video_urls?.length) {
    throw new Error('video: MuAPI currently accepts one first-frame image_url; additional references are not supported');
  }
  if (p.quality !== undefined && !['economy', 'balanced', 'quality'].includes(p.quality)) {
    throw new Error('video: quality must be economy, balanced, or quality');
  }
  // Keep accepting provider-neutral plan fields so the sanctioned Gate-C flow
  // can pass them through. Kling v2.1 does not expose either control, so they
  // are deliberately omitted from the request rather than misrepresented.
  const duration = p.duration ?? 5;
  const model = p.model ?? cfg.model ?? (p.image_url ? MUAPI_DEFAULT_I2V_MODEL : MUAPI_DEFAULT_T2V_MODEL);
  if (!/^[A-Za-z0-9._-]+$/.test(model)) {
    throw new Error('video: MuAPI model must be a simple endpoint slug (letters, numbers, dots, underscores, and hyphens)');
  }
  const modelKind = MUAPI_MODEL_KINDS[model as keyof typeof MUAPI_MODEL_KINDS];
  if (!modelKind) {
    throw new Error(`video: unsupported MuAPI model "${model}"; supported endpoint slugs: ${MUAPI_SUPPORTED_MODELS}`);
  }
  if (modelKind === 'i2v' && !p.image_url) {
    throw new Error(`video: model "${model}" requires a first-frame image_url`);
  }
  if (modelKind === 't2v' && p.image_url) {
    throw new Error(`video: model "${model}" is text-to-video; use an image-to-video model for image_url`);
  }
  if (!Number.isInteger(duration) || !(MUAPI_SUPPORTED_DURATIONS as readonly number[]).includes(duration)) {
    throw new Error(`video: MuAPI model "${model}" supports durations 5 or 10 seconds`);
  }
  const ratio = p.ratio ?? '16:9';
  if (!(MUAPI_SUPPORTED_RATIOS as readonly string[]).includes(ratio)) {
    throw new Error(`video: MuAPI model "${model}" supports 16:9, 9:16, and 1:1 aspect ratios`);
  }
  return {
    url: `${muapiBase(cfg)}/${model}`,
    headers: { 'x-api-key': cfg.api_key, 'content-type': 'application/json' },
    body: {
      prompt: p.prompt,
      aspect_ratio: ratio,
      duration,
      ...(p.image_url ? { image_url: p.image_url } : {}),
    },
  };
}

/** Build the Doubao Seedance task-create request (`POST {base}/contents/generations/tasks`). */
export function buildSeedanceCreateRequest(cfg: VideoProviderConfig, p: VideoParams): ProviderRequest {
  if (!cfg.api_key) throw new Error('video: no api_key configured');
  if (p.operation !== undefined && p.operation !== 'generate' && p.operation !== 'edit') {
    throw new Error('video: operation must be generate or edit');
  }
  if (p.quality !== undefined && !['economy', 'balanced', 'quality'].includes(p.quality)) {
    throw new Error('video: quality must be economy, balanced, or quality');
  }
  const content: Array<Record<string, unknown>> = [{ type: 'text', text: p.prompt }];
  const referenceImages = [...new Set([...(p.reference_image_urls ?? []), ...(p.image_url ? [p.image_url] : [])])];
  if (referenceImages.length > 9) throw new Error('video: at most 9 reference images are supported');
  for (const url of referenceImages) {
    content.push({ type: 'image_url', role: 'reference_image', image_url: { url } });
  }
  const referenceVideos = [...new Set(p.reference_video_urls ?? [])];
  if (referenceVideos.length > 3) throw new Error('video: at most 3 reference videos are supported');
  if ((p.operation ?? 'generate') === 'edit' && referenceVideos.length === 0) {
    throw new Error('video: edit operation requires at least one reference video');
  }
  for (const url of referenceVideos) {
    content.push({ type: 'video_url', role: 'reference_video', video_url: { url } });
  }
  const duration = p.duration ?? 5;
  if (!Number.isFinite(duration) || duration < 4 || duration > 15) {
    throw new Error('video: duration must be between 4 and 15 seconds');
  }
  return {
    url: `${arkBase(cfg)}/contents/generations/tasks`,
    headers: { authorization: `Bearer ${cfg.api_key}`, 'content-type': 'application/json' },
    body: {
      model: p.model ?? cfg.model ?? DEFAULT_MODEL,
      content,
      ratio: p.ratio ?? '16:9',
      duration,
      resolution: p.resolution ?? '720p',
      generate_audio: p.generate_audio !== false,
      watermark: false,
    },
  };
}

interface CreateResp {
  id?: string;
}
interface PollResp {
  status?: string;
  content?: { video_url?: unknown };
  error?: { message?: string };
}
interface AtlasResp {
  code?: number;
  data?: {
    id?: string;
    status?: string;
    outputs?: unknown;
    output?: unknown;
    error?: unknown;
  };
}
interface MuapiCreateResp {
  request_id?: string;
}
interface MuapiPollResp {
  status?: string;
  outputs?: unknown;
  error?: unknown;
}

interface ProviderPollState {
  status?: string;
  outputUrl?: string;
  error?: string;
}

type VideoProvider = 'doubao' | 'atlas' | 'muapi';

interface VideoProviderAdapter {
  buildRequest: (cfg: VideoProviderConfig, params: VideoParams) => ProviderRequest;
  taskId: (response: unknown) => string | undefined;
  base: (cfg: VideoProviderConfig) => string;
  pollUrl: (base: string, id: string) => string;
  authHeaders: (cfg: VideoProviderConfig) => Record<string, string>;
  parsePoll: (response: unknown) => ProviderPollState;
}

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;
  if (Array.isArray(value)) return value.find((item): item is string => typeof item === 'string' && item.length > 0);
  return undefined;
}

function errorMessage(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  return typeof record.message === 'string' ? record.message : undefined;
}

function bearerHeaders(cfg: VideoProviderConfig): Record<string, string> {
  return { authorization: `Bearer ${cfg.api_key}` };
}

const VIDEO_PROVIDER_ADAPTERS: Record<VideoProvider, VideoProviderAdapter> = {
  doubao: {
    buildRequest: buildSeedanceCreateRequest,
    taskId: (response) => (response as CreateResp).id,
    base: arkBase,
    pollUrl: (base, id) => `${base}/contents/generations/tasks/${id}`,
    authHeaders: bearerHeaders,
    parsePoll: (response) => {
      const poll = response as PollResp;
      return {
        status: poll.status,
        outputUrl: firstString(poll.content?.video_url),
        error: errorMessage(poll.error),
      };
    },
  },
  atlas: {
    buildRequest: buildAtlasCreateRequest,
    taskId: (response) => (response as AtlasResp).data?.id,
    base: atlasBase,
    pollUrl: (base, id) => `${base}/model/prediction/${id}`,
    authHeaders: bearerHeaders,
    parsePoll: (response) => {
      const data = (response as AtlasResp).data;
      return {
        status: data?.status,
        outputUrl: firstString(data?.output) ?? firstString(data?.outputs),
        error: errorMessage(data?.error),
      };
    },
  },
  muapi: {
    buildRequest: buildMuapiCreateRequest,
    taskId: (response) => (response as MuapiCreateResp).request_id,
    base: muapiBase,
    pollUrl: (base, id) => `${base}/predictions/${id}/result`,
    authHeaders: (cfg) => ({ 'x-api-key': cfg.api_key! }),
    parsePoll: (response) => {
      const poll = response as MuapiPollResp;
      return {
        status: poll.status,
        outputUrl: firstString(poll.outputs),
        error: errorMessage(poll.error),
      };
    },
  },
};

function resolveVideoProvider(provider: VideoProviderConfig['provider']): VideoProvider {
  if (provider === undefined) return 'doubao';
  if (provider === 'doubao' || provider === 'atlas' || provider === 'muapi') return provider;
  throw new Error(`video: unsupported provider "${String(provider)}"; expected doubao, atlas, or muapi`);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface VideoResult {
  output: string;
  bytes: number;
  task_id: string;
}

export interface GenerateVideoOpts {
  /** Injectable clock + poll cadence for testing. */
  now?: () => number;
  pollIntervalMs?: number;
}

/** Require a complete ISO-BMFF `ftyp` box before persisting provider output. */
export function validateDownloadedVideo(buffer: Buffer): void {
  const scanLimit = Math.min(buffer.length, 4096);
  let offset = 0;
  while (offset + 8 <= scanLimit) {
    let boxSize = buffer.readUInt32BE(offset);
    const boxType = buffer.toString('ascii', offset + 4, offset + 8);
    let headerSize = 8;
    if (boxSize === 1) {
      if (offset + 16 > scanLimit) break;
      const extendedSize = buffer.readBigUInt64BE(offset + 8);
      if (extendedSize > BigInt(Number.MAX_SAFE_INTEGER)) break;
      boxSize = Number(extendedSize);
      headerSize = 16;
    }
    if (boxType === 'ftyp') {
      if (boxSize >= headerSize + 8 && offset + boxSize <= buffer.length) return;
      break;
    }
    if (boxSize === 0 || boxSize < headerSize || offset + boxSize > scanLimit) break;
    offset += boxSize;
  }
  throw new Error('video download returned invalid or unsupported MP4 bytes');
}

/**
 * Generate a video with the configured BYO provider: create an async task, poll until it
 * succeeds, then download the result. Text-to-video by default; pass a PUBLIC `image_url`
 * for image-to-video.
 */
export async function generateVideo(params: VideoParams, config: OvsConfig = loadConfig(), opts: GenerateVideoOpts = {}): Promise<VideoResult> {
  const cfg = config.video;
  if (!cfg?.api_key) {
    throw new Error('No video provider configured. Set video.provider and video.api_key (doubao, atlas, or muapi), or use OVS_VIDEO_API_KEY; MuAPI also supports MUAPI_API_KEY.');
  }
  const now = opts.now ?? Date.now;
  const interval = opts.pollIntervalMs ?? POLL_INTERVAL_MS;

  const provider = resolveVideoProvider(cfg.provider);
  const adapter = VIDEO_PROVIDER_ADAPTERS[provider];
  const req = adapter.buildRequest(cfg, params);
  const created = await postJson(req.url, req.body, req.headers, POLL_TIMEOUT_MS);
  const id = adapter.taskId(created);
  if (!id) throw new Error('video: task create returned no id');

  const base = adapter.base(cfg);
  const authHeaders = adapter.authHeaders(cfg);
  const start = now();

  for (;;) {
    if (now() - start > TASK_TIMEOUT_MS) throw new Error(`video: task ${id} timed out after ${TASK_TIMEOUT_MS}ms`);
    const response = await getJson(adapter.pollUrl(base, id), authHeaders, POLL_TIMEOUT_MS);
    const poll = adapter.parsePoll(response);
    const status = poll.status;
    const succeeded = status === 'succeeded' || status === 'completed';
    if (succeeded) {
      if (!poll.outputUrl) throw new Error(`video: task ${id} succeeded but returned no usable video_url`);
      const url = poll.outputUrl;
      const dl = await fetchWithTimeout(url, { method: 'GET', timeoutMs: DOWNLOAD_TIMEOUT_MS });
      if (!dl.ok) throw new Error(`video download failed with HTTP ${dl.status}`);
      const buf = Buffer.from(await dl.arrayBuffer());
      validateDownloadedVideo(buf);
      try {
        ensureParentDir(params.output);
        writeFileSync(params.output, buf);
      } catch (error) {
        throw new Error(
          'Video was generated but could not be saved; fix the output path before retrying because the provider may already have charged for this request',
          { cause: error },
        );
      }
      return { output: resolve(params.output), bytes: buf.byteLength, task_id: id };
    }
    if (status === 'failed' || status === 'canceled' || status === 'cancelled') {
      throw new Error(`video: task ${id} ${status}${poll.error ? `: ${poll.error}` : ''}`);
    }
    await sleep(interval);
  }
}
