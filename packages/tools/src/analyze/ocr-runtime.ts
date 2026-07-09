import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { findOnPath } from '@orkas/video-studio-core';

const execFileAsync = promisify(execFile);

const RAPIDOCR_VERSION = '3.9.0';
const ONNXRUNTIME_VERSION = '1.27.0';
const OCR_RUNTIME_KEY = `ocr-rapidocr-${RAPIDOCR_VERSION}-onnxruntime-${ONNXRUNTIME_VERSION}-${process.platform}-${process.arch}`;
const OCR_TIMEOUT_MS = 5 * 60 * 1000;
const INSTALL_TIMEOUT_MS = 10 * 60 * 1000;
const VERIFY_TIMEOUT_MS = 2 * 60 * 1000;
const OCR_PROGRESS_HEARTBEAT_MS = 30_000;

export interface OcrProgressEvent {
  phase: string;
  message: string;
  data?: Record<string, unknown>;
}

type ProgressFn = (event: OcrProgressEvent) => void;

export type OcrImagesTextResult =
  | { ok: true; results: Array<{ text: string; items: Array<{ text: string; score?: number }>; error?: string }> }
  | { ok: false; errorCode: 'E_OCR_RUNTIME_MISSING' | 'E_OCR_INSTALL_FAILED' | 'E_OCR_UNSUPPORTED_FILE' | 'E_OCR_FAILED'; message: string };

type RuntimeResult =
  | { ok: true; python: string; installed: boolean; source: 'venv' | 'system' }
  | { ok: false; errorCode: 'E_OCR_RUNTIME_MISSING' | 'E_OCR_INSTALL_FAILED'; message: string };

function cacheRoot(): string {
  if (process.env.OVS_CACHE_DIR) return path.resolve(process.env.OVS_CACHE_DIR);
  if (process.env.XDG_CACHE_HOME) return path.join(process.env.XDG_CACHE_HOME, 'orkas-video-studio');
  const home = process.env.HOME || process.env.USERPROFILE;
  return home ? path.join(home, '.cache', 'orkas-video-studio') : path.join(os.tmpdir(), 'orkas-video-studio-cache');
}

function venvDir(): string {
  return path.join(cacheRoot(), 'python', 'packages', OCR_RUNTIME_KEY, '.venv');
}

function venvPython(venv = venvDir()): string {
  return process.platform === 'win32'
    ? path.join(venv, 'Scripts', 'python.exe')
    : path.join(venv, 'bin', 'python');
}

