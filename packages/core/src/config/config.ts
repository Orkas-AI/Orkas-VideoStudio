import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * BYO provider configuration. Generation (image/video) and TTS are opt-in and
 * use the user's OWN keys/endpoints — OrkasVideoStudio ships no managed backend.
 * The zero-key trunk (compose / edit / transcribe) needs none of this.
 */
export interface TtsProviderConfig {
  /** OpenAI-compatible base URL, e.g. https://api.openai.com/v1 */
  base_url?: string;
  api_key?: string;
  model?: string;
  voice?: string;
  format?: string;
}
export interface ImageProviderConfig {
  provider?: 'openai' | 'gemini' | 'doubao';
  base_url?: string;
  api_key?: string;
  model?: string;
}
export interface VideoProviderConfig {
  provider?: 'doubao';
  base_url?: string;
  api_key?: string;
  model?: string;
}
export interface OvsConfig {
  tts?: TtsProviderConfig;
  image?: ImageProviderConfig;
  video?: VideoProviderConfig;
}

/** Config file location: $OVS_CONFIG_DIR/config.json, else ~/.config/orkas-video-studio/config.json */
export function configPath(): string {
  const dir =
    process.env.OVS_CONFIG_DIR ||
    join(process.env.HOME || process.env.USERPROFILE || '.', '.config', 'orkas-video-studio');
  return join(dir, 'config.json');
}

/**
 * Load BYO config from disk, then overlay env vars (env wins). Missing file is
 * fine — returns `{}` and the env overlay still applies. A malformed file is a
 * thrown error (the user asked to configure providers; silently ignoring it
 * would be worse than failing loudly).
 */
export function loadConfig(): OvsConfig {
  const p = configPath();
  let fromFile: OvsConfig = {};
  if (existsSync(p)) {
    try {
      fromFile = JSON.parse(readFileSync(p, 'utf8')) as OvsConfig;
    } catch (err) {
      throw new Error(`failed to parse config at ${p}: ${(err as Error).message}`);
    }
  }
  const tts: TtsProviderConfig = {
    ...fromFile.tts,
    ...(process.env.OVS_TTS_BASE_URL ? { base_url: process.env.OVS_TTS_BASE_URL } : {}),
    ...(process.env.OVS_TTS_API_KEY ? { api_key: process.env.OVS_TTS_API_KEY } : {}),
    ...(process.env.OVS_TTS_MODEL ? { model: process.env.OVS_TTS_MODEL } : {}),
    ...(process.env.OVS_TTS_VOICE ? { voice: process.env.OVS_TTS_VOICE } : {}),
    ...(process.env.OVS_TTS_FORMAT ? { format: process.env.OVS_TTS_FORMAT } : {}),
  };
  const image: ImageProviderConfig = {
    ...fromFile.image,
    ...(process.env.OVS_IMAGE_PROVIDER ? { provider: process.env.OVS_IMAGE_PROVIDER as ImageProviderConfig['provider'] } : {}),
    ...(process.env.OVS_IMAGE_BASE_URL ? { base_url: process.env.OVS_IMAGE_BASE_URL } : {}),
    ...(process.env.OVS_IMAGE_API_KEY ? { api_key: process.env.OVS_IMAGE_API_KEY } : {}),
    ...(process.env.OVS_IMAGE_MODEL ? { model: process.env.OVS_IMAGE_MODEL } : {}),
  };
  const video: VideoProviderConfig = {
    ...fromFile.video,
    ...(process.env.OVS_VIDEO_PROVIDER ? { provider: process.env.OVS_VIDEO_PROVIDER as VideoProviderConfig['provider'] } : {}),
    ...(process.env.OVS_VIDEO_BASE_URL ? { base_url: process.env.OVS_VIDEO_BASE_URL } : {}),
    ...(process.env.OVS_VIDEO_API_KEY ? { api_key: process.env.OVS_VIDEO_API_KEY } : {}),
    ...(process.env.OVS_VIDEO_MODEL ? { model: process.env.OVS_VIDEO_MODEL } : {}),
  };
  const out: OvsConfig = { ...fromFile };
  if (Object.keys(tts).length) out.tts = tts;
  if (Object.keys(image).length) out.image = image;
  if (Object.keys(video).length) out.video = video;
  return out;
}
