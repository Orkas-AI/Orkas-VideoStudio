import { resolve } from 'node:path';
import {
  resolveFfmpegTools,
  resolveBinaries,
  buildHyperframesEnv,
  hyperframesNpxArgs,
  run,
  runOk,
} from '@orkas/video-studio-core';

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
  const m = r.stdout.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch {
      /* fall through to raw */
    }
  }
  return { ok: r.code === 0, raw: r.stdout.trim() || r.stderr.trim() };
}

/** Structural QA of a composition (`npx hyperframes lint --json`). */
export function lint(project: string, signal?: AbortSignal): Promise<unknown> {
  return qa('lint', project, signal);
}

/** Visual/layout QA of a composition in headless Chrome (`npx hyperframes inspect --json`). */
export function inspect(project: string, signal?: AbortSignal): Promise<unknown> {
  return qa('inspect', project, signal);
}
