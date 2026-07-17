import { existsSync, accessSync, constants as fsConstants } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { delimiter } from 'node:path';

const IS_WIN = process.platform === 'win32';

/** Well-known install dirs that are not always on a GUI app's PATH. */
const EXTRA_DIRS = IS_WIN
  ? []
  : ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', join(homedir(), '.local/bin')];

function homedir(): string {
  return process.env.HOME || process.env.USERPROFILE || '';
}

function isExecutable(p: string): boolean {
  try {
    if (!existsSync(p)) return false;
    accessSync(p, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Candidate file names for a binary, accounting for Windows extensions. */
function candidates(name: string): string[] {
  if (!IS_WIN) return [name];
  const exts = (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';').map((e) => e.toLowerCase());
  return [name, ...exts.map((e) => name + e)];
}

/**
 * Resolve a binary to an absolute path by scanning $PATH plus a few well-known
 * install dirs (Homebrew, /usr/local, ~/.local/bin). Returns null if not found.
 * An absolute `name` is returned as-is when executable.
 */
export function findOnPath(name: string): string | null {
  if (isAbsolute(name)) return isExecutable(name) ? name : null;
  const dirs = [...(process.env.PATH || '').split(delimiter).filter(Boolean), ...EXTRA_DIRS];
  const seen = new Set<string>();
  for (const dir of dirs) {
    if (seen.has(dir)) continue;
    seen.add(dir);
    for (const cand of candidates(name)) {
      const full = join(dir, cand);
      if (isExecutable(full)) return full;
    }
  }
  return null;
}

export interface BinaryResolution {
  ffmpeg: string | null;
  ffprobe: string | null;
  node: string | null;
  npx: string | null;
  python: string | null;
  uv: string | null;
}

/** Resolve every external binary OrkasVideoStudio may use, honoring env overrides. */
export function resolveBinaries(): BinaryResolution {
  return {
    ffmpeg: process.env.OVS_FFMPEG_PATH || findOnPath('ffmpeg'),
    ffprobe: process.env.OVS_FFPROBE_PATH || findOnPath('ffprobe'),
    node: process.execPath || findOnPath('node'),
    npx: findOnPath('npx'),
    python: process.env.OVS_OCR_PYTHON_PATH || process.env.OVS_PYTHON_PATH || findOnPath('python3') || findOnPath('python'),
    uv: process.env.OVS_OCR_UV_PATH || process.env.OVS_UV_PATH || findOnPath('uv'),
  };
}

export interface FfmpegTools {
  ffmpeg: string;
  ffprobe: string;
}

const INSTALL_HINT =
  'Install ffmpeg (which bundles ffprobe): macOS `brew install ffmpeg`, Debian/Ubuntu `apt install ffmpeg`, Windows `winget install ffmpeg`. ' +
  'Or set OVS_FFMPEG_PATH / OVS_FFPROBE_PATH to explicit paths.';

/** Resolve ffmpeg + ffprobe or throw a clear, actionable install error. */
export function resolveFfmpegTools(): FfmpegTools {
  const { ffmpeg, ffprobe } = resolveBinaries();
  const missing: string[] = [];
  if (!ffmpeg) missing.push('ffmpeg');
  if (!ffprobe) missing.push('ffprobe');
  if (missing.length) {
    throw new Error(`Required binary not found: ${missing.join(', ')}. ${INSTALL_HINT}`);
  }
  return { ffmpeg: ffmpeg as string, ffprobe: ffprobe as string };
}

export interface DoctorReport {
  ok: boolean;
  binaries: BinaryResolution;
  notes: string[];
}

/**
 * Inspect the environment for the binaries each capability needs and report
 * what is available. `ok` is true when the zero-key trunk (compose draft via
 * the packaged HyperFrames dependency + ffmpeg and edit via ffmpeg) can run;
 * generation/TTS are BYO and not
 * checked here.
 */
export function doctor(): DoctorReport {
  const binaries = resolveBinaries();
  const notes: string[] = [];
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (!binaries.ffmpeg || !binaries.ffprobe) notes.push(`edit/analyze need ffmpeg+ffprobe — ${INSTALL_HINT}`);
  if (!binaries.node || !Number.isFinite(nodeMajor) || nodeMajor < 22) notes.push(`compose draft/render and transcribe need Node.js 22+ to run the packaged HyperFrames dependency (current: ${process.versions.node}).`);
  if (!binaries.python) notes.push('OCR needs Python 3.10+ plus `uv` for first-use local RapidOCR setup, or OVS_OCR_PYTHON_PATH pointing at a prepared Python env.');
  if (!binaries.uv) notes.push('OCR can auto-install RapidOCR when `uv` is available. Install `uv`, set OVS_OCR_UV_PATH, or preinstall rapidocr+onnxruntime in OVS_OCR_PYTHON_PATH.');
  const ok = Boolean(binaries.ffmpeg && binaries.ffprobe && binaries.node && nodeMajor >= 22);
  if (ok) notes.push('Ready: compose draft/render (packaged HyperFrames + ffmpeg), edit (ffmpeg), and HyperFrames transcribe are available.');
  return { ok, binaries, notes };
}
