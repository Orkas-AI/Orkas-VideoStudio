import * as fs from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import type { VideoAssetRecord } from '@orkas/video-studio-core';
import { isPathAllowed } from './host.js';
import { validateDownloadedVideo } from '../video/video.js';

/** Direct native inputs; no Orkas upload service or public project server. */
export const INLINE_IMAGE_PROVIDERS = new Set(['doubao', 'minimax', 'vidu', 'runway', 'google', 'google-cloud']);
export const INLINE_VIDEO_PROVIDERS = new Set(['minimax', 'google']);
export async function localReference(root: string, row: VideoAssetRecord) {
  const file = await fs.realpath(resolve(root, row.path));
  if (!isPathAllowed(file, [root])) throw new Error('invalid');
  const stat = await fs.stat(file);
  if (!stat.isFile() || stat.size > 20 * 1024 * 1024) throw new Error('unsupported');
  if (row.kind === 'video') {
    const bytes = await fs.readFile(file);
    if (bytes.length > 20 * 1024 * 1024) throw new Error('unsupported');
    validateDownloadedVideo(bytes);
    return `data:video/mp4;base64,${bytes.toString('base64')}`;
  }
  if (row.kind !== 'image') throw new Error('invalid');
  const bytes = await sharp(file, { limitInputPixels: 40_000_000 }).rotate().resize(2048, 2048, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
  if (bytes.length > 4 * 1024 * 1024) throw new Error('unsupported');
  return `data:image/jpeg;base64,${bytes.toString('base64')}`;
}
