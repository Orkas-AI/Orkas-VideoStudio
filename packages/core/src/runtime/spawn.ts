import { spawn, spawnSync, type ChildProcess } from 'node:child_process';

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
  /** Terminate the process after this many captured stdout/stderr bytes. */
  maxBuffer?: number;
}

const DEFAULT_MAX_BUFFER = 16 * 1024 * 1024; // 16 MiB

function abortError(file: string): Error {
  const error = new Error(`'${file}' was aborted`);
  error.name = 'AbortError';
  return error;
}

/** Terminate the whole subprocess tree, including ffmpeg/browser descendants. */
function terminateProcessTree(child: ChildProcess): void {
  const pid = child.pid;
  if (!pid) return;
  if (process.platform === 'win32') {
    const killed = spawnSync('taskkill', ['/pid', String(pid), '/t', '/f'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    if (!killed.error && killed.status === 0) return;
  } else {
    try {
      process.kill(-pid, 'SIGKILL');
      return;
    } catch {
      // Fall back to the direct child when the process group has already gone.
    }
  }
  try { child.kill('SIGKILL'); } catch { /* best effort */ }
}

/**
 * Spawn a child process and capture its output. Always resolves with the exit
 * code (never rejects on a non-zero exit) so callers decide what a failure
 * means; rejects when the process cannot start or crosses a configured
 * abort/timeout/output boundary.
 */
export function run(file: string, args: string[], opts: RunOptions = {}): Promise<RunResult> {
  const maxBuffer = Math.max(1, opts.maxBuffer ?? DEFAULT_MAX_BUFFER);
  if (opts.signal?.aborted) return Promise.reject(abortError(file));
  return new Promise<RunResult>((resolve, reject) => {
    const child = spawn(file, args, {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      detached: process.platform !== 'win32',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let outputBytes = 0;
    let settled = false;
    let timer: NodeJS.Timeout | null =
      opts.timeoutMs && opts.timeoutMs > 0
        ? setTimeout(() => {
            terminateProcessTree(child);
            finishReject(new Error(`'${file}' timed out after ${opts.timeoutMs}ms`));
          }, opts.timeoutMs)
        : null;
    timer?.unref?.();

    const cleanup = (): void => {
      if (timer) clearTimeout(timer);
      timer = null;
      opts.signal?.removeEventListener('abort', onAbort);
    };
    const finishReject = (error: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const finishResolve = (code: number | null): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ code, stdout, stderr });
    };
    const onAbort = (): void => {
      terminateProcessTree(child);
      finishReject(abortError(file));
    };
    const capture = (target: 'stdout' | 'stderr', data: Buffer): void => {
      if (settled) return;
      outputBytes += data.length;
      if (outputBytes > maxBuffer) {
        terminateProcessTree(child);
        finishReject(new Error(`'${file}' process output exceeded ${maxBuffer} bytes`));
        return;
      }
      const text = data.toString();
      if (target === 'stdout') stdout += text;
      else {
        stderr += text;
        opts.onStderr?.(text);
      }
    };

    opts.signal?.addEventListener('abort', onAbort, { once: true });
    if (opts.signal?.aborted) onAbort();

    child.stdout?.on('data', (data: Buffer) => capture('stdout', data));
    child.stderr?.on('data', (data: Buffer) => capture('stderr', data));

    child.on('error', finishReject);
    child.on('close', finishResolve);
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
