/**
 * Draft-review helper for the delivery guard: probe the ACTUAL produced media
 * for each primary segment so `assessDelivery` can judge the real cut instead of
 * the planned `target_sec`. This is what catches a plan that promised motion but
 * assembled into a short slideshow — planned durations look fine, produced ones
 * don't. Shared by the CLI (`ovs plan promise-check --probe-produced`) and MCP.
 */

import { existsSync } from 'node:fs';
import { resolve, isAbsolute, dirname } from 'node:path';
import type { VideoEdl } from '@orkas/video-studio-core';
import { probeMedia } from './edit/index.js';

/** Resolve a segment's produced_path: absolute as-is, else cwd-relative, else
 *  relative to the plan file's directory (the last is a fallback, not a check). */
export function resolveProducedPath(rawPath: unknown, planPath: string): string {
  const raw = String(rawPath ?? '').trim();
  if (!raw) return '';
  if (isAbsolute(raw)) return raw;
  const cwdPath = resolve(process.cwd(), raw);
  if (existsSync(cwdPath)) return cwdPath;
  const planRelative = resolve(dirname(planPath), raw);
  if (existsSync(planRelative)) return planRelative;
  return cwdPath;
}

/**
 * Probe each primary segment's produced media → { segmentId: durationSec } for
 * `assessDelivery(plan, { producedSec })`. Throws a clear message if a primary
 * segment lacks a readable produced_path or can't be probed — the gate must not
 * silently pass on missing media.
 */
export async function collectProducedSec(plan: VideoEdl, planPath: string): Promise<Record<string, number>> {
  const primary = (Array.isArray(plan.segments) ? plan.segments : []).filter((s) => s && s.layer === 'primary');
  if (!primary.length) throw new Error('plan has no primary segments to probe');
  const producedSec: Record<string, number> = {};
  for (const seg of primary) {
    const id = String(seg.id ?? '').trim();
    if (!id) throw new Error('a primary segment is missing its id');
    const producedPath = resolveProducedPath(seg.produced_path, planPath);
    if (!producedPath || !existsSync(producedPath)) {
      throw new Error(`primary segment "${id}" has no readable produced_path; render/assemble it before the real-cut check`);
    }
    const { duration } = await probeMedia(producedPath);
    if (!(Number.isFinite(duration) && duration > 0)) {
      throw new Error(`could not probe a usable duration for primary segment "${id}": ${producedPath}`);
    }
    producedSec[id] = duration;
  }
  return producedSec;
}
