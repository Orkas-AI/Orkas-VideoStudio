import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig, ensureParentDir, fetchWithTimeout, postJson, getJson } from '@orkas/video-studio-core';
import type { OvsConfig, VideoProviderConfig } from '@orkas/video-studio-core';

const ARK_DEFAULT_BASE = 'https://ark.cn-beijing.volces.com/api/v3';
const DEFAULT_MODEL = 'doubao-seedance-2-0-260128';
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
  content?: { video_url?: string };
  error?: { message?: string };
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
 * Generate a video with the configured BYO provider (Doubao Seedance): create an
 * async task, poll until it succeeds, then download the result. Text-to-video by
 * default; pass a PUBLIC `image_url` for image-to-video.
 */
export async function generateVideo(params: VideoParams, config: OvsConfig = loadConfig(), opts: GenerateVideoOpts = {}): Promise<VideoResult> {
  const cfg = config.video;
  if (!cfg?.api_key) {
    throw new Error('No video provider configured. Set video.api_key (provider=doubao) in config, or OVS_VIDEO_* env vars.');
  }
  const now = opts.now ?? Date.now;
  const interval = opts.pollIntervalMs ?? POLL_INTERVAL_MS;

  const req = buildSeedanceCreateRequest(cfg, params);
  const created = (await postJson(req.url, req.body, req.headers, POLL_TIMEOUT_MS)) as CreateResp;
  const id = created.id;
  if (!id) throw new Error('video: task create returned no id');

  const base = arkBase(cfg);
  const authHeaders = { authorization: `Bearer ${cfg.api_key}` };
  const start = now();

  for (;;) {
    if (now() - start > TASK_TIMEOUT_MS) throw new Error(`video: task ${id} timed out after ${TASK_TIMEOUT_MS}ms`);
    const poll = (await getJson(`${base}/contents/generations/tasks/${id}`, authHeaders, POLL_TIMEOUT_MS)) as PollResp;
    if (poll.status === 'succeeded') {
      const url = poll.content?.video_url;
      if (!url) throw new Error(`video: task ${id} succeeded but returned no video_url`);
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
    if (poll.status === 'failed' || poll.status === 'canceled') {
      throw new Error(`video: task ${id} ${poll.status}`);
    }
    await sleep(interval);
  }
}
