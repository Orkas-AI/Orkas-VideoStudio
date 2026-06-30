import { spawn } from 'node:child_process';

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  /** Kill the process after this many ms (SIGKILL). */
  timeoutMs?: number;
  /** Streamed stderr chunks (e.g. for progress parsing). */
  onStderr?: (chunk: string) => void;
  /** Cap captured stdout/stderr to avoid unbounded memory on chatty tools. */
  maxBuffer?: number;
}

const DEFAULT_MAX_BUFFER = 16 * 1024 * 1024; // 16 MiB

/**
 * Spawn a child process and capture its output. Always resolves with the exit
 * code (never rejects on a non-zero exit) so callers decide what a failure
 * means; rejects only when the process cannot be spawned at all.
 */
export function run(file: string, args: string[], opts: RunOptions = {}): Promise<RunResult> {
  const maxBuffer = opts.maxBuffer ?? DEFAULT_MAX_BUFFER;
  return new Promise<RunResult>((resolve, reject) => {
    const child = spawn(file, args, {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      signal: opts.signal,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let killedForTimeout = false;
    const timer =
      opts.timeoutMs && opts.timeoutMs > 0
        ? setTimeout(() => {
            killedForTimeout = true;
            child.kill('SIGKILL');
          }, opts.timeoutMs)
        : null;

    child.stdout?.on('data', (d: Buffer) => {
      if (stdout.length < maxBuffer) stdout += d.toString();
    });
    child.stderr?.on('data', (d: Buffer) => {
      const s = d.toString();
      if (stderr.length < maxBuffer) stderr += s;
      opts.onStderr?.(s);
    });

    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (killedForTimeout) {
        reject(new Error(`'${file}' timed out after ${opts.timeoutMs}ms`));
        return;
      }
      resolve({ code, stdout, stderr });
    });
  });
}

/**
 * Like {@link run} but throws when the process exits non-zero, surfacing a
 * trimmed stderr tail so the failure is legible.
 */
export async function runOk(file: string, args: string[], opts: RunOptions = {}): Promise<RunResult> {
  const r = await run(file, args, opts);
  if (r.code !== 0) {
    const tail = r.stderr.trim().split('\n').slice(-12).join('\n');
    throw new Error(`'${file}' exited with code ${r.code}\n${tail}`);
  }
  return r;
}