function isFile(p: string | null | undefined): p is string {
  try {
    return !!p && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function sentinelPath(venv: string): string {
  return path.join(venv, '.ovs-ocr-verified');
}

function sentinelMatches(venv: string): boolean {
  try {
    return fs.readFileSync(sentinelPath(venv), 'utf8').trim() === OCR_RUNTIME_KEY;
  } catch {
    return false;
  }
}

function writeSentinel(venv: string): void {
  try {
    fs.writeFileSync(sentinelPath(venv), `${OCR_RUNTIME_KEY}\n`);
  } catch {
    /* best effort */
  }
}

function runtimeEnv(): NodeJS.ProcessEnv {
  const root = cacheRoot();
  return {
    ...process.env,
    PYTHONNOUSERSITE: '1',
    UV_CACHE_DIR: process.env.UV_CACHE_DIR || path.join(root, 'uv-cache'),
    PIP_CACHE_DIR: process.env.PIP_CACHE_DIR || path.join(root, 'pip-cache'),
  };
}

async function withHeartbeat<T>(
  promise: Promise<T>,
  onProgress: ProgressFn | undefined,
  phase: string,
  heartbeatMessage: string,
): Promise<T> {
  let tick = 0;
  const timer = onProgress
    ? setInterval(() => {
        tick += 1;
        onProgress({
          phase,
          message: heartbeatMessage,
          data: { heartbeat: true, seconds: tick * (OCR_PROGRESS_HEARTBEAT_MS / 1000) },
        });
      }, OCR_PROGRESS_HEARTBEAT_MS)
    : null;
  timer?.unref?.();
  try {
    return await promise;
  } finally {
    if (timer) clearInterval(timer);
  }
}

const VERIFY_RUNTIME_SCRIPT = String.raw`
import pathlib
import onnxruntime
import rapidocr as rapidocr_pkg
from rapidocr import RapidOCR

model_dir = pathlib.Path(rapidocr_pkg.__file__).resolve().parent / "models"
RapidOCR(params={"Global.model_root_dir": str(model_dir)})
print("ok")
`;

async function verifyRuntime(python: string, onProgress?: ProgressFn): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isFile(python)) return { ok: false, message: `Python executable is missing: ${python}` };
  try {
    await withHeartbeat(
      execFileAsync(python, ['-c', VERIFY_RUNTIME_SCRIPT], {
        timeout: VERIFY_TIMEOUT_MS,
        env: runtimeEnv(),
        windowsHide: true,
        maxBuffer: 2 * 1024 * 1024,
      }),
      onProgress,
      'ocr_runtime_verify',
      'Still checking local OCR runtime',
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

function pythonCandidates(): string[] {
  return [
    process.env.OVS_OCR_PYTHON_PATH,
    process.env.OVS_PYTHON_PATH,
    findOnPath('python3'),
    findOnPath('python'),
  ].filter((value, index, values): value is string => !!value && values.indexOf(value) === index);
}

function uvCandidate(): string | null {
  return process.env.OVS_OCR_UV_PATH || process.env.OVS_UV_PATH || findOnPath('uv');
}

async function ensureRuntime(onProgress?: ProgressFn): Promise<RuntimeResult> {
  const venv = venvDir();
  const venvPy = venvPython(venv);
  if (isFile(venvPy) && sentinelMatches(venv)) {
    onProgress?.({ phase: 'ocr_runtime_ready', message: 'Local OCR runtime is ready' });
    return { ok: true, python: venvPy, installed: false, source: 'venv' };
  }

  onProgress?.({ phase: 'ocr_runtime_check', message: 'Checking local OCR runtime' });
  if (isFile(venvPy)) {
    const verification = await verifyRuntime(venvPy, onProgress);
    if (verification.ok) {
      writeSentinel(venv);
      onProgress?.({ phase: 'ocr_runtime_ready', message: 'Local OCR runtime is ready' });
      return { ok: true, python: venvPy, installed: false, source: 'venv' };
    }
  }

  for (const python of pythonCandidates()) {
    if (!isFile(python)) continue;
    const verification = await verifyRuntime(python, undefined);
    if (verification.ok) {
      onProgress?.({ phase: 'ocr_runtime_ready', message: 'Using prepared Python OCR runtime' });
      return { ok: true, python, installed: false, source: 'system' };
    }
  }

  const uv = uvCandidate();
  const basePython = pythonCandidates().find(isFile);
  if (!uv || !basePython) {
    return {
      ok: false,
      errorCode: 'E_OCR_RUNTIME_MISSING',
      message: 'OCR needs Python 3.10+ and uv for first-use setup, or OVS_OCR_PYTHON_PATH pointing at a Python env with rapidocr and onnxruntime installed.',
    };
  }

  try {
    await fsp.mkdir(path.dirname(venv), { recursive: true });
    onProgress?.({ phase: 'ocr_runtime_install', message: 'Creating local OCR Python environment', data: { runtimePath: venv } });
    await withHeartbeat(
      execFileAsync(uv, ['venv', '--python', basePython, venv], {
        timeout: INSTALL_TIMEOUT_MS,
        env: runtimeEnv(),
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      }),
      onProgress,
      'ocr_runtime_install',
      'Still creating local OCR Python environment',
    );
    onProgress?.({
      phase: 'ocr_runtime_install',
      message: 'Downloading and installing local OCR packages',
      data: { packages: [`rapidocr==${RAPIDOCR_VERSION}`, `onnxruntime==${ONNXRUNTIME_VERSION}`] },
    });
    await withHeartbeat(
      execFileAsync(uv, [
        'pip',
        'install',
        '--python',
        venvPy,
        '--only-binary=:all:',
        `rapidocr==${RAPIDOCR_VERSION}`,
        `onnxruntime==${ONNXRUNTIME_VERSION}`,
      ], {
        timeout: INSTALL_TIMEOUT_MS,
        env: runtimeEnv(),
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024,
      }),
      onProgress,
      'ocr_runtime_install',
      'Still installing local OCR packages',
    );
  } catch (err) {
    return {
      ok: false,
      errorCode: 'E_OCR_INSTALL_FAILED',
      message: `Local OCR runtime install failed: ${(err as Error).message}`,
    };
  }

  onProgress?.({ phase: 'ocr_runtime_verify', message: 'Verifying local OCR runtime' });
  const verification = await verifyRuntime(venvPy, onProgress);
  if (verification.ok) {
    writeSentinel(venv);
    onProgress?.({ phase: 'ocr_runtime_ready', message: 'Local OCR runtime installed and ready' });
    return { ok: true, python: venvPy, installed: true, source: 'venv' };
  }
  return {
    ok: false,
    errorCode: 'E_OCR_INSTALL_FAILED',
    message: `Local OCR runtime installed, but verification failed: ${verification.message}`,
  };
}

async function runOcrProcess(
  python: string,
  payload: string,
  onProgress: ProgressFn | undefined,
  signal: AbortSignal | undefined,
  timeoutMs = OCR_TIMEOUT_MS,
): Promise<string> {
  const res = await withHeartbeat(
    execFileAsync(python, ['-c', PYTHON_OCR_SCRIPT, payload], {
      timeout: timeoutMs,
      env: runtimeEnv(),
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
      ...(signal ? { signal } : {}),
    }),
    onProgress,
    'ocr_run',
    'Still running local OCR',
  );
  return res.stdout;
}

function extKind(absPath: string): 'image' | 'unsupported' {
  const ext = path.extname(absPath).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'].includes(ext) ? 'image' : 'unsupported';
}

export async function ocrImagesText(input: {
  absPaths: string[];
  signal?: AbortSignal;
  onProgress?: ProgressFn;
}): Promise<OcrImagesTextResult> {
  if (!input.absPaths.length) return { ok: true, results: [] };
  const bad = input.absPaths.find((p) => extKind(p) !== 'image');
  if (bad) return { ok: false, errorCode: 'E_OCR_UNSUPPORTED_FILE', message: `OCR needs image files: ${bad}` };
  const runtime = await ensureRuntime(input.onProgress);
  if (!runtime.ok) return runtime;
  const payload = JSON.stringify({ paths: input.absPaths, kind: 'images', scale: 2 });
  const timeoutMs = Math.max(OCR_TIMEOUT_MS, 60_000 + 10_000 * input.absPaths.length);
  let stdout = '';
  try {
    stdout = await runOcrProcess(runtime.python, payload, input.onProgress, input.signal, timeoutMs);
  } catch (err) {
    return { ok: false, errorCode: 'E_OCR_FAILED', message: `Local OCR failed: ${(err as Error).message}` };
  }
  try {
    const parsed = JSON.parse(stdout) as {
      ok?: boolean;
      error?: unknown;
      pages?: Array<{ text?: string; items?: Array<{ text: string; score?: number }>; error?: string }>;
    };
    if (!parsed?.ok) return { ok: false, errorCode: 'E_OCR_FAILED', message: String(parsed?.error || 'Local OCR failed') };
    const pages = Array.isArray(parsed.pages) ? parsed.pages : [];
    const results = input.absPaths.map((_, index) => {
      const page = pages[index] || {};
      return {
        text: String(page.text || '').trim(),
        items: Array.isArray(page.items) ? page.items : [],
        ...(page.error ? { error: String(page.error) } : {}),
      };
    });
    return { ok: true, results };
  } catch (err) {
    return { ok: false, errorCode: 'E_OCR_FAILED', message: `Local OCR returned invalid output: ${(err as Error).message}` };
  }
}

const PYTHON_OCR_SCRIPT = String.raw`
import json, pathlib, sys, traceback

def load_engine():
    try:
        import rapidocr as rapidocr_pkg
        from rapidocr import RapidOCR
    except ModuleNotFoundError as exc:
        if exc.name != "rapidocr":
            raise
        try:
            from rapidocr_onnxruntime import RapidOCR
            return RapidOCR()
        except ModuleNotFoundError:
            raise exc
    model_dir = pathlib.Path(rapidocr_pkg.__file__).resolve().parent / "models"
    return RapidOCR(params={"Global.model_root_dir": str(model_dir)})

def item_text(item):
    if isinstance(item, dict):
        txt = item.get("text") or item.get("txt") or item.get("label")
        score = item.get("score") or item.get("confidence")
        return txt, score
    if isinstance(item, (list, tuple)):
        if len(item) >= 2 and isinstance(item[1], str):
            return item[1], item[2] if len(item) >= 3 and isinstance(item[2], (int, float)) else None
        if len(item) >= 1 and isinstance(item[0], str):
            return item[0], item[1] if len(item) >= 2 and isinstance(item[1], (int, float)) else None
    if isinstance(item, str):
        return item, None
    return None, None

def collect_result(result):
    if isinstance(result, tuple) and result:
        result = result[0]
    if hasattr(result, "txts"):
        txts = list(getattr(result, "txts") or [])
        scores = list(getattr(result, "scores", []) or [])
        return [{"text": str(t), **({"score": float(scores[i])} if i < len(scores) and isinstance(scores[i], (int, float)) else {})} for i, t in enumerate(txts) if str(t).strip()]
    if hasattr(result, "to_json"):
        try:
            return collect_result(json.loads(result.to_json()))
        except Exception:
            pass
    if isinstance(result, dict):
        if "txts" in result:
            txts = result.get("txts") or []
            scores = result.get("scores") or []
            return [{"text": str(t), **({"score": float(scores[i])} if i < len(scores) and isinstance(scores[i], (int, float)) else {})} for i, t in enumerate(txts) if str(t).strip()]
        for key in ("data", "result", "results"):
            if key in result:
                return collect_result(result[key])
    if isinstance(result, list):
        out = []
        for item in result:
            if isinstance(item, (list, tuple, dict, str)):
                txt, score = item_text(item)
                if txt and str(txt).strip():
                    obj = {"text": str(txt)}
                    if isinstance(score, (int, float)):
                        obj["score"] = float(score)
                    out.append(obj)
                elif not isinstance(item, str):
                    out.extend(collect_result(item))
        return out
    return []

def run_ocr(engine, image_path):
    result = engine(image_path)
    items = collect_result(result)
    return {
        "text": "\n".join([i["text"] for i in items if i.get("text")]).strip(),
        "items": items,
    }

def main():
    args = json.loads(sys.argv[1])
    if args["kind"] != "images":
        raise ValueError(f"unsupported kind: {args['kind']}")
    engine = load_engine()
    pages = []
    for idx, image_path in enumerate(args["paths"]):
        try:
            r = run_ocr(engine, image_path)
            pages.append({"page": idx + 1, **r})
        except Exception as exc:
            pages.append({"page": idx + 1, "text": "", "items": [], "error": str(exc)})
    print(json.dumps({"ok": True, "pages": pages}, ensure_ascii=False))

try:
    main()
except Exception as exc:
    print(json.dumps({"ok": False, "error": str(exc), "trace": traceback.format_exc()}, ensure_ascii=False))
`;
