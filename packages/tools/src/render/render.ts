import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import {
  resolveFfmpegTools,
  resolveBinaries,
  buildHyperframesEnv,
  hyperframesNpxArgs,
  run,
  runOk,
} from '@orkas/video-studio-core';
import { lintCompositionCraft, type CraftFinding } from './craft-lint.js';

const NPX_HINT = 'Compose/render runs `npx hyperframes`. Install Node.js (which provides npx).';

function npxOrThrow(): string {
  const { npx } = resolveBinaries();
  if (!npx) throw new Error(`npx not found. ${NPX_HINT}`);
  return npx;
}

/** Render time can be long (first run fetches HyperFrames + may download a browser). */
const RENDER_TIMEOUT_MS = 15 * 60 * 1000;
const QA_TIMEOUT_MS = 5 * 60 * 1000;

export type RenderQuality = 'draft' | 'high';

export interface RenderParams {
  /** Directory containing the composition (index.html). */
  project: string;
  output: string;
  quality?: RenderQuality;
  signal?: AbortSignal;
  onProgress?: (chunk: string) => void;
}

export interface RenderResult {
  output: string;
}

/** Render a HyperFrames composition directory to a video file via `npx hyperframes render`. */
export async function render(params: RenderParams): Promise<RenderResult> {
  const npx = npxOrThrow();
  const env = buildHyperframesEnv(resolveFfmpegTools());
  const quality = params.quality ?? 'high';
  const args = hyperframesNpxArgs('render', [params.project, '-o', params.output, '-q', quality]);
  await runOk(npx, args, {
    env,
    signal: params.signal,
    timeoutMs: RENDER_TIMEOUT_MS,
    onStderr: params.onProgress,
  });
  return { output: resolve(params.output) };
}

async function qa(op: 'lint' | 'inspect', project: string, signal?: AbortSignal): Promise<unknown> {
  const npx = npxOrThrow();
  const env = buildHyperframesEnv(resolveFfmpegTools());
  const r = await run(npx, hyperframesNpxArgs(op, [project, '--json']), { env, signal, timeoutMs: QA_TIMEOUT_MS });
  let result: unknown = { ok: r.code === 0, raw: r.stdout.trim() || r.stderr.trim() };
  const m = r.stdout.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (m) {
    try {
      result = JSON.parse(m[0]);
    } catch {
      /* keep the raw fallback */
    }
  }
  return attachCraftFindings(result, project);
}

/** Append advisory craft-threshold findings (a pure static scan of index.html)
 *  to the QA result so they ride alongside the structural/visual QA. Best-effort:
 *  a read/parse failure must never fail the QA pass. Nothing is added when the
 *  composition trips none of the thresholds, so the result shape is unchanged. */
async function attachCraftFindings(result: unknown, project: string): Promise<unknown> {
  let craft: CraftFinding[] = [];
  try {
    const html = await readFile(resolve(project, 'index.html'), 'utf8');
    craft = lintCompositionCraft(html);
  } catch {
    /* advisory only; ignore */
  }
  if (!craft.length) return result;
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    return { ...(result as Record<string, unknown>), craft };
  }
  return { qa: result, craft };
}

/** Structural QA of a composition (`npx hyperframes lint --json`). */
export function lint(project: string, signal?: AbortSignal): Promise<unknown> {
  return qa('lint', project, signal);
}

/** Visual/layout QA of a composition in headless Chrome (`npx hyperframes inspect --json`). */
export function inspect(project: string, signal?: AbortSignal): Promise<unknown> {
  return qa('inspect', project, signal);
}
