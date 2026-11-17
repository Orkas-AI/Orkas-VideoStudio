import * as fs from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { resolve } from 'node:path';

export type GenerationRecord = {
  schema_version: 1; kind: 'image' | 'video' | 'audio'; sha256: string;
  prompt: string; model: string; request: Record<string, unknown>;
  reference_files?: Array<{ path: string; role: 'reference' | 'first_frame' | 'last_frame' }>;
};
/** Provider-neutral provenance stays beside the generated file; credentials are never recorded. */
export async function writeGenerationRecord(output: string, data: Omit<GenerationRecord, 'schema_version' | 'sha256'>) {
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(output)) hash.update(bytes);
  const file = `${resolve(output)}.ovs-generation.json`, temporary = `${file}.${randomUUID()}.tmp`;
  try {
    const content = JSON.stringify({ schema_version: 1, ...data, sha256: hash.digest('hex') });
    if (Buffer.byteLength(content) > 1024 * 1024) throw new Error('Generation metadata exceeds 1 MiB.');
    await fs.writeFile(temporary, content, { flag: 'wx', mode: 0o600 }); await fs.rename(temporary, file);
  } catch (cause) { throw new Error('The generated file is saved, but its edit metadata could not be saved. Preserve the file; do not regenerate to repair metadata.', { cause }); }
  finally { await fs.rm(temporary, { force: true }); }
}

const records = new Map<string, { key: string; value: GenerationRecord | null }>();
/** Revalidate when file identity or metadata changes; cache is bounded across productions. */
export async function readGenerationRecord(output: string): Promise<GenerationRecord | null> {
  const file = `${output}.ovs-generation.json`;
  const [media, metadata] = await Promise.all([fs.stat(output).catch(() => null), fs.stat(file).catch(() => null)]);
  if (!media?.isFile() || !metadata?.isFile() || metadata.size > 1024 * 1024) return null;
  const key = `${media.ino}:${media.size}:${media.mtimeMs}:${media.ctimeMs}:${metadata.ino}:${metadata.size}:${metadata.mtimeMs}:${metadata.ctimeMs}`;
  if (records.get(output)?.key === key) return records.get(output)!.value;
  let value: GenerationRecord | null = null;
  try {
    const raw = JSON.parse(await fs.readFile(file, 'utf8')) as GenerationRecord;
    if (raw.schema_version === 1 && ['image', 'video', 'audio'].includes(raw.kind) && typeof raw.prompt === 'string' && typeof raw.model === 'string' && raw.request && typeof raw.request === 'object') {
      const hash = createHash('sha256'); for await (const bytes of createReadStream(output)) hash.update(bytes);
      if (hash.digest('hex') === raw.sha256) value = raw;
    }
  } catch { /* Unverified metadata never enables a paid redo or changes narration ownership. */ }
  if (records.size >= 128) records.delete(records.keys().next().value!);
  records.set(output, { key, value }); return value;
}

export function recordedReferences(p: { image_url?: string; first_frame_url?: string; last_frame_url?: string; reference_image_urls?: string[]; reference_video_urls?: string[] }) {
  const publicUrl = (value?: string) => {
    try { const url = new URL(value ?? ''); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && value!.length <= 8192 ? value : undefined; }
    catch { return undefined; }
  };
  return { first_frame_url: publicUrl(p.first_frame_url ?? p.image_url), last_frame_url: publicUrl(p.last_frame_url),
    reference_image_urls: p.reference_image_urls?.map(publicUrl).filter(Boolean), reference_video_urls: p.reference_video_urls?.map(publicUrl).filter(Boolean) };
}
