import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
import * as path from 'node:path';
import { resolveFfmpegTools } from '@orkas/video-studio-core';
import { probeMedia } from '../edit/edit.js';
import { importTimelineAssets, readTimelineJson, timelineDigest } from '../composition/timeline.js';
import { timelineDeliveryIsCurrent } from '../composition/timeline-actions.js';

export const studioContext = new AsyncLocalStorage<{ root: string }>();
export async function getConversationWorkspacePath(_uid: string, _cid: string) {
  const context = studioContext.getStore();
  if (!context) throw new Error('No production is open.');
  return context.root;
}
export function isPathAllowed(file: string, roots: string[]) {
  try {
    const target = path.resolve(file);
    let existing = target;
    while (!existsSync(existing) && path.dirname(existing) !== existing) existing = path.dirname(existing);
    const physical = path.join(realpathSync(existing), path.relative(existing, target));
    return roots.some(root => {
      const base = realpathSync(root);
      const relative = path.relative(base, physical);
      return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
    });
  } catch { return false; }
}
export function resolveLocalMediaPath(file: string) {
  try { return { ok: true as const, absPath: realpathSync(file) }; }
  catch { return { ok: false as const }; }
}
export const bundledFfmpegPaths = resolveFfmpegTools;
export const sha256OfFileStream = timelineDigest;
export const logErrorSummary = (error: unknown) => error instanceof Error ? error.name : 'Error';
export const maskId = (_value: string) => '[local]';
export const createLogger = (_name: string) => ({ warn(message: string, _data: unknown) { process.stderr.write(`Canvas warning: ${message}\n`); } });
export async function writeBytesAtomic(file: string, bytes: Uint8Array) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try { await fs.writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 }); await fs.rename(temporary, file); }
  finally { await fs.rm(temporary, { force: true }); }
}
const locks = new Map<string, Promise<unknown>>();
export function fileEditLock(file: string) {
  return { async runExclusive<T>(work: () => Promise<T>): Promise<T> {
    const before = locks.get(file) ?? Promise.resolve();
    const next = before.catch(() => {}).then(work);
    locks.set(file, next);
    try { return await next; } finally { if (locks.get(file) === next) locks.delete(file); }
  } };
}
export async function probeCanvasMedia(_ffprobe: string, file: string) {
  const result = await probeMedia(file);
  return { duration_seconds: result.duration, video: result.width ? { width: result.width, height: result.height } : undefined, audio: result.has_audio };
}
export async function importProductionFile(p: { productionDirAbs: string; sourceAbs: string; name: string }) {
  const result = await importTimelineAssets({ production: p.productionDirAbs, inputs: [p.sourceAbs], reuse: true });
  return { asset_id: result.assets[0].id };
}
export type VideoVersion = { id: string; video_id?: string; path: string; shipped_at: string; duration_sec: number | null; product_facts?: Array<{ id: string; text: string }> };
export function deliveredWords(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].every((text: unknown) => typeof text === 'string')));
}
type Scope = { productionDirAbs: string; videoDirAbs: string };
type Baseline = { version: string; product: { facts?: Array<{ id: string; text: string }> } | null };
const baselinePath = (p: Scope) => {
  const file = path.join(p.videoDirAbs, '.ovs-canvas-delivery.json');
  if (!isPathAllowed(file, [p.productionDirAbs])) throw new Error('invalid');
  return file;
};
export async function recordCanvasDelivery(p: Scope) {
  const stored = await readTimelineJson(path.join(p.productionDirAbs, 'versions.json'), { versions: [] }) as { versions: VideoVersion[] };
  const version = stored.versions.filter(v => v.video_id === path.basename(p.videoDirAbs)).at(-1);
  if (!version) return;
  const product = await readTimelineJson(path.join(p.productionDirAbs, 'product.json'), null);
  await writeBytesAtomic(baselinePath(p), Buffer.from(JSON.stringify({ version: version.id, product })));
}
export async function noteTimelineBeforeChange(p: Scope) {
  if (!existsSync(baselinePath(p))) await recordCanvasDelivery(p);
}
export async function productChangesSinceDelivery(p: Scope) {
  const base = await readTimelineJson(baselinePath(p), null) as Baseline | null;
  const stored = await readTimelineJson(path.join(p.productionDirAbs, 'versions.json'), { versions: [] }) as { versions: VideoVersion[]; delivered_products?: Record<string, { version: string; facts: Array<{ id: string; text: string }> }> };
  const version = stored.versions.filter(v => v.video_id === path.basename(p.videoDirAbs)).at(-1);
  if (!version) return [];
  const delivered = stored.delivered_products?.[path.basename(p.videoDirAbs)];
  const facts = (delivered?.version === version.id ? delivered.facts : undefined) ?? version.product_facts ?? (base?.version === version.id ? base.product?.facts : undefined);
  if (!facts) return [];
  const now = await readTimelineJson(path.join(p.productionDirAbs, 'product.json'), null) as Baseline['product'];
  const before = new Map(facts.map(f => [f.id, f.text]));
  const after = new Map((now?.facts ?? []).map(f => [f.id, f.text]));
  return [...new Set([...before.keys(), ...after.keys()])].filter(id => before.get(id) !== after.get(id)).map(id => ({ before: before.get(id) ?? '', after: after.get(id) ?? '' }));
}
export async function timelineAheadOfDelivery(p: Scope) {
  return !await timelineDeliveryIsCurrent({ production: p.productionDirAbs, video_id: path.basename(p.videoDirAbs) });
}
/** Revision covers editable sources, never media bytes or generated render caches. */
export async function canvasRevision(root: string): Promise<string> {
  const videos = (await fs.readdir(path.join(root, 'videos'), { withFileTypes: true }).catch(() => []))
    .filter(e => e.isDirectory() && /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(e.name)).map(e => e.name).sort().slice(0, 32);
  const files = ['assets.json', 'product.json', 'canvas.json', 'versions.json', ...videos.flatMap(id => [`videos/${id}/manifest.json`, `videos/${id}/index.html`])];
  const hash = createHash('sha256');
  for (const file of files) {
    const absolute = path.join(root, file);
    if (!isPathAllowed(absolute, [root])) throw new Error('Production files are outside the open project.');
    const stat = await fs.stat(absolute).catch((e: NodeJS.ErrnoException) => { if (e.code === 'ENOENT') return null; throw e; });
    if (stat && (!stat.isFile() || stat.size > 2 * 1024 * 1024)) throw new Error('Production source is too large.');
    hash.update(file).update(stat ? await fs.readFile(absolute) : '');
  }
  return hash.digest('hex');
}
