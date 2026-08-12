import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  approvedShotReferenceIndex,
  manifestAsDesignContract,
  manifestAsSceneMap,
  resolveApprovedShotReference,
  validateCompositionManifest,
} from '@orkas/video-studio-core';

export type Issue = {
  code: string;
  severity: 'error' | 'warning' | 'info';
  selector?: string;
  message: string;
  fixHint?: string;
  source?: string;
  /** Present when a blocking finding was downgraded by an explicit user
   *  decision — the finding stays in the report, it just no longer blocks. */
  waived_by_user?: boolean;
};

/** Evidence-integrity findings are repaired, never waived: they mean the QA
 *  could not see, not that the user accepted a look. Parse failures likewise. */
export const NON_WAIVABLE_QA_CODES = new Set([
  'VIDEO_SAMPLE_FRAMES_MISSING',
  'SCENE_MAP_REQUIRED_FOR_SOURCE_ALIGNMENT',
]);

export function qaFindingIsWaivable(code: string): boolean {
  if (NON_WAIVABLE_QA_CODES.has(code)) return false;
  return !/_PARSE_FAILED$/.test(code);
}

/**
 * Downgrade user-waived blocking findings to informational. The finding stays
 * in the report with its message suffixed, so every later QA phase reports it
 * without blocking — the user is never asked to skip the same check twice.
 */
export function applyQaFindingWaivers(
  issues: Issue[],
  waivedCodes: Iterable<string>,
): { issues: Issue[]; applied: string[] } {
  const waived = new Set(waivedCodes);
  if (!waived.size) return { issues, applied: [] };
  const applied = new Set<string>();
  const next = issues.map((issue) => {
    if (issue.severity !== 'error' || !waived.has(issue.code) || !qaFindingIsWaivable(issue.code)) return issue;
    applied.add(issue.code);
    return {
      ...issue,
      severity: 'info' as const,
      message: `${issue.message} [skipped by user decision]`,
      waived_by_user: true,
    };
  });
  return { issues: next, applied: [...applied] };
}

export type AudioTrack = {
  absPath: string;
  startSec: number;
  declaredDurationSec?: number;
  volume: number;
};

export type CompositionMeta = {
  htmlPath: string;
  html: string;
  rootAttrs: Record<string, string>;
  id: string;
  width: number;
  height: number;
  durationSec: number;
  audioTracks: AudioTrack[];
};

export type JsonLoad = {
  path: string;
  exists: boolean;
  value: unknown;
  error?: string;
};

export type DraftRepairBudget = {
  compositionDirAbs: string;
  statePath: string;
  state: DraftRepairState;
  summary: DraftRepairSummary;
  blocked: boolean;
};

type DraftRepairState = {
  status: 'ok' | 'failed';
  failed_attempts: number;
  repair_passes_used: number;
  max_repair_passes: number;
  last_error: Record<string, unknown> | null;
  history: Array<Record<string, unknown>>;
  last_success?: Record<string, unknown>;
};

export type DraftRepairSummary = {
  ok: boolean;
  budget_exhausted: boolean;
  state_path: string;
  max_repair_passes: number;
  failed_attempts: number;
  repair_passes_used: number;
  repair_passes_remaining: number;
  last_error: Record<string, unknown> | null;
};

export type FrameSamplePlan = {
  label: string;
  timeSec: number;
  frameIndex: number;
};

/** A preview capture has no rendered frame to index — only a seek time. */
export type PreviewSample = {
  label: string;
  timeSec: number;
};

/** Upper bound on HTML preview captures; each one costs a real browser seek. */
export const PREVIEW_MAX_FRAMES = 8;

export type FrameSampleEvidence = {
  label: string;
  time_seconds: number;
  frame_index: number;
  path: string;
  hash: string;
  brightness: number;
  contrast: number;
  width: number;
  height: number;
};

export type FrameEvidence = {
  evidence_dir: string;
  contact_sheet: string;
  frame_paths: string[];
  samples: FrameSampleEvidence[];
};

export const DRAFT_REPAIR_MAX_PASSES = 2;
const ENVIRONMENTAL_DRAFT_FAILURE_CODES = new Set([
  'E_RENDER_TOO_HEAVY',
  'E_FFMPEG_MISSING',
  'E_FFPROBE_MISSING',
  'E_NPX_MISSING',
  'E_HYPERFRAMES_MISSING',
  'E_RENDER_ABORTED',
]);

/** Machine/runtime failures cannot be fixed by spending a content-repair pass. */
export function isEnvironmentalDraftFailure(code: string): boolean {
  return ENVIRONMENTAL_DRAFT_FAILURE_CODES.has(code);
}
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;
const DEFAULT_DURATION_SEC = 5;
const MAX_RENDER_DURATION_SEC = 20 * 60;
const REQUIRED_GSAP_TIMELINE_APIS = ['timeScale', 'totalTime', 'totalDuration', 'getChildren'];

const DRAFT_VISUAL_ADVISORY_CODES = new Set([
  'FONT_TOO_SMALL',
  'PALETTE_LARGE',
  'LOW_CONTRAST',
  'TEXT_BOX_OVERFLOW',
  'TEXT_OCCLUDED',
  'TEXT_OVERFLOW',
  'TEXT_CLIPPED',
  'CONTENT_OVERLAP',
  'CONTENT_OCCLUDED',
  'CONTENT_OVERFLOW',
  'CONTENT_CLIPPED',
  'SAFE_AREA_VIOLATION',
  'ELEMENT_OUT_OF_CANVAS',
]);

function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

function round1(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 10) / 10;
}

function floor1(n: number): number {
  return Math.floor((Number.isFinite(n) ? n : 0) * 10) / 10;
}

function shortText(value: unknown, max = 220): string {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}...` : s;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseAttrs(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag)) !== null) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

function htmlAttrNumber(attrs: Record<string, string>, key: string): number {
  const v = Number(attrs[key]);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

function normalizeRef(ref: string): string {
  return String(ref || '').trim().replace(/&amp;/g, '&');
}

function numberFrom(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeForSearch(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRemoteRef(ref: string): boolean {
  return /^(?:https?:)?\/\//i.test(ref);
}

function isIgnorableRef(ref: string): boolean {
  const s = String(ref || '').trim();
  return !s || s.startsWith('#') || /^(?:data|blob|javascript|mailto):/i.test(s);
}

function safeResolveLocalRef(rootAbs: string, ref: string): string | null {
  const clean = normalizeRef(ref).split(/[?#]/)[0];
  let decoded = clean;
  try {
    decoded = decodeURIComponent(clean);
  } catch {
    /* keep the raw path */
  }
  const abs = path.resolve(rootAbs, decoded);
  const rel = path.relative(rootAbs, abs);
  if (abs === rootAbs || (rel && !rel.startsWith('..') && !path.isAbsolute(rel))) return abs;
  return null;
}

function normalizedLocalRefPath(ref: string): string {
  const noHash = normalizeRef(ref).split('#')[0].split('?')[0];
  let decoded = noHash;
  try {
    decoded = decodeURIComponent(noHash);
  } catch {
    /* keep the raw path */
  }
  return decoded.replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function isKnownBundledVendorRef(ref: string): boolean {
  return normalizedLocalRefPath(ref) === 'assets/vendor/gsap.min.js';
}

function gsapVendorCompatibilityIssue(text: string): { code: string; missing: string[] } | null {
  const s = String(text || '');
  if (!s.trim()) return { code: 'VENDOR_GSAP_EMPTY', missing: REQUIRED_GSAP_TIMELINE_APIS };
  const missing = REQUIRED_GSAP_TIMELINE_APIS.filter((api) => !s.includes(api));
  return missing.length ? { code: 'VENDOR_GSAP_MISSING_TIMELINE_API', missing } : null;
}

function extractResourceRefs(html: string): Array<{ attr: string; ref: string }> {
  const refs: Array<{ attr: string; ref: string }> = [];
  const re = /\b(src|href|poster)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    refs.push({ attr: m[1].toLowerCase(), ref: normalizeRef(m[2] ?? m[3] ?? '') });
  }
  const cssRe = /\burl\(\s*(?:"([^"]*)"|'([^']*)'|([^"')]+))\s*\)/gi;
  while ((m = cssRe.exec(html)) !== null) {
    refs.push({ attr: 'css-url', ref: normalizeRef(m[1] ?? m[2] ?? m[3] ?? '') });
  }
  return refs;
}

export function findingsJson(issues: Issue[], extra: Record<string, unknown> = {}): string {
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  return JSON.stringify({
    ok: errorCount === 0,
    errorCount,
    warningCount,
    issueCount: issues.length,
    totalIssueCount: issues.length,
    issues,
    ...extra,
  }, null, 2);
}

export function parseFindingsPayload(findings: string): { errorCount: number; warningCount: number; issues: Issue[]; ok?: boolean } {
  try {
    const parsed = JSON.parse(String(findings || '{}')) as {
      ok?: boolean;
      errorCount?: number;
      warningCount?: number;
      issues?: Issue[];
      findings?: Issue[];
    };
    const issues = Array.isArray(parsed.issues)
      ? parsed.issues
      : (Array.isArray(parsed.findings) ? parsed.findings : []);
    return {
      ok: parsed.ok,
      errorCount: typeof parsed.errorCount === 'number'
        ? parsed.errorCount
        : issues.filter((i) => i.severity === 'error').length,
      warningCount: typeof parsed.warningCount === 'number'
        ? parsed.warningCount
        : issues.filter((i) => i.severity === 'warning').length,
      issues,
    };
  } catch {
    return { errorCount: 0, warningCount: 0, issues: [] };
  }
}

export function summarizeDraftCheckDisposition(findings: string): Record<string, unknown> {
  const parsed = parseFindingsPayload(findings);
  const advisoryIssues: Issue[] = [];
  const blockingIssues: Issue[] = [];
  for (const issue of parsed.issues) {
    const code = String(issue.code || '').toUpperCase();
    const isVisual = DRAFT_VISUAL_ADVISORY_CODES.has(code);
    if (issue.severity === 'error' && !isVisual) blockingIssues.push(issue);
    else advisoryIssues.push(issue);
  }
  return {
    blocking_error_count: blockingIssues.length,
    advisory_count: advisoryIssues.length,
    blocking_issues: blockingIssues.slice(0, 12),
    advisory_issues: advisoryIssues.slice(0, 12),
  };
}

/** @deprecated Report consumers should read steps.check. */
export const summarizeDraftInspectDisposition = summarizeDraftCheckDisposition;

async function readJsonIfExists(absPath: string): Promise<JsonLoad> {
  const st = await fs.stat(absPath).catch(() => null);
  if (!st || !st.isFile()) return { path: absPath, exists: false, value: null };
  try {
    return { path: absPath, exists: true, value: JSON.parse(await fs.readFile(absPath, 'utf8')) };
  } catch (err) {
    return { path: absPath, exists: true, value: null, error: (err as Error).message };
  }
}

export async function loadDesignContract(compositionDirAbs: string): Promise<JsonLoad> {
  const legacy = await readJsonIfExists(path.join(compositionDirAbs, 'design-contract.json'));
  if (legacy.exists) return legacy;
  const manifest = await readJsonIfExists(path.join(compositionDirAbs, 'composition-manifest.json'));
  if (!manifest.exists) return legacy;
  if (manifest.error) return manifest;
  const validated = validateCompositionManifest(manifest.value);
  if (!validated.data) return { ...manifest, value: null, error: validated.issues.map((entry) => entry.message).join('; ') };
  return { ...manifest, value: manifestAsDesignContract(validated.data) };
}

export async function loadSceneMap(compositionDirAbs: string): Promise<JsonLoad> {
  const legacy = await readJsonIfExists(path.join(compositionDirAbs, 'scene-map.json'));
  if (legacy.exists) return legacy;
  const manifest = await readJsonIfExists(path.join(compositionDirAbs, 'composition-manifest.json'));
  if (!manifest.exists) return legacy;
  if (manifest.error) return manifest;
  const validated = validateCompositionManifest(manifest.value);
  if (!validated.data) return { ...manifest, value: null, error: validated.issues.map((entry) => entry.message).join('; ') };
  return { ...manifest, value: manifestAsSceneMap(validated.data) };
}

export async function loadNarrationMap(compositionDirAbs: string): Promise<JsonLoad> {
  return readJsonIfExists(path.join(compositionDirAbs, 'narration-map.json'));
}

export async function loadShotlist(compositionDirAbs: string): Promise<JsonLoad> {
  return readJsonIfExists(path.resolve(compositionDirAbs, '..', 'shotlist.json'));
}

function packageVendorCandidates(): string[] {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return [
    path.join(here, 'vendor', 'gsap.min.js'),
    path.resolve(here, '..', '..', 'src', 'render', 'vendor', 'gsap.min.js'),
    path.resolve(process.cwd(), 'packages', 'tools', 'src', 'render', 'vendor', 'gsap.min.js'),
    path.resolve(process.cwd(), 'PC', 'resources', 'builtin', 'marketplace', 'agents', '79df9cc89f5f', 'skills', 'stage-compose', 'scripts', 'vendor', 'gsap.min.js'),
    path.resolve(process.cwd(), 'resources', 'builtin', 'marketplace', 'agents', '79df9cc89f5f', 'skills', 'stage-compose', 'scripts', 'vendor', 'gsap.min.js'),
  ];
}

async function firstFile(candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    const st = await fs.stat(candidate).catch(() => null);
    if (st?.isFile()) return candidate;
  }
  return null;
}

async function copyKnownBundledVendor(ref: string, targetAbsPath: string): Promise<{ ok: true } | { ok: false; code: string; missing?: string[] }> {
  if (!isKnownBundledVendorRef(ref)) return { ok: false, code: 'LOCAL_VENDOR_UNKNOWN' };
  const source = await firstFile(packageVendorCandidates());
  if (!source) return { ok: false, code: 'VENDOR_GSAP_SOURCE_MISSING' };
  const sourceIssue = gsapVendorCompatibilityIssue(await fs.readFile(source, 'utf8').catch(() => ''));
  if (sourceIssue) return { ok: false, code: 'VENDOR_GSAP_SOURCE_INCOMPATIBLE', missing: sourceIssue.missing };
  await fs.mkdir(path.dirname(targetAbsPath), { recursive: true });
  await fs.copyFile(source, targetAbsPath);
  return { ok: true };
}

async function validateKnownBundledVendor(ref: string, targetAbsPath: string): Promise<Issue | null> {
  if (!isKnownBundledVendorRef(ref)) return null;
  const text = await fs.readFile(targetAbsPath, 'utf8').catch(() => '');
  const issue = gsapVendorCompatibilityIssue(text);
  if (!issue) return null;
  return {
    code: 'VENDOR_GSAP_INCOMPATIBLE',
    severity: 'error',
    selector: `[src="${ref}"]`,
    message: `Existing GSAP vendor is missing required timeline APIs: ${issue.missing.join(', ')}. Remove or replace assets/vendor/gsap.min.js; do not patch it manually inside the composition.`,
    fixHint: 'Delete the incompatible local vendor file so VideoStudio can prepare the built-in GSAP vendor, or replace it with a compatible full GSAP build.',
    source: 'ovs-composition-vendor-assets',
  };
}

export async function loadCompositionMeta(compositionDirAbs: string): Promise<{ meta: CompositionMeta | null; issues: Issue[] }> {
  const issues: Issue[] = [];
  const htmlPath = path.join(compositionDirAbs, 'index.html');
  const st = await fs.stat(htmlPath).catch(() => null);
  if (!st?.isFile()) {
    return {
      meta: null,
      issues: [{
        code: 'NO_COMPOSITION',
        severity: 'error',
        selector: 'index.html',
        message: `No index.html found in composition dir: ${compositionDirAbs}`,
        source: 'ovs-composition-lint',
      }],
    };
  }

  const html = await fs.readFile(htmlPath, 'utf8');
  const rootTag = html.match(/<[^>]+\bdata-composition-id\s*=\s*["'][^"']+["'][^>]*>/i)?.[0] ?? '';
  const rootAttrs = rootTag ? parseAttrs(rootTag) : {};
  const width = htmlAttrNumber(rootAttrs, 'data-width') || DEFAULT_WIDTH;
  const height = htmlAttrNumber(rootAttrs, 'data-height') || DEFAULT_HEIGHT;
  const durationSec = htmlAttrNumber(rootAttrs, 'data-duration') || DEFAULT_DURATION_SEC;
  const id = rootAttrs['data-composition-id'] || 'main';

  if (!rootTag) {
    issues.push({
      code: 'ROOT_COMPOSITION_MISSING',
      severity: 'error',
      selector: '[data-composition-id]',
      message: 'index.html must declare a root element with data-composition-id, data-width, data-height, and data-duration.',
      source: 'ovs-composition-lint',
    });
  }
  for (const key of ['data-width', 'data-height', 'data-duration']) {
    if (!htmlAttrNumber(rootAttrs, key)) {
      issues.push({
        code: 'ROOT_TIMING_ATTR_MISSING',
        severity: 'error',
        selector: '[data-composition-id]',
        message: `root composition is missing a positive numeric ${key}.`,
        source: 'ovs-composition-lint',
      });
    }
  }
  if (durationSec > MAX_RENDER_DURATION_SEC) {
    issues.push({
      code: 'DURATION_TOO_LONG',
      severity: 'error',
      selector: '[data-composition-id]',
      message: `composition duration ${durationSec}s exceeds the ${MAX_RENDER_DURATION_SEC}s render limit.`,
      source: 'ovs-composition-lint',
    });
  }

  const refs = extractResourceRefs(html);
  const audioTracks: AudioTrack[] = [];
  for (const item of refs) {
    if (isIgnorableRef(item.ref)) continue;
    if (isRemoteRef(item.ref)) {
      issues.push({
        code: 'REMOTE_RESOURCE_BLOCKED',
        severity: 'error',
        selector: `[${item.attr}="${item.ref}"]`,
        message: `Remote runtime resource is not allowed during video render: ${item.ref}`,
        fixHint: 'Copy runtime assets into the composition directory and reference them relatively.',
        source: 'ovs-composition-lint',
      });
      continue;
    }
    if (path.isAbsolute(item.ref)) {
      issues.push({
        code: 'ABSOLUTE_RESOURCE_BLOCKED',
        severity: 'error',
        selector: `[${item.attr}="${item.ref}"]`,
        message: `Absolute runtime resource is not allowed during video render: ${item.ref}`,
        source: 'ovs-composition-lint',
      });
      continue;
    }
    const abs = safeResolveLocalRef(compositionDirAbs, item.ref);
    if (!abs) {
      issues.push({
        code: 'RESOURCE_OUT_OF_SCOPE',
        severity: 'error',
        selector: `[${item.attr}="${item.ref}"]`,
        message: `Resource reference escapes the composition directory: ${item.ref}`,
        source: 'ovs-composition-lint',
      });
      continue;
    }
    let exists = await fs.stat(abs).catch(() => null);
    if ((!exists || !exists.isFile()) && isKnownBundledVendorRef(item.ref)) {
      const prepared = await copyKnownBundledVendor(item.ref, abs);
      if (prepared.ok === false) {
        issues.push({
          code: prepared.code,
          severity: 'error',
          selector: `[${item.attr}="${item.ref}"]`,
          message: `Built-in vendor resource could not be prepared: ${item.ref}`,
          fixHint: prepared.missing
            ? `Built-in GSAP vendor is missing required APIs: ${prepared.missing.join(', ')}.`
            : 'Use the built-in stage-compose vendor path assets/vendor/gsap.min.js or remove the runtime dependency.',
          source: 'ovs-composition-vendor-assets',
        });
        continue;
      }
      exists = await fs.stat(abs).catch(() => null);
    }
    if (exists?.isFile() && isKnownBundledVendorRef(item.ref)) {
      const vendorIssue = await validateKnownBundledVendor(item.ref, abs);
      if (vendorIssue) {
        issues.push(vendorIssue);
        continue;
      }
    }
    if (!exists?.isFile()) {
      issues.push({
        code: 'LOCAL_RESOURCE_MISSING',
        severity: 'error',
        selector: `[${item.attr}="${item.ref}"]`,
        message: `Local resource does not exist: ${item.ref}`,
        source: 'ovs-composition-lint',
      });
    }
  }

  const audioRe = /<audio\b[^>]*>/gi;
  let audioMatch: RegExpExecArray | null;
  while ((audioMatch = audioRe.exec(html)) !== null) {
    const attrs = parseAttrs(audioMatch[0]);
    const src = attrs.src;
    if (!src || isIgnorableRef(src) || isRemoteRef(src) || path.isAbsolute(src)) continue;
    const abs = safeResolveLocalRef(compositionDirAbs, src);
    if (abs) {
      audioTracks.push({
        absPath: abs,
        startSec: Number(attrs['data-start']) || 0,
        declaredDurationSec: htmlAttrNumber(attrs, 'data-duration') || undefined,
        volume: Number.isFinite(Number(attrs['data-volume'])) && Number(attrs['data-volume']) >= 0
          ? Number(attrs['data-volume'])
          : 1,
      });
    }
  }

  return {
    meta: { htmlPath, html, rootAttrs, id, width, height, durationSec, audioTracks },
    issues,
  };
}

function jsonCanvas(value: unknown): { width: number; height: number; duration: number; fps: number } {
  const canvas = isRecord(value) && isRecord(value.canvas) ? value.canvas : {};
  return {
    width: numberFrom(canvas.width),
    height: numberFrom(canvas.height),
    duration: numberFrom(canvas.duration ?? canvas.duration_sec ?? canvas.duration_seconds),
    fps: numberFrom(canvas.fps),
  };
}

function expectedCanvas(contract: unknown, sceneMap: unknown): { width: number; height: number; duration: number; fps: number } {
  const fromSceneMap = jsonCanvas(sceneMap);
  const fromContract = jsonCanvas(contract);
  return {
    width: fromSceneMap.width || fromContract.width,
    height: fromSceneMap.height || fromContract.height,
    duration: fromSceneMap.duration || fromContract.duration,
    fps: fromSceneMap.fps || fromContract.fps,
  };
}

/**
 * The design contract's budget sections. A contract that declares none of these
 * is not a budget, just a style note.
 */
const DESIGN_CONTRACT_SECTIONS = ['aesthetic', 'visual_direction', 'cover', 'layout_boxes', 'typography_tokens', 'color_tokens', 'motion_budget', 'scene_variation'];

/**
 * The subset that has to be there before we spend a preview or a render: these
 * are what actually steer HTML authoring. The rest degrade the output; these
 * decide whether there is a design at all.
 */
const PREVIEW_REQUIRED_DESIGN_SECTIONS = new Set(['aesthetic', 'visual_direction', 'cover', 'motion_budget', 'scene_variation']);

const AESTHETIC_FIELDS = ['subject_world', 'one_job', 'signature_device', 'aesthetic_risk', 'anti_template_check'];
const VISUAL_DIRECTION_FIELDS = ['visual_tradition', 'lazy_defaults_rejected', 'video_scale', 'depth_layer_rule', 'motion_verb_rule', 'rhythm_pattern'];
const COVER_CONTRACT_FIELDS = ['scene_id', 'headline', 'content_signals', 'hero_visual', 'composition_strategy', 'frame_time_sec'];
const REFERENCE_MEDIA_TYPES = new Set(['image', 'video']);
const REFERENCE_INTENTS = new Set(['reproduce', 'edit', 'guide']);
const REFERENCE_INTENT_BASES = new Set(['user', 'inferred']);
const REFERENCE_ROLES = new Set(['content', 'identity', 'composition', 'structure', 'style', 'motion', 'timing', 'audio']);
/** Floor for a declared reference_fidelity verification threshold. The scored
 *  design-review layer is gone (quality is judged on frames, not numbers);
 *  this survives only to sanity-check the contract's own declared floor. */
const REFERENCE_FIDELITY_MIN_FLOOR = 70;

/** Style words that sound like a thesis but constrain nothing. */
const GENERIC_AESTHETIC_RE = /\b(?:modern tech|clean modern|sleek|premium|minimalist|minimal|futuristic|dynamic|engaging|professional|high[- ]end|beautiful|polished)\b/i;

// Completeness stays blocking — a missing section means the decision was never
// made. Grading AUTHORED prose (GENERIC_AESTHETIC_THESIS) does not: the user
// reviews the resulting frames at the preview, and a taste judgment must not
// spend repair rounds before they see them.
const HARD_PREVIEW_DESIGN_CODES = new Set([
  'AESTHETIC_THESIS_INCOMPLETE',
  'VISUAL_DIRECTION_INCOMPLETE',
  'SCENE_DEPTH_LAYERS_MISSING',
  'SCENE_MOTION_VERBS_MISSING',
]);

/** Field lists per design-contract section, for messages that name what a
 *  missing section must contain — bare section names cost one structurally
 *  guaranteed extra round (add shells → get told the fields). */
const DESIGN_SECTION_FIELDS: Record<string, readonly string[]> = {
  aesthetic: AESTHETIC_FIELDS,
  visual_direction: VISUAL_DIRECTION_FIELDS,
  cover: COVER_CONTRACT_FIELDS,
};

function designContractSectionShape(sections: string[]): string {
  return sections
    .map((key) => {
      const fields = DESIGN_SECTION_FIELDS[key];
      return fields ? `${key}{${fields.join(', ')}}` : key;
    })
    .join('; ');
}

function designSeverity(code: string, hard = true): Issue['severity'] {
  if (code === 'DESIGN_CONTRACT_BUDGET_INCOMPLETE') return hard ? 'error' : 'warning';
  return HARD_PREVIEW_DESIGN_CODES.has(code) ? 'error' : 'warning';
}

/** Present and substantive — a 2-character placeholder is not a decision. */
function hasContent(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length >= 4;
  if (Array.isArray(value)) return value.length > 0;
  if (isRecord(value)) return Object.values(value).some(hasContent);
  return value !== null && value !== undefined && value !== false;
}

function hasCoverContractValue(key: string, value: unknown): boolean {
  if (key === 'scene_id' || key === 'headline') {
    return typeof value === 'string' && value.trim().length > 0;
  }
  if (key === 'frame_time_sec') return Number.isFinite(Number(value));
  return hasContent(value);
}

function designTextFrom(value: unknown): string {
  const out: string[] = [];
  const walk = (node: unknown, depth: number): void => {
    if (depth > 6 || node === null || node === undefined) return;
    if (typeof node === 'string') { out.push(node); return; }
    if (Array.isArray(node)) { for (const item of node) walk(item, depth + 1); return; }
    if (isRecord(node)) for (const item of Object.values(node)) walk(item, depth + 1);
  };
  walk(value, 0);
  return out.join(' ');
}

/**
 * Check a design contract against the budget it claims to be, before a preview
 * or render is spent on it.
 *
 * New compositions supply this budget through composition-manifest.json
 * art_direction; legacy design-contract.json remains readable. No manifest or
 * legacy contract means no opinion, so raw HyperFrames projects stay usable.
 *
 * Pure → fixtured for complete, thin, and look-alike contracts.
 */
export function designContractIssues(
  contract: unknown,
  sceneMap: unknown,
  selector = 'composition-manifest.json',
  options: { deliveredOpening?: boolean } = {},
): Issue[] {
  if (!isRecord(contract)) return [];
  const issues: Issue[] = [];
  // Cover semantics are a whole-video property: frame 0 of the DELIVERED video
  // is its poster. A middle segment of an assembled production has no cover to
  // declare, so the cover family does not apply to it.
  const deliveredOpening = options.deliveredOpening !== false;

  const requiredSections = deliveredOpening
    ? DESIGN_CONTRACT_SECTIONS
    : DESIGN_CONTRACT_SECTIONS.filter((key) => key !== 'cover');
  const missingSections = requiredSections.filter((key) => !hasContent(contract[key]));
  if (missingSections.length) {
    const code = 'DESIGN_CONTRACT_BUDGET_INCOMPLETE';
    const missingPreviewRequired = missingSections.filter((key) => PREVIEW_REQUIRED_DESIGN_SECTIONS.has(key));
    issues.push({
      code,
      severity: designSeverity(code, missingPreviewRequired.length > 0),
      selector,
      message: `Design contract is missing aesthetic budget sections: ${designContractSectionShape(missingSections)}.`,
      fixHint: 'Write every listed section COMPLETE in one pass — each missing section names its own required fields above; adding empty shells only buys another failed round.',
      source: 'ovs-design-contract',
    });
  }

  const cover = isRecord(contract.cover) ? contract.cover : {};
  const missingCoverFields = deliveredOpening
    ? COVER_CONTRACT_FIELDS.filter((key) => !hasCoverContractValue(key, cover[key]))
    : [];
  if (!deliveredOpening) {
    /* the cover family belongs to the delivered opening — skip it entirely */
  } else if (missingCoverFields.length) {
    issues.push({
      code: 'COVER_CONTRACT_INCOMPLETE',
      severity: 'error',
      selector: `${selector}#cover`,
      message: `The frame-0 cover contract is incomplete: ${missingCoverFields.join(', ')} missing.`,
      fixHint: 'Bind frame 0 to the first canonical scene, approved headline, two content signals, one hero visual, and a thumbnail composition strategy.',
      source: 'ovs-design-contract',
    });
  } else {
    const canonicalScenes = extractScenes(sceneMap).length ? extractScenes(sceneMap) : extractScenes(contract);
    const coverSceneId = String(cover.scene_id || '').trim();
    const firstScene = canonicalScenes[0];
    const matchedScene = canonicalScenes.find((scene) => sceneId(scene) === coverSceneId);
    if (!matchedScene || (firstScene && sceneId(firstScene) !== coverSceneId)) {
      issues.push({
        code: 'COVER_SCENE_NOT_FRAME_ZERO',
        severity: 'error',
        selector: `${selector}#cover.scene_id`,
        message: `Cover scene "${coverSceneId}" must be the first canonical scene.`,
        fixHint: 'Use the first scene id and design its exact 0s state as the cover.',
        source: 'ovs-design-contract',
      });
    }
    if (Number(cover.frame_time_sec) !== 0) {
      issues.push({
        code: 'COVER_FRAME_TIME_INVALID',
        severity: 'error',
        selector: `${selector}#cover.frame_time_sec`,
        message: 'cover.frame_time_sec must be 0 so the exported cover matches the video first frame.',
        source: 'ovs-design-contract',
      });
    }
    const contentSignals = Array.isArray(cover.content_signals)
      ? cover.content_signals.map((item) => String(item).trim()).filter(Boolean)
      : [];
    if (contentSignals.length < 2) {
      issues.push({
        code: 'COVER_CONTENT_SIGNALS_THIN',
        // How many signals the cover DECLARES is an ambition judgment, not a
        // completeness failure — the user reviews the frames at the preview.
        severity: 'warning',
        selector: `${selector}#cover.content_signals`,
        message: 'The cover declares fewer than two topic-specific content signals.',
        source: 'ovs-design-contract',
      });
    }
    if (matchedScene) {
      const approved = normalizeForSearch(designTextFrom(matchedScene.approved_copy));
      const headline = normalizeForSearch(cover.headline);
      if (headline && approved && !approved.includes(headline)) {
        issues.push({
          code: 'COVER_HEADLINE_NOT_APPROVED',
          severity: 'error',
          selector: `${selector}#cover.headline`,
          message: 'The cover headline is not present in the approved copy of its canonical scene.',
          source: 'ovs-design-contract',
        });
      }
    }
  }

  const referenceFidelity = isRecord(contract.reference_fidelity) ? contract.reference_fidelity : {};
  const references = Array.isArray(contract.references) ? contract.references : [];
  if (hasContent(referenceFidelity) || references.length) {
    const mode = String(referenceFidelity.mode || '').trim().toLowerCase();
    const preserve = Array.isArray(referenceFidelity.preserve)
      ? referenceFidelity.preserve.map((item) => String(item).trim()).filter(Boolean)
      : [];
    const mayChange = Array.isArray(referenceFidelity.may_change)
      ? referenceFidelity.may_change.map((item) => String(item).trim()).filter(Boolean)
      : [];
    const anchors = Array.isArray(referenceFidelity.layout_anchors)
      ? referenceFidelity.layout_anchors.filter(isRecord)
      : [];
    const verification = isRecord(referenceFidelity.verification)
      ? referenceFidelity.verification
      : {};
    const minimumScore = Number(verification.minimum_score);
    const missing: string[] = [];
    if (!['exact', 'close', 'adapt'].includes(mode)) missing.push('mode');
    if (!references.length) missing.push('references');
    if (!preserve.length) missing.push('preserve');
    if (!Array.isArray(referenceFidelity.may_change)) missing.push('may_change');
    if (!Number.isFinite(minimumScore)
      || minimumScore < REFERENCE_FIDELITY_MIN_FLOOR
      || minimumScore > 100) {
      missing.push('verification.minimum_score');
    }
    if (missing.length) {
      issues.push({
        code: 'REFERENCE_FIDELITY_CONTRACT_INCOMPLETE',
        // Advisory: these fields describe intent and change nothing that
        // renders — fidelity is judged on the rendered frames. The reference
        // LIST and per-reference media contracts stay blocking.
        severity: 'warning',
        selector: `${selector}#reference_fidelity`,
        message: `Concrete references need an executable fidelity contract: ${missing.join(', ')} missing or invalid.`,
        source: 'ovs-design-contract',
      });
    }
    if (mode === 'exact' && preserve.length < 3) {
      issues.push({
        code: 'REFERENCE_EXACT_PRESERVE_THIN',
        severity: 'warning',
        selector: `${selector}#reference_fidelity.preserve`,
        message: 'Exact fidelity should preserve at least three named visual axes.',
        source: 'ovs-design-contract',
      });
    }
    if (mode === 'exact' && Number.isFinite(minimumScore) && minimumScore < 85) {
      issues.push({
        code: 'REFERENCE_EXACT_SCORE_FLOOR_LOW',
        severity: 'warning',
        selector: `${selector}#reference_fidelity.verification.minimum_score`,
        message: 'Exact fidelity normally uses a reference_fidelity score threshold of at least 85.',
        source: 'ovs-design-contract',
      });
    }
    if (mayChange.some((item) => preserve.includes(item))) {
      issues.push({
        code: 'REFERENCE_FIDELITY_RULE_CONFLICT',
        severity: 'error',
        selector: `${selector}#reference_fidelity`,
        message: 'The same visual axis cannot appear in both preserve and may_change.',
        source: 'ovs-design-contract',
      });
    }
    const sceneIds = new Set(extractScenes(contract).map(sceneId).filter(Boolean));
    const needsLayoutAnchors = mode === 'exact' || references.some((item) => (
      isRecord(item)
      && Array.isArray(item.roles)
      && item.roles.some((role) => role === 'composition' || role === 'structure')
    ));
    if (needsLayoutAnchors && !anchors.length) {
      issues.push({
        code: 'REFERENCE_LAYOUT_ANCHORS_REQUIRED',
        severity: 'error',
        selector: `${selector}#reference_fidelity.layout_anchors`,
        message: 'Exact, composition, and structure references require normalized layout anchors.',
        source: 'ovs-design-contract',
      });
    }
    for (const [index, rawReference] of references.entries()) {
      const refSelector = `${selector}#references.${index}`;
      if (!isRecord(rawReference)) {
        issues.push({
          code: 'REFERENCE_MEDIA_CONTRACT_INVALID',
          severity: 'error',
          selector: refSelector,
          message: 'Each reference must describe its media, intent, roles, and preservation boundary.',
          source: 'ovs-design-contract',
        });
        continue;
      }
      const mediaType = String(rawReference.media_type || '').trim().toLowerCase();
      const intent = rawReference.intent === undefined
        ? 'guide'
        : String(rawReference.intent || '').trim().toLowerCase();
      const intentBasis = rawReference.intent_basis === undefined
        ? 'inferred'
        : String(rawReference.intent_basis || '').trim().toLowerCase();
      const roles = Array.isArray(rawReference.roles)
        ? rawReference.roles.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
        : [];
      const referencePreserve = Array.isArray(rawReference.preserve)
        ? rawReference.preserve.map((item) => String(item).trim()).filter(Boolean)
        : [];
      const referenceMayChange = Array.isArray(rawReference.may_change)
        ? rawReference.may_change.map((item) => String(item).trim()).filter(Boolean)
        : [];
      const targetSceneIds = Array.isArray(rawReference.target_scene_ids)
        ? rawReference.target_scene_ids.map((item) => String(item).trim()).filter(Boolean)
        : [];
      const invalid: string[] = [];
      if (!String(rawReference.id || '').trim()) invalid.push('id');
      if (!REFERENCE_MEDIA_TYPES.has(mediaType)) invalid.push('media_type');
      if (!REFERENCE_INTENTS.has(intent)) invalid.push('intent');
      if (!REFERENCE_INTENT_BASES.has(intentBasis)) invalid.push('intent_basis');
      if (!String(rawReference.path || '').trim()) invalid.push('path');
      if (!roles.length || roles.some((role) => !REFERENCE_ROLES.has(role))) invalid.push('roles');
      if (!referencePreserve.length) invalid.push('preserve');
      if (!Array.isArray(rawReference.may_change)) invalid.push('may_change');
      if (!targetSceneIds.length) invalid.push('target_scene_ids');
      if ((intent === 'reproduce' || intent === 'edit') && rawReference.required !== true) invalid.push('required');
      if (intent === 'edit' && !referenceMayChange.length) invalid.push('may_change');
      if (referenceMayChange.some((item) => referencePreserve.includes(item))) invalid.push('preserve/may_change conflict');
      if (invalid.length) {
        issues.push({
          code: 'REFERENCE_MEDIA_CONTRACT_INVALID',
          severity: 'error',
          selector: refSelector,
          message: `Reference media contract is incomplete or invalid: ${invalid.join(', ')}.`,
          source: 'ovs-design-contract',
        });
      }
      for (const targetSceneId of targetSceneIds) {
        if (sceneIds.size && !sceneIds.has(targetSceneId)) {
          issues.push({
            code: 'REFERENCE_TARGET_SCENE_UNKNOWN',
            severity: 'error',
            selector: `${refSelector}.target_scene_ids`,
            message: `Reference targets unknown scene "${targetSceneId}".`,
            source: 'ovs-design-contract',
          });
        }
      }
      const temporalAnchors = Array.isArray(rawReference.temporal_anchors)
        ? rawReference.temporal_anchors.filter(isRecord)
        : [];
      const needsTemporal = mediaType === 'video'
        && (intent === 'reproduce'
          || intent === 'edit'
          || roles.includes('motion')
          || roles.includes('timing'));
      if (needsTemporal && !temporalAnchors.length) {
        issues.push({
          code: 'REFERENCE_VIDEO_TEMPORAL_ANCHORS_REQUIRED',
          severity: 'error',
          selector: `${refSelector}.temporal_anchors`,
          message: 'Video references used for reproduction, editing, motion, or timing require temporal anchors.',
          source: 'ovs-design-contract',
        });
      }
      temporalAnchors.forEach((anchor, anchorIndex) => {
        const start = Number(anchor.source_start_sec);
        const end = Number(anchor.source_end_sec);
        const target = String(anchor.target_scene_id || '').trim();
        if (!Number.isFinite(start)
          || start < 0
          || !Number.isFinite(end)
          || end <= start
          || !target
          || (sceneIds.size > 0 && !sceneIds.has(target))) {
          issues.push({
            code: 'REFERENCE_VIDEO_TEMPORAL_ANCHOR_INVALID',
            severity: 'error',
            selector: `${refSelector}.temporal_anchors.${anchorIndex}`,
            message: 'A temporal anchor needs a valid source range and existing target scene.',
            source: 'ovs-design-contract',
          });
        }
      });
    }
  }

  const aesthetic = isRecord(contract.aesthetic) ? contract.aesthetic : {};
  // frontend-design documents anti_template_check; older contracts wrote
  // anti_template. Treat them as aliases so a real thesis is not reported
  // missing over a field-name drift.
  const aestheticForChecks: Record<string, unknown> = {
    ...aesthetic,
    anti_template_check: hasContent(aesthetic.anti_template_check) ? aesthetic.anti_template_check : aesthetic.anti_template,
  };
  const missingAesthetic = AESTHETIC_FIELDS.filter((key) => !hasContent(aestheticForChecks[key]));
  if (hasContent(contract.aesthetic) && missingAesthetic.length) {
    const code = 'AESTHETIC_THESIS_INCOMPLETE';
    issues.push({
      code,
      severity: designSeverity(code),
      selector: `${selector}#aesthetic`,
      message: `Aesthetic thesis is too thin for distinctive HTML: ${missingAesthetic.join(', ')} missing.`,
      fixHint: 'Name the subject-specific visual world, signature device, risk, and rejected generic move.',
      source: 'ovs-design-contract',
    });
  }

  const aestheticText = designTextFrom(aesthetic);
  if (aestheticText && GENERIC_AESTHETIC_RE.test(aestheticText) && !hasContent(aesthetic.signature_device)) {
    const code = 'GENERIC_AESTHETIC_THESIS';
    issues.push({
      code,
      severity: designSeverity(code),
      selector: `${selector}#aesthetic`,
      message: 'Aesthetic thesis uses generic style language without a concrete signature device.',
      fixHint: 'Replace generic descriptors with a visual behavior that belongs to this brief.',
      source: 'ovs-design-contract',
    });
  }

  const visualDirection = isRecord(contract.visual_direction) ? contract.visual_direction : {};
  const missingVisualDirection = VISUAL_DIRECTION_FIELDS.filter((key) => !hasContent(visualDirection[key]));
  if (hasContent(contract.visual_direction) && missingVisualDirection.length) {
    const code = 'VISUAL_DIRECTION_INCOMPLETE';
    issues.push({
      code,
      severity: designSeverity(code),
      selector: `${selector}#visual_direction`,
      message: `Visual direction is missing pre-authoring fields: ${missingVisualDirection.join(', ')}.`,
      fixHint: 'Name the design tradition, rejected lazy defaults, video-scale rule, depth-layer rule, motion-verb rule, and rhythm pattern before HTML authoring.',
      source: 'ovs-design-contract',
    });
  }

  // Per-scene design plan: prefer the contract's own scenes, fall back to the
  // scene map when the contract does not restate them. Accept the MEANING, not
  // one spelling: the depth fixHint itself tells the model to write
  // background/midground/foreground, so three separate fields must pass the
  // check that prescribed them; likewise `motion` next to motion_verbs.
  const scenes = extractScenes(contract).length ? extractScenes(contract) : extractScenes(sceneMap);
  const sceneHasDepth = (scene: Record<string, unknown>): boolean =>
    hasContent(scene.depth_layers)
    || (hasContent(scene.background) && hasContent(scene.midground) && hasContent(scene.foreground));
  const missingDepth = scenes.filter((scene) => !sceneHasDepth(scene)).slice(0, 4);
  if (scenes.length && missingDepth.length) {
    const code = 'SCENE_DEPTH_LAYERS_MISSING';
    issues.push({
      code,
      severity: designSeverity(code),
      selector: `${selector}#scenes`,
      message: `Scene art direction is missing background/midground/foreground depth layers for ${missingDepth.map(sceneLabel).join(', ')}.`,
      fixHint: 'Give each scene a topic-derived background, a dominant midground, and foreground accents — as depth_layers or as background/midground/foreground fields, inside the design contract\'s own scenes[] (not the manifest\'s canonical scenes[], whose schema rejects unknown keys).',
      source: 'ovs-design-contract',
    });
  }

  const sceneHasMotion = (scene: Record<string, unknown>): boolean =>
    hasContent(scene.motion_verbs) || hasContent(scene.motion_choreography) || hasContent(scene.motion);
  const missingVerbs = scenes.filter((scene) => !sceneHasMotion(scene)).slice(0, 4);
  if (scenes.length && missingVerbs.length) {
    const code = 'SCENE_MOTION_VERBS_MISSING';
    issues.push({
      code,
      severity: designSeverity(code),
      selector: `${selector}#scenes`,
      message: `Scene art direction is missing motion verbs for ${missingVerbs.map(sceneLabel).join(', ')}.`,
      fixHint: 'Say what each primary element does (draws, stamps, counts up, locks, drifts, resolves) in motion_verbs — inside the design contract\'s own scenes[], not the manifest\'s canonical scenes[].',
      source: 'ovs-design-contract',
    });
  }

  return issues;
}

/**
 * Design-contract readiness at PREPARE time. Every design-contract fixHint says
 * "before writing HTML", yet the earliest the checks used to fire was
 * inspect/draft — after the HTML exists, with instructions addressed to a
 * moment already gone. Reuses designContractIssues so prepare and inspect
 * cannot disagree; the cover family deliberately stays with inspect, which is
 * where frame-0 evidence exists.
 */
export function designContractReadiness(
  contract: unknown,
  sceneMap: unknown = null,
): { status: 'missing' | 'incomplete' | 'ready'; issues: Issue[] } {
  if (!isRecord(contract) || !DESIGN_CONTRACT_SECTIONS.some((key) => hasContent(contract[key]))) {
    return { status: 'missing', issues: [] };
  }
  // All designContractIssues checks are contract-level and fixable before any
  // HTML exists — including the cover CONTRACT. Frame-evidence cover checks
  // (headline/signals actually rendered) live in runContractHtmlQa and stay
  // with inspect, where the frames exist.
  const issues = designContractIssues(contract, sceneMap);
  return { status: issues.some((issue) => issue.severity === 'error') ? 'incomplete' : 'ready', issues };
}

/**
 * Copy search over composition HTML that survives markup. Approved copy can be
 * split across elements for per-word reveals, which puts tags and whitespace
 * between the fragments; a line carrying no whitespace of its own (every CJK
 * line) could never be found once animated word by word. Script/style bodies
 * never render, so copy found only there does not count. Deliberate looseness:
 * element boundaries read as whitespace, and the compact fallback (whitespace-
 * free needles only) matches across boundaries — that is exactly what finds a
 * per-character CJK reveal, at the cost of occasionally crediting adjacent
 * fragments. A missed real line costs a repair loop; an adjacent-fragment
 * credit costs nothing the preview does not show.
 */
export function htmlCopySearch(html: string): (needle: string) => boolean {
  const withoutCode = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ');
  const raw = normalizeForSearch(withoutCode);
  const text = normalizeForSearch(withoutCode.replace(/<[^>]*>/g, ' '));
  const textCompact = text.replace(/ /g, '');
  return (needle: string): boolean => {
    const n = normalizeForSearch(needle);
    if (!n) return true;
    if (raw.includes(n) || text.includes(n)) return true;
    return !/\s/.test(n) && textCompact.includes(n.replace(/ /g, ''));
  };
}

const TIMELINE_POSITION_ARG_INDEX: Record<string, number> = {
  set: 2, to: 2, from: 2, fromTo: 3, add: 1, addLabel: 1, call: 2,
};

/** Timing tolerance shared with the scene-window checks. */
const TIMELINE_POSITION_TOLERANCE_SEC = 0.15;
const TIMELINE_POSITION_MAX_REPORTED = 60;

export type AuthoredAbsolutePosition = {
  method: string;
  seconds: number;
  line: number;
  suggestion: string;
  /** The scene whose window contains the literal — the one `suggestion`
   *  offsets from. `scenes` is non-empty by the guard, so there is always one. */
  scene_id: string;
};

/** Split one call's top-level arguments, respecting nesting and strings. */
function splitCallArguments(source: string, openIndex: number): { args: string[]; endIndex: number } | null {
  const args: string[] = [];
  let depth = 0;
  let quote = '';
  let current = '';
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      current += ch;
      if (ch === '\\') { current += source[++i] ?? ''; continue; }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; current += ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
      if (depth === 1) continue;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) { args.push(current.trim()); return { args, endIndex: i }; }
    } else if (ch === ',' && depth === 1) {
      args.push(current.trim());
      current = '';
      continue;
    }
    if (depth >= 1) current += ch;
  }
  return null;
}

/**
 * Timeline positions written as absolute seconds instead of `S(id)` offsets.
 *
 * The scene windows these literals encode can be recomputed after the HTML is
 * authored (`ovs composition reconcile` rewrites every section's data-start
 * when timing changes, e.g. once narration is measured) — the scaffold's own
 * reveal follows because it is positioned from S(id), but an authored literal
 * keeps playing against the old window. The checker knows every window, so it
 * hands back the exact replacement expression rather than only the complaint.
 */
export function authoredAbsoluteTimelinePositions(
  html: string,
  scenes: { id: string; start: number; duration: number }[],
): AuthoredAbsolutePosition[] {
  const found: AuthoredAbsolutePosition[] = [];
  if (!scenes.length) return found;
  const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch: RegExpExecArray | null;
  while ((scriptMatch = scriptRe.exec(html)) !== null) {
    const script = scriptMatch[1];
    const scriptOffset = scriptMatch.index + scriptMatch[0].indexOf(script);
    const callRe = /\btl\s*\.\s*(set|to|from|fromTo|add|addLabel|call)\s*\(/g;
    let call: RegExpExecArray | null;
    while ((call = callRe.exec(script)) !== null) {
      const parsed = splitCallArguments(script, call.index + call[0].length - 1);
      if (!parsed) continue;
      callRe.lastIndex = parsed.endIndex;
      const method = call[1];
      const position = parsed.args[TIMELINE_POSITION_ARG_INDEX[method]];
      if (!position) continue;
      // `S(id) + 0.2` is the offset form this check exists to promote, and a
      // string position ("+=1", "<", a label) is relative to another tween
      // rather than to the timeline, so both survive a retime unchanged.
      if (/\b[SD]\s*\(/.test(position) || /^["'`]/.test(position)) continue;
      const literals = (position.match(/(?<![\w.])\d+(?:\.\d+)?/g) || []).map(Number);
      const seconds = literals.find((value) => value > TIMELINE_POSITION_TOLERANCE_SEC);
      if (seconds === undefined) continue;
      const owner = scenes.find((scene) => seconds >= scene.start && seconds < scene.start + scene.duration)
        || scenes[scenes.length - 1];
      const offset = Math.round((seconds - owner.start) * 1000) / 1000;
      found.push({
        method,
        seconds,
        line: html.slice(0, scriptOffset + call.index).split('\n').length,
        suggestion: offset === 0
          ? `S(${JSON.stringify(owner.id)})`
          : `S(${JSON.stringify(owner.id)}) + ${offset}`,
        scene_id: owner.id,
      });
      if (found.length >= TIMELINE_POSITION_MAX_REPORTED) return found;
    }
  }
  return found;
}

export async function referenceFidelityAssetIssues(
  contract: unknown,
  compositionDirAbs: string,
  selector = 'composition-manifest.json',
): Promise<Issue[]> {
  if (!isRecord(contract) || !Array.isArray(contract.references)) return [];
  const issues: Issue[] = [];
  for (const [index, rawReference] of contract.references.entries()) {
    if (!isRecord(rawReference)) continue;
    const ref = String(rawReference.path || '').trim();
    if (!ref) continue;
    const local = safeResolveLocalRef(compositionDirAbs, ref);
    if (!local || path.isAbsolute(ref) || isRemoteRef(ref)) {
      issues.push({
        code: 'REFERENCE_FIDELITY_PATH_INVALID',
        severity: 'error',
        selector: `${selector}#references.${index}.path`,
        message: `Reference fidelity inputs must be composition-local relative files: ${ref}`,
        fixHint: 'Copy the inspected reference into assets/references/ and record that local path in the manifest.',
        source: 'ovs-design-contract',
      });
      continue;
    }
    const stat = await fs.stat(local).catch(() => null);
    if (!stat?.isFile()) {
      issues.push({
        code: 'REFERENCE_FIDELITY_ASSET_MISSING',
        severity: 'error',
        selector: `${selector}#references.${index}.path`,
        message: `Reference fidelity asset is missing: ${ref}`,
        source: 'ovs-design-contract',
      });
    }
  }
  return issues;
}

function extractScenes(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  if (Array.isArray(value.scenes)) return value.scenes.filter(isRecord);
  if (Array.isArray(value.shots)) return value.shots.filter(isRecord);
  if (isRecord(value.timeline) && Array.isArray(value.timeline.scenes)) return value.timeline.scenes.filter(isRecord);
  return [];
}

function extractShotlistShots(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  if (Array.isArray(value.shots)) return value.shots.filter(isRecord);
  if (Array.isArray(value.scenes)) return value.scenes.filter(isRecord);
  return [];
}

/** Is this file actually a shotlist, by its own shape? The tolerant extractor
 *  above also accepts `{scenes:[...]}` so real legacy files keep working once
 *  activated — but activation itself must not key off that fallback. */
function isLegacyShotlist(value: unknown): boolean {
  return Array.isArray(value) || (isRecord(value) && Array.isArray(value.shots));
}

function sceneLabel(scene: Record<string, unknown>, index: number): string {
  return shortText(scene.id || scene.title || scene.headline || scene.name || `scene-${index + 1}`, 80);
}

function sceneId(scene: Record<string, unknown>): string {
  return String(scene.id || scene.scene_id || scene.sceneId || '').trim();
}

function flattenSceneText(scene: unknown): string[] {
  const out: string[] = [];
  const visit = (value: unknown, key = '') => {
    if (typeof value === 'string') {
      if (/^(id|kind|type|role|layout|asset|src|path|narration_ref)$/i.test(key)) return;
      const s = value.trim();
      if (s.length >= 3 && s.length <= 180) out.push(s);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 12)) visit(item, key);
      return;
    }
    if (isRecord(value)) {
      for (const [k, v] of Object.entries(value)) visit(v, k);
    }
  };
  if (isRecord(scene)) {
    for (const key of ['approved_copy', 'headline', 'title', 'subtitle', 'body', 'copy', 'caption', 'label', 'text']) {
      if (scene[key]) visit(scene[key], key);
    }
  }
  return [...new Set(out)].slice(0, 8);
}

function htmlUsesGsap(html: string): boolean {
  return /\bgsap\s*\./.test(html);
}

function htmlHasLocalGsapVendorScript(html: string): boolean {
  return /<script\b[^>]*\bsrc\s*=\s*["']\.?\/?assets\/vendor\/gsap\.min\.js["'][^>]*>/i.test(html);
}

function contractAudio(value: unknown): Record<string, unknown> | null {
  return isRecord(value) && isRecord(value.audio) ? value.audio : null;
}

function sceneMapAudio(value: unknown): Record<string, unknown> | null {
  return isRecord(value) && isRecord(value.audio) ? value.audio : null;
}

function audioOwnsNarration(audio: Record<string, unknown> | null): boolean {
  if (!audio) return false;
  const owner = String(audio.owner || audio.mode || '').toLowerCase();
  if (audio.render_silent === true || owner === 'assemble' || owner === 'assembler' || owner === 'external') return false;
  return owner === 'composition' || !!(audio.narration || audio.narration_path || audio.path || audio.src);
}

function compositionOwnsNarration(contract: unknown, sceneMap: unknown): boolean {
  const audio = contractAudio(contract);
  const timelineAudio = sceneMapAudio(sceneMap);
  return audioOwnsNarration(audio) || audioOwnsNarration(timelineAudio);
}

function compositionUsesExternalNarration(contract: unknown, sceneMap: unknown): boolean {
  const owners = [contractAudio(contract), sceneMapAudio(sceneMap)]
    .map((audio) => String(audio?.owner || audio?.mode || '').trim().toLowerCase())
    .filter(Boolean);
  return owners.some((owner) => owner === 'assemble' || owner === 'assembler' || owner === 'external');
}

function narrationPathFromAudio(audio: Record<string, unknown> | null): string {
  if (!audio) return '';
  return String(audio.narration || audio.narration_path || audio.path || audio.src || '').trim();
}

function narrationPathFromSources(contract: unknown, sceneMap: unknown): string {
  return narrationPathFromAudio(sceneMapAudio(sceneMap)) || narrationPathFromAudio(contractAudio(contract));
}

function resolveCompositionLocalPath(compositionDirAbs: string, raw: string): string | null {
  if (!raw || isRemoteRef(raw) || isIgnorableRef(raw) || path.isAbsolute(raw)) return null;
  return safeResolveLocalRef(compositionDirAbs, raw);
}

function sceneNarrationText(scene: Record<string, unknown>): string {
  const raw = scene.narration ?? scene.narration_text ?? scene.voiceover ?? scene.audio_text ?? scene.script;
  if (typeof raw === 'string') return raw.trim();
  if (isRecord(raw)) return String(raw.text || raw.body || raw.line || '').trim();
  return '';
}

function isTimedNarrationRef(ref: string): boolean {
  return /#t\s*=/i.test(ref);
}

function isMediaNarrationRef(ref: string): boolean {
  return /\.(?:mp3|wav|m4a|aac|ogg|opus)(?:[?#]|$)/i.test(ref);
}

function sceneNarrationRefs(scene: Record<string, unknown>): string[] {
  const raw = scene.narration_ref || scene.voiceover_ref || scene.script_ref;
  if (Array.isArray(raw)) return raw.map((item) => String(item).trim()).filter(Boolean);
  if (typeof raw === 'string') {
    const ref = raw.trim();
    if (!ref) return [];
    if (isTimedNarrationRef(ref) || isMediaNarrationRef(ref)) return [ref];
    return ref.split(/[, ]+/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function sceneSourceShots(scene: Record<string, unknown>): string[] {
  return Array.isArray(scene.source_shots) ? scene.source_shots.map((item) => String(item).trim()).filter(Boolean) : [];
}

function sceneStartSec(scene: Record<string, unknown>): number {
  return numberFrom(scene.start ?? scene.start_sec);
}

function sceneDurationSec(scene: Record<string, unknown>): number {
  const duration = numberFrom(scene.duration ?? scene.duration_sec);
  if (duration > 0) return duration;
  const start = sceneStartSec(scene);
  const end = numberFrom(scene.end ?? scene.end_sec);
  return end > start ? end - start : 0;
}

function sceneEndSec(scene: Record<string, unknown>): number {
  const start = sceneStartSec(scene);
  const duration = sceneDurationSec(scene);
  if (duration > 0) return start + duration;
  return numberFrom(scene.end ?? scene.end_sec);
}

function sceneKeyCandidates(scene: Record<string, unknown>): string[] {
  const keys = [
    scene.id,
    scene.scene_id,
    scene.shot_id,
    scene.source_shot,
    ...sceneSourceShots(scene),
  ].map((item) => String(item || '').trim()).filter(Boolean);
  return [...new Set(keys)];
}

type NarrationLine = {
  id: string;
  sceneId?: string;
  shotId?: string;
  start: number;
  duration: number;
  text: string;
};

function extractNarrationLines(value: unknown): NarrationLine[] {
  const rawLines = isRecord(value) && Array.isArray(value.lines) ? value.lines : [];
  const lines: NarrationLine[] = [];
  for (const [index, raw] of rawLines.entries()) {
    if (!isRecord(raw)) continue;
    const sceneId = String(raw.scene_id || raw.sceneId || '').trim();
    const shotId = String(raw.shot_id || raw.shotId || '').trim();
    const id = String(raw.id || raw.line_id || sceneId || shotId || `line-${index + 1}`).trim();
    const start = numberFrom(raw.start ?? raw.start_sec);
    const explicitDuration = numberFrom(raw.duration ?? raw.duration_sec);
    const end = numberFrom(raw.end ?? raw.end_sec);
    const duration = explicitDuration > 0 ? explicitDuration : (end > start ? end - start : 0);
    lines.push({
      id,
      ...(sceneId ? { sceneId } : {}),
      ...(shotId ? { shotId } : {}),
      start,
      duration,
      text: String(raw.text || raw.body || raw.line || '').trim(),
    });
  }
  return lines;
}

function narrationLineEnd(line: NarrationLine): number {
  return line.start + Math.max(line.duration, 0);
}

function narrationLineKeyIndex(lines: NarrationLine[]): Map<string, NarrationLine[]> {
  const out = new Map<string, NarrationLine[]>();
  const add = (key: string, line: NarrationLine) => {
    const clean = String(key || '').trim();
    if (!clean) return;
    const bucket = out.get(clean) || [];
    if (!bucket.includes(line)) bucket.push(line);
    out.set(clean, bucket);
  };
  for (const line of lines) {
    add(line.id, line);
    if (line.sceneId) add(line.sceneId, line);
    if (line.shotId) add(line.shotId, line);
  }
  return out;
}

function timedRefRange(ref: string): { start: number; end: number } | null {
  const m = /#t\s*=\s*([0-9.]+)\s*,\s*([0-9.]+)/i.exec(ref);
  if (!m) return null;
  const start = Number(m[1]);
  const end = Number(m[2]);
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
}

function lineMatchesRange(line: NarrationLine, range: { start: number; end: number }): boolean {
  return Math.abs(line.start - range.start) <= 0.35 && Math.abs(narrationLineEnd(line) - range.end) <= 0.35;
}

function narrationLinesForScene(
  scene: Record<string, unknown>,
  refs: string[],
  lines: NarrationLine[],
  byKey: Map<string, NarrationLine[]>,
): { lines: NarrationLine[]; missingRefs: string[] } {
  const matched: NarrationLine[] = [];
  const missingRefs: string[] = [];
  const add = (line: NarrationLine) => {
    if (!matched.includes(line)) matched.push(line);
  };
  const timedRefs: string[] = [];

  for (const ref of refs) {
    const direct = byKey.get(ref);
    if (direct?.length) {
      direct.forEach(add);
    } else if (isTimedNarrationRef(ref) || isMediaNarrationRef(ref)) {
      timedRefs.push(ref);
    } else {
      missingRefs.push(ref);
    }
  }

  if (timedRefs.length) {
    for (const key of sceneKeyCandidates(scene)) {
      byKey.get(key)?.forEach(add);
    }
    const ranges = timedRefs.map(timedRefRange).filter((range): range is { start: number; end: number } => !!range);
    for (const range of ranges) {
      for (const line of lines) {
        if (lineMatchesRange(line, range)) add(line);
      }
    }
    for (const ref of timedRefs) {
      const range = timedRefRange(ref);
      const hasRangeMatch = range ? matched.some((line) => lineMatchesRange(line, range)) : false;
      const hasSceneMatch = matched.some((line) => {
        const keys = sceneKeyCandidates(scene);
        return (line.sceneId && keys.includes(line.sceneId)) || (line.shotId && keys.includes(line.shotId));
      });
      if (!hasRangeMatch && !hasSceneMatch) missingRefs.push(ref);
    }
  }

  return { lines: matched, missingRefs };
}

function audioTargetDuration(contract: unknown, sceneMap: unknown): number {
  const timelineAudio = sceneMapAudio(sceneMap);
  const audio = contractAudio(contract);
  return numberFrom(
    timelineAudio?.narration_duration_seconds
      ?? timelineAudio?.narration_duration_sec
      ?? timelineAudio?.source_duration_seconds
      ?? timelineAudio?.audio_duration_seconds
      ?? timelineAudio?.duration_seconds
      ?? timelineAudio?.duration
      ?? timelineAudio?.duration_sec
      ?? timelineAudio?.target_duration_seconds
      ?? timelineAudio?.target_sec
      ?? audio?.narration_duration_seconds
      ?? audio?.narration_duration_sec
      ?? audio?.source_duration_seconds
      ?? audio?.audio_duration_seconds
      ?? audio?.duration_seconds
      ?? audio?.duration
      ?? audio?.duration_sec
      ?? audio?.target_duration_seconds
      ?? audio?.target_sec,
  );
}

export async function runContractHtmlQa(
  meta: CompositionMeta,
  metaIssues: Issue[],
  contractLoad: JsonLoad,
  sceneMapLoad: JsonLoad,
  compositionDirAbs: string,
  options: { deliveredOpening?: boolean } = {},
): Promise<Record<string, unknown>> {
  const issues: Issue[] = metaIssues.map((issue) => ({
    ...issue,
    source: issue.source || 'orkas-native-contract-html',
  }));
  const contract = contractLoad.value;
  const sceneMap = sceneMapLoad.value;
  const contractSelector = path.basename(contractLoad.path) || 'composition-manifest.json';
  const sceneSelector = path.basename(sceneMapLoad.path) || contractSelector;

  if (!contractLoad.exists) {
    issues.push({
      code: 'DESIGN_CONTRACT_MISSING',
      severity: 'error',
      selector: contractSelector,
      message: 'project/composition/composition-manifest.json is required before drafting model-authored HTML.',
      source: 'orkas-native-contract-html',
    });
  } else if (contractLoad.error || !isRecord(contract)) {
    issues.push({
      code: 'DESIGN_CONTRACT_PARSE_FAILED',
      severity: 'error',
      selector: contractSelector,
      message: `Could not parse ${contractSelector}: ${contractLoad.error || 'not a JSON object'}`,
      source: 'orkas-native-contract-html',
    });
  }
  if (sceneMapLoad.exists && (sceneMapLoad.error || !isRecord(sceneMap))) {
    issues.push({
      code: 'SCENE_MAP_PARSE_FAILED',
      severity: 'error',
      selector: sceneSelector,
      message: `Could not parse ${sceneSelector}: ${sceneMapLoad.error || 'not a JSON object'}`,
      source: 'orkas-native-contract-html',
    });
  }
  issues.push(...await referenceFidelityAssetIssues(
    contract,
    compositionDirAbs,
    contractSelector,
  ));
  if (htmlUsesGsap(meta.html) && !htmlHasLocalGsapVendorScript(meta.html)) {
    issues.push({
      code: 'GSAP_VENDOR_SCRIPT_MISSING',
      severity: 'error',
      selector: 'index.html',
      message: 'index.html uses gsap but does not load ./assets/vendor/gsap.min.js.',
      source: 'orkas-native-contract-html',
    });
  }

  const htmlContainsCopy = htmlCopySearch(meta.html);
  // Frame 0 of the DELIVERED video is its poster; a middle segment of an
  // assembled production has no cover, so its cover family does not run.
  const cover = options.deliveredOpening !== false && isRecord(contract) && isRecord(contract.cover) ? contract.cover : null;
  if (cover) {
    const expectedHeadline = normalizeForSearch(cover.headline);
    if (expectedHeadline && !htmlContainsCopy(expectedHeadline)) {
      issues.push({
        code: 'COVER_HEADLINE_NOT_VISIBLE',
        severity: 'error',
        selector: 'index.html',
        message: 'The approved cover headline is not rendered in the frame-0 composition HTML.',
        fixHint: 'Render the approved cover headline in a visible data-role="title" element at 0s; it may run across consecutive title lines.',
        source: 'ovs-cover-contract',
      });
    }
    const expectedSignals = Array.isArray(cover.content_signals)
      ? cover.content_signals.map((item) => normalizeForSearch(item)).filter(Boolean)
      : [];
    const visibleSignals = new Set(
      [...meta.html.matchAll(/\bdata-cover-signal\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)]
        .map((match) => normalizeForSearch(match[1] ?? match[2] ?? ''))
        .filter(Boolean),
    );
    // A declared signal the frame actually renders as readable copy IS
    // visible, whatever identifier sits in data-cover-signal — requiring the
    // marker verbatim sent repair passes into renaming attributes instead of
    // designing a second signal. A signal that only restates the headline is
    // not a second signal, marked or not.
    const headlineOnlySignals: string[] = [];
    const unmatchedSignals: string[] = [];
    let matchedSignalCount = 0;
    for (const signal of new Set(expectedSignals)) {
      if (expectedHeadline && expectedHeadline.includes(signal)) {
        headlineOnlySignals.push(signal);
        continue;
      }
      if (visibleSignals.has(signal) || htmlContainsCopy(signal)) {
        matchedSignalCount += 1;
        continue;
      }
      unmatchedSignals.push(signal);
    }
    if (expectedSignals.length >= 2 && matchedSignalCount < 2) {
      const detail = [
        unmatchedSignals.length ? `not on the frame: ${unmatchedSignals.slice(0, 4).join(' | ')}` : '',
        headlineOnlySignals.length ? `headline-only (does not count as a second signal): ${headlineOnlySignals.slice(0, 4).join(' | ')}` : '',
      ].filter(Boolean).join('; ');
      issues.push({
        code: 'COVER_CONTENT_SIGNALS_NOT_VISIBLE',
        // Advisory: cover ambition is designed for because it makes the video
        // open well, not because a checker bounces it — the user reviews the
        // cover at the preview.
        severity: 'warning',
        selector: 'index.html',
        message: `Frame-0 renders ${matchedSignalCount} of ${expectedSignals.length} declared cover content signals${detail ? ` — ${detail}` : ''}.`,
        fixHint: 'Put each declared signal on the frame as readable copy, and add data-cover-signal only to an element carrying no readable text of its own. A signal must say something the headline does not.',
        source: 'ovs-cover-contract',
      });
    }
    const coverHero = [...meta.html.matchAll(/<[^>]+\bdata-cover-hero(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?[^>]*>/gi)]
      .some((match) => /\bdata-role\s*=\s*(?:"visual"|'visual'|visual(?:\s|>))/i.test(match[0]));
    if (!coverHero) {
      issues.push({
        code: 'COVER_HERO_NOT_DECLARED',
        severity: 'warning',
        selector: 'index.html',
        message: 'The frame-0 composition has no declared video-scale cover hero.',
        fixHint: 'Mark the dominant topic-specific visual with data-role="visual" and data-cover-hero.',
        source: 'ovs-cover-contract',
      });
    }
  }

  const contractCanvas = jsonCanvas(contract);
  const sceneMapCanvas = jsonCanvas(sceneMap);
  for (const key of ['width', 'height', 'duration'] as const) {
    const tolerance = key === 'duration' ? 0.15 : 1;
    if (contractCanvas[key] && sceneMapCanvas[key] && Math.abs(contractCanvas[key] - sceneMapCanvas[key]) > tolerance) {
      issues.push({
        code: 'CONTRACT_SCENE_MAP_CANVAS_MISMATCH',
        severity: 'error',
        selector: contractSelector,
        message: `design and timeline canvas ${key} values disagree (${contractCanvas[key]} vs ${sceneMapCanvas[key]}).`,
        source: 'orkas-native-contract-html',
      });
    }
  }

  const expected = expectedCanvas(contract, sceneMap);
  const rootCanvas = { width: meta.width, height: meta.height, duration: meta.durationSec };
  for (const key of ['width', 'height', 'duration'] as const) {
    if (!expected[key]) continue;
    const tolerance = key === 'duration' ? 0.15 : 1;
    if (Math.abs(rootCanvas[key] - expected[key]) > tolerance) {
      issues.push({
        code: 'CANVAS_CONTRACT_MISMATCH',
        severity: 'error',
        selector: '[data-composition-id]',
        message: `index.html root ${key}=${rootCanvas[key]} but ${contractSelector} expects ${expected[key]}.`,
        source: 'orkas-native-contract-html',
      });
    }
  }

  const scenes = extractScenes(sceneMap).length ? extractScenes(sceneMap) : extractScenes(contract);
  const duration = expected.duration || meta.durationSec;
  let prevEnd = -1;
  scenes.forEach((scene, index) => {
    const start = sceneStartSec(scene);
    const sceneDuration = sceneDurationSec(scene);
    if (sceneDuration <= 0) {
      issues.push({
        code: 'SCENE_TIMING_INVALID',
        severity: 'error',
        selector: sceneMapLoad.exists ? sceneSelector : contractSelector,
        message: `Scene "${sceneLabel(scene, index)}" needs numeric start plus positive duration or end.`,
        source: 'orkas-native-contract-html',
      });
      return;
    }
    if (start + sceneDuration > duration + 0.15) {
      issues.push({
        code: 'SCENE_TIMING_OUT_OF_RANGE',
        severity: 'error',
        selector: sceneMapLoad.exists ? sceneSelector : contractSelector,
        message: `Scene "${sceneLabel(scene, index)}" ends beyond the composition duration.`,
        source: 'orkas-native-contract-html',
      });
    }
    if (prevEnd >= 0 && start < prevEnd - 0.15) {
      issues.push({
        code: 'SCENE_TIMING_OVERLAP',
        severity: 'error',
        selector: sceneMapLoad.exists ? sceneSelector : contractSelector,
        message: `Scene "${sceneLabel(scene, index)}" starts before the prior scene ends.`,
        source: 'orkas-native-contract-html',
      });
    }
    prevEnd = Math.max(prevEnd, start + sceneDuration);
  });

  const sceneWindows = scenes
    .map((scene, index) => ({
      id: sceneId(scene) || sceneLabel(scene, index),
      start: sceneStartSec(scene),
      duration: sceneDurationSec(scene),
    }))
    .filter((scene) => scene.duration > 0);
  const absolutePositions = authoredAbsoluteTimelinePositions(meta.html, sceneWindows);
  if (absolutePositions.length) {
    const replacements = absolutePositions
      .slice(0, 12)
      .map((p) => `line ${p.line}: tl.${p.method}(..., ${p.seconds}) -> ${p.suggestion}`)
      .join('; ');
    issues.push({
      code: 'AUTHORED_ABSOLUTE_TIMELINE_SECONDS',
      // Advisory: literal positions are only wrong once windows move; they
      // become a real defect the moment a retime shifts data-start.
      severity: 'warning',
      selector: 'index.html',
      message: `${absolutePositions.length} timeline position(s) are absolute seconds. Scene windows move when timing is reconciled (e.g. after narration is measured), and a literal then plays against the wrong scene — ${replacements}.`,
      fixHint: 'Position tweens from the scaffold\'s S("<scene-id>") / D("<scene-id>") helpers (they read each section\'s data-start/data-duration), or use relative string positions.',
      source: 'orkas-native-contract-html',
    });
  }

  for (const [index, scene] of scenes.slice(0, 16).entries()) {
    for (const text of flattenSceneText(scene).slice(0, 5)) {
      const needle = normalizeForSearch(text);
      if (needle && !htmlContainsCopy(needle)) {
        issues.push({
          code: 'HTML_MISSING_SCENE_COPY',
          severity: 'error',
          selector: 'index.html',
          message: `Scene "${sceneLabel(scene, index)}" declares on-screen copy not found in index.html: "${shortText(text, 100)}".`,
          source: 'orkas-native-contract-html',
        });
      }
    }
  }

  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  return {
    ok: errorCount === 0,
    error_count: errorCount,
    warning_count: issues.filter((issue) => issue.severity === 'warning').length,
    issue_count: issues.length,
    contract_path: contractLoad.path,
    scene_map_path: sceneMapLoad.path,
    issues,
  };
}

export async function runSourceAlignmentQa(sceneMapLoad: JsonLoad, shotlistLoad: JsonLoad): Promise<Record<string, unknown>> {
  const issues: Issue[] = [];
  const timelineSelector = path.basename(sceneMapLoad.path) || 'composition-manifest.json';
  const scenes = extractScenes(sceneMapLoad.value);
  const shots = extractShotlistShots(shotlistLoad.value);
  if (!shotlistLoad.exists) {
    return { ok: true, skipped: true, reason: 'shotlist_missing', issues };
  }
  if (shotlistLoad.error) {
    issues.push({
      code: 'SHOTLIST_PARSE_FAILED',
      severity: 'error',
      selector: 'shotlist.json',
      message: `Could not parse shotlist.json: ${shotlistLoad.error}`,
      source: 'orkas-native-source-alignment',
    });
  } else if (!isLegacyShotlist(shotlistLoad.value)) {
    // Activation needs the artifact's own shape — a bare shot array, or an
    // object carrying `shots`. A stray `{scenes:[...]}` scratch file parked
    // under the shotlist name must not wake this layer and judge the
    // production against a contract nobody signed.
    return { ok: true, skipped: true, reason: 'no_legacy_shotlist', issues };
  }
  if (!sceneMapLoad.exists || sceneMapLoad.error || !scenes.length) {
    issues.push({
      code: 'SCENE_MAP_REQUIRED_FOR_SOURCE_ALIGNMENT',
      severity: 'error',
      selector: timelineSelector,
      message: `shotlist.json exists, but ${timelineSelector} has no scenes to map approved beats.`,
      source: 'orkas-native-source-alignment',
    });
  }
  const alignment = isRecord(sceneMapLoad.value) && isRecord(sceneMapLoad.value.source_alignment)
    ? sceneMapLoad.value.source_alignment
    : {};
  const mergeReason = typeof alignment.merge_reason === 'string' && alignment.merge_reason.trim();
  const referenceIndex = approvedShotReferenceIndex(shotlistLoad.value);
  const mappedShotIds = new Set<string>();
  const mappedSourceRefs = new Set<string>();
  const resolvedAliases = new Map<string, string>();
  const unknownShotRefs = new Set<string>();
  const ambiguousShotRefs = new Map<string, string[]>();
  for (const scene of scenes) {
    const refs = Array.isArray(scene.source_shots) ? scene.source_shots : [];
    refs.forEach((ref) => {
      const sourceRef = String(ref).trim();
      if (!sourceRef) return;
      mappedSourceRefs.add(sourceRef);
      const resolution = resolveApprovedShotReference(sourceRef, referenceIndex);
      if (resolution.status === 'direct') mappedShotIds.add(resolution.shotId);
      if (resolution.status === 'alias') {
        mappedShotIds.add(resolution.shotId);
        resolvedAliases.set(sourceRef, resolution.shotId);
      }
      if (resolution.status === 'unknown' && referenceIndex.shotIds.size > 0) {
        unknownShotRefs.add(sourceRef);
      }
      if (resolution.status === 'ambiguous') {
        ambiguousShotRefs.set(sourceRef, resolution.owners);
      }
    });
  }
  const shotIds = referenceIndex.shotIds;
  if (shotIds.size > 0 && mappedSourceRefs.size === 0) {
    issues.push({
      code: 'SOURCE_SHOT_MAPPING_EMPTY',
      severity: 'error',
      selector: timelineSelector,
      message: 'The approved shotlist has shot ids, but every manifest scene has an empty source_shots mapping.',
      source: 'ovs-source-alignment',
    });
  }
  if (unknownShotRefs.size) {
    issues.push({
      code: 'SOURCE_SHOT_REFERENCE_UNKNOWN',
      severity: 'error',
      selector: timelineSelector,
      message: `Manifest source_shots reference neither an approved shot id nor a uniquely owned source alias: ${[...unknownShotRefs].slice(0, 8).join(', ')}.`,
      source: 'ovs-source-alignment',
    });
  }
  if (ambiguousShotRefs.size) {
    issues.push({
      code: 'SOURCE_SHOT_REFERENCE_AMBIGUOUS',
      severity: 'error',
      selector: timelineSelector,
      message: `Manifest source_shots contain aliases owned by multiple approved shots: ${[...ambiguousShotRefs]
        .slice(0, 8)
        .map(([alias, owners]) => `${alias} -> ${owners.join('|')}`)
        .join(', ')}.`,
      source: 'ovs-source-alignment',
    });
  }
  if (shots.length > scenes.length && !mergeReason && mappedShotIds.size < shots.length) {
    issues.push({
      code: 'SHOTLIST_SCENE_MAP_MISMATCH',
      severity: 'error',
      selector: timelineSelector,
      message: `shotlist has ${shots.length} shots but ${timelineSelector} has ${scenes.length} scenes. Add source_alignment.merge_reason or per-scene source_shots when intentionally merging beats.`,
      source: 'orkas-native-source-alignment',
    });
  }
  const missingShotIds = [...shotIds].filter((id) => !mappedShotIds.has(id));
  if (missingShotIds.length > 0 && !mergeReason) {
    issues.push({
      code: 'SOURCE_SHOT_COVERAGE_INCOMPLETE',
      severity: 'error',
      selector: timelineSelector,
      message: `Approved shot ids are not represented by source_shots: ${missingShotIds.slice(0, 8).join(', ')}. Map them or declare source_alignment.merge_reason.`,
      source: 'ovs-source-alignment',
    });
  }
  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  return {
    ok: errorCount === 0,
    skipped: false,
    shot_count: shots.length,
    scene_count: scenes.length,
    mapped_source_ref_count: mappedSourceRefs.size,
    mapped_source_shot_count: mappedShotIds.size,
    resolved_source_alias_count: resolvedAliases.size,
    resolved_source_aliases: Object.fromEntries(resolvedAliases),
    error_count: errorCount,
    issue_count: issues.length,
    issues,
  };
}

export async function runAudioTimingQa(
  meta: CompositionMeta,
  contractLoad: JsonLoad,
  sceneMapLoad: JsonLoad,
  narrationMapLoad: JsonLoad,
  compositionDirAbs: string,
): Promise<Record<string, unknown>> {
  const issues: Issue[] = [];
  const contract = contractLoad.value;
  const sceneMap = sceneMapLoad.value;
  const contractSelector = path.basename(contractLoad.path) || 'composition-manifest.json';
  const sceneSelector = path.basename(sceneMapLoad.path) || contractSelector;
  const ownsNarration = compositionOwnsNarration(contract, sceneMap);
  const scenes = extractScenes(sceneMapLoad.value);
  const narrationRequired = scenes.some((scene) => !!sceneNarrationText(scene))
    && !compositionUsesExternalNarration(contract, sceneMap);
  const narrationPath = narrationPathFromSources(contract, sceneMap);
  const narrationAbsPath = narrationPath ? resolveCompositionLocalPath(compositionDirAbs, narrationPath) : null;
  const narrationFileExists = narrationAbsPath ? !!(await fs.stat(narrationAbsPath).catch(() => null)) : false;

  if (narrationPath && !narrationFileExists) {
    issues.push({
      code: 'NARRATION_ASSET_MISSING',
      severity: 'error',
      selector: narrationPath,
      message: `Narration audio is declared but the file does not exist: ${narrationPath}.`,
      source: 'orkas-native-audio-timing',
    });
  }
  if (!narrationRequired && ownsNarration && (!meta.audioTracks.length || !narrationFileExists)) {
    issues.push({
      code: 'NARRATION_DECLARED_BUT_SILENT',
      severity: 'error',
      selector: meta.audioTracks.length ? narrationPath || contractSelector : 'index.html',
      message: `${contractSelector} declares composition-owned narration, but the composition has no usable narration audio track.`,
      source: 'orkas-native-audio-timing',
    });
  }
  if (narrationRequired && (!ownsNarration || !meta.audioTracks.length || !narrationFileExists)) {
    issues.push({
      code: 'NARRATION_REQUIRED_BUT_NOT_MATERIALIZED',
      severity: 'error',
      selector: ownsNarration ? narrationPath || contractSelector : contractSelector,
      message: 'The manifest contains standalone narration text, but its narration audio is not ready. Run `ovs speak`, declare the composition-owned narration track, and run `ovs composition reconcile` before snapshot, draft, or export.',
      source: 'orkas-native-audio-timing',
    });
  }
  if ((ownsNarration || meta.audioTracks.length > 0) && !sceneMapLoad.exists) {
    issues.push({
      code: 'SCENE_MAP_REQUIRED_FOR_AUDIO_TIMING',
      severity: 'error',
      selector: sceneSelector,
      message: `Narrated compositions require scenes in ${sceneSelector} so voiceover-to-visual alignment is auditable.`,
      source: 'orkas-native-audio-timing',
    });
  }
  if (sceneMapLoad.exists && sceneMapLoad.error) {
    issues.push({
      code: 'SCENE_MAP_PARSE_FAILED',
      severity: 'error',
      selector: sceneSelector,
      message: `Could not parse ${sceneSelector}: ${sceneMapLoad.error}`,
      source: 'orkas-native-audio-timing',
    });
  }
  if (narrationMapLoad.exists && narrationMapLoad.error) {
    issues.push({
      code: 'NARRATION_MAP_PARSE_FAILED',
      severity: 'error',
      selector: 'narration-map.json',
      message: `Could not parse narration-map.json: ${narrationMapLoad.error}`,
      source: 'orkas-native-audio-timing',
    });
  }
  if (ownsNarration && scenes.length) {
    const missing = scenes.filter((scene) => {
      if (sceneNarrationText(scene)) return false;
      if (sceneNarrationRefs(scene).length) return false;
      if (sceneSourceShots(scene).length) return false;
      return true;
    });
    if (missing.length) {
      issues.push({
        code: 'SCENE_NARRATION_MAPPING_MISSING',
        severity: 'error',
        selector: sceneSelector,
        message: `${missing.length} scene(s) have no narration, narration_ref, or source_shots mapping.`,
        source: 'orkas-native-audio-timing',
      });
    }
  }

  const narrationLines = extractNarrationLines(narrationMapLoad.value);
  const narrationLineByKey = narrationLineKeyIndex(narrationLines);
  const refScenes = scenes.filter((scene) => sceneNarrationRefs(scene).length);
  if (refScenes.length && narrationLines.length) {
    for (const scene of refScenes) {
      const refs = sceneNarrationRefs(scene);
      const { lines, missingRefs } = narrationLinesForScene(scene, refs, narrationLines, narrationLineByKey);
      if (missingRefs.length) {
        issues.push({
          code: 'NARRATION_REF_MISSING',
          severity: 'error',
          selector: sceneSelector,
          message: `Scene "${sceneLabel(scene, scenes.indexOf(scene))}" references narration line(s) not found in narration-map.json: ${missingRefs.join(', ')}.`,
          source: 'orkas-native-audio-timing',
        });
        continue;
      }
      if (!lines.length) continue;
      const expectedStart = Math.min(...lines.map((line) => line.start));
      const expectedEnd = Math.max(...lines.map(narrationLineEnd));
      const actualStart = sceneStartSec(scene);
      const actualEnd = sceneEndSec(scene);
      const startDrift = actualStart - expectedStart;
      if (Math.abs(startDrift) > 1.25) {
        issues.push({
          code: 'NARRATION_LINE_START_DRIFT',
          severity: 'error',
          selector: sceneSelector,
          message: `Scene "${sceneLabel(scene, scenes.indexOf(scene))}" starts at ${round2(actualStart)}s but narration-map starts at ${round2(expectedStart)}s (${round2(startDrift)}s drift).`,
          source: 'orkas-native-audio-timing',
        });
      }
      if (expectedEnd > actualEnd + 1.25) {
        issues.push({
          code: 'NARRATION_LINE_OVERFLOWS_SCENE',
          severity: 'error',
          selector: sceneSelector,
          message: `Scene "${sceneLabel(scene, scenes.indexOf(scene))}" ends at ${round2(actualEnd)}s but referenced narration line(s) run until ${round2(expectedEnd)}s.`,
          source: 'orkas-native-audio-timing',
        });
      }
    }
  } else if (refScenes.length && !narrationLines.length) {
    const refScenesWithoutInlineTiming = refScenes.filter((scene) => !sceneNarrationText(scene) || sceneDurationSec(scene) <= 0);
    issues.push({
      code: 'NARRATION_MAP_MISSING',
      severity: refScenesWithoutInlineTiming.length ? 'error' : 'warning',
      selector: 'narration-map.json',
      message: refScenesWithoutInlineTiming.length
        ? 'Scenes use narration_ref but narration-map.json has no lines and not every referenced scene has inline narration text with a numeric time window. Add project/composition/narration-map.json or inline per-scene narration text and timing before Gate D.'
        : 'Scenes use narration_ref but narration-map.json has no lines, so draft QA falls back to coarse inline narration timing checks.',
      source: 'orkas-native-audio-timing',
    });
  }

  const mappedScenes = scenes.filter((scene) => sceneNarrationText(scene) || sceneNarrationRefs(scene).length || sceneSourceShots(scene).length);
  const narratedScenes = scenes.filter((scene) => sceneNarrationText(scene));
  const targetDuration = audioTargetDuration(contract, sceneMap);
  if (!narrationLines.length && narratedScenes.length >= 2 && targetDuration > 0) {
      const totalChars = narratedScenes.reduce((sum, scene) => sum + sceneNarrationText(scene).length, 0);
    let cursorChars = 0;
    for (const scene of narratedScenes) {
      const expectedStart = totalChars > 0 ? (cursorChars / totalChars) * targetDuration : 0;
      const actualStart = sceneStartSec(scene);
      const drift = actualStart - expectedStart;
      if (Math.abs(drift) > 3.5) {
        issues.push({
          code: 'AUDIO_TIMING_DRIFT',
          severity: 'error',
          selector: sceneSelector,
          message: `Scene "${sceneLabel(scene, scenes.indexOf(scene))}" starts at ${round2(actualStart)}s but estimated narration timing is ${round2(expectedStart)}s (${round2(drift)}s drift).`,
          source: 'orkas-native-audio-timing',
        });
      }
      cursorChars += sceneNarrationText(scene).length;
    }
  } else if (!narrationLines.length && mappedScenes.length >= 2 && narratedScenes.length < 2) {
    issues.push({
      code: 'AUDIO_TIMING_ESTIMATE_SKIPPED',
      severity: 'warning',
      selector: sceneSelector,
      message: 'Scenes use narration references or source_shots without inline narration text, so draft QA can verify mapping presence but cannot estimate timing drift.',
      source: 'orkas-native-audio-timing',
    });
  }

  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  return {
    ok: errorCount === 0,
    skipped: !narrationRequired && !ownsNarration && meta.audioTracks.length === 0,
    narration_required: narrationRequired,
    narration_path: narrationPath,
    narration_file_exists: narrationFileExists,
    narration_map_path: narrationMapLoad.path,
    narration_line_count: narrationLines.length,
    scene_count: scenes.length,
    audio_track_count: meta.audioTracks.length,
    error_count: errorCount,
    warning_count: issues.filter((issue) => issue.severity === 'warning').length,
    issue_count: issues.length,
    issues,
  };
}

function draftRepairStatePath(compositionDirAbs: string): string {
  return path.join(compositionDirAbs, 'qa', 'draft-repair-state.json');
}

async function draftContentSignature(compositionDirAbs: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  for (const name of ['composition-manifest.json', 'design-contract.json', 'scene-map.json', 'narration-map.json', 'index.html']) {
    const abs = path.join(compositionDirAbs, name);
    const st = await fs.stat(abs).catch(() => null);
    if (!st || !st.isFile()) continue;
    hash.update(name);
    hash.update('\0');
    hash.update(await fs.readFile(abs));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function normalizeRepairState(raw: unknown): DraftRepairState {
  const r = isRecord(raw) ? raw : {};
  const failedAttempts = Math.max(0, Number(r.failed_attempts) || 0);
  return {
    status: r.status === 'failed' ? 'failed' : 'ok',
    failed_attempts: failedAttempts,
    repair_passes_used: Math.max(0, failedAttempts - 1),
    max_repair_passes: DRAFT_REPAIR_MAX_PASSES,
    last_error: isRecord(r.last_error) ? r.last_error : null,
    history: Array.isArray(r.history) ? r.history.filter(isRecord).slice(-12) : [],
    last_success: isRecord(r.last_success) ? r.last_success : undefined,
  };
}

function repairBudgetSummary(statePath: string, state: DraftRepairState): DraftRepairSummary {
  const failedAttempts = Math.max(0, Number(state.failed_attempts) || 0);
  const used = Math.max(0, failedAttempts - 1);
  const budgetExhausted = failedAttempts > 0 && used >= DRAFT_REPAIR_MAX_PASSES;
  return {
    ok: !budgetExhausted,
    budget_exhausted: budgetExhausted,
    state_path: statePath,
    max_repair_passes: DRAFT_REPAIR_MAX_PASSES,
    failed_attempts: failedAttempts,
    repair_passes_used: used,
    repair_passes_remaining: Math.max(0, DRAFT_REPAIR_MAX_PASSES - used),
    last_error: state.last_error,
  };
}

export async function initDraftRepairBudget(compositionDirAbs: string): Promise<DraftRepairBudget> {
  const statePath = draftRepairStatePath(compositionDirAbs);
  const raw = await readJsonIfExists(statePath);
  let state = normalizeRepairState(raw.value);
  // The budget blocks repeated failures of the same authored inputs. Once the
  // composition changes, the last failures are stale and a fresh bounded cycle
  // is persisted so the next failure counts from disk correctly.
  if (state.status === 'failed' && isRecord(state.last_error)) {
    const recordedSignature = typeof state.last_error.content_signature === 'string'
      ? state.last_error.content_signature
      : '';
    if (recordedSignature && recordedSignature !== await draftContentSignature(compositionDirAbs)) {
      state = normalizeRepairState({ status: 'ok', failed_attempts: 0, history: state.history });
      await writeRepairState(statePath, state);
    }
  }
  const summary = repairBudgetSummary(statePath, state);
  return {
    compositionDirAbs,
    statePath,
    state,
    summary,
    blocked: state.status === 'failed' && summary.budget_exhausted,
  };
}

async function writeRepairState(statePath: string, state: DraftRepairState): Promise<void> {
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf8');
}

export async function recordDraftFailure(
  repairBudget: DraftRepairBudget,
  reportAbsPath: string | undefined,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
): Promise<DraftRepairSummary> {
  const raw = await readJsonIfExists(repairBudget.statePath);
  const previous = normalizeRepairState(raw.value || repairBudget.state);
  const failedAttempts = previous.failed_attempts + 1;
  const entry = {
    ts: new Date().toISOString(),
    code,
    message: shortText(message, 300),
    report_path: reportAbsPath || '',
    repair_target: shortText(extra.repair_target || '', 120),
    content_signature: await draftContentSignature(repairBudget.compositionDirAbs),
  };
  const next: DraftRepairState = {
    status: 'failed',
    failed_attempts: failedAttempts,
    repair_passes_used: Math.max(0, failedAttempts - 1),
    max_repair_passes: DRAFT_REPAIR_MAX_PASSES,
    last_error: entry,
    history: [...previous.history, entry].slice(-12),
  };
  await writeRepairState(repairBudget.statePath, next);
  repairBudget.state = next;
  repairBudget.summary = repairBudgetSummary(repairBudget.statePath, next);
  repairBudget.blocked = repairBudget.summary.budget_exhausted;
  return repairBudget.summary;
}

export async function recordDraftSuccess(
  repairBudget: DraftRepairBudget,
  reportAbsPath: string | undefined,
  renderPath: string | undefined,
): Promise<DraftRepairSummary> {
  const raw = await readJsonIfExists(repairBudget.statePath);
  const previous = normalizeRepairState(raw.value || repairBudget.state);
  const next: DraftRepairState = {
    status: 'ok',
    failed_attempts: 0,
    repair_passes_used: 0,
    max_repair_passes: DRAFT_REPAIR_MAX_PASSES,
    last_error: null,
    history: previous.history,
    last_success: {
      ts: new Date().toISOString(),
      report_path: reportAbsPath || '',
      path: renderPath || '',
      content_signature: await draftContentSignature(repairBudget.compositionDirAbs),
    },
  };
  await writeRepairState(repairBudget.statePath, next);
  repairBudget.state = next;
  repairBudget.summary = repairBudgetSummary(repairBudget.statePath, next);
  repairBudget.blocked = false;
  return repairBudget.summary;
}

export function samplePlanKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'sample';
}

export function buildDraftFrameSamplePlan(meta: CompositionMeta, sceneMap: unknown, fps: number): FrameSamplePlan[] {
  const duration = Math.max(0.1, meta.durationSec);
  const raw: Array<{ label: string; timeSec: number }> = [
    { label: 'first-frame', timeSec: 0 },
    { label: 'quarter', timeSec: duration * 0.25 },
    { label: 'midpoint', timeSec: duration * 0.5 },
    { label: 'three-quarter', timeSec: duration * 0.75 },
    { label: 'payoff-frame', timeSec: Math.max(0, duration - 0.05) },
  ];
  extractScenes(sceneMap).slice(0, 8).forEach((scene, index) => {
    const start = Math.max(0, numberFrom(scene.start ?? scene.start_sec));
    const sceneDuration = Math.max(0, numberFrom(scene.duration ?? scene.duration_sec));
    raw.push({ label: `${sceneLabel(scene, index)}-start`, timeSec: start });
    if (sceneDuration > 0.2) raw.push({ label: `${sceneLabel(scene, index)}-mid`, timeSec: start + sceneDuration / 2 });
  });

  const totalFrames = Math.max(1, Math.ceil(duration * fps));
  const seen = new Set<number>();
  const out: FrameSamplePlan[] = [];
  for (const item of raw) {
    const t = Math.max(0, Math.min(duration - 0.001, item.timeSec));
    const frameIndex = Math.max(0, Math.min(totalFrames - 1, Math.floor(t * fps)));
    if (seen.has(frameIndex)) continue;
    seen.add(frameIndex);
    out.push({ label: samplePlanKey(item.label), timeSec: round2(frameIndex / fps), frameIndex });
    if (out.length >= 14) break;
  }
  return out;
}

/**
 * Semantic frames worth capturing from the *HTML* preview, before any mp4 exists.
 *
 * Narrower than the post-render plan: every capture costs a real browser seek,
 * and the sheet is for a human/agent design read, not statistical QA. Hook and
 * payoff always survive; scene midpoints carry the story between them.
 */
export function buildPreviewSamplePlan(meta: CompositionMeta, sceneMap: unknown, maxFrames = PREVIEW_MAX_FRAMES): PreviewSample[] {
  const duration = Math.max(0.1, meta.durationSec);
  const scenes = extractScenes(sceneMap);
  const raw: PreviewSample[] = [{ label: 'hook-frame', timeSec: 0 }];
  scenes.forEach((scene, index) => {
    const start = Math.max(0, numberFrom(scene.start ?? scene.start_sec));
    const sceneDuration = Math.max(0, numberFrom(scene.duration ?? scene.duration_sec));
    // A scene's midpoint reads its resolved state; its start is usually mid-entrance.
    raw.push({ label: `${sceneLabel(scene, index)}-mid`, timeSec: sceneDuration > 0.2 ? start + sceneDuration / 2 : start });
  });
  if (!scenes.length) raw.push({ label: 'midpoint', timeSec: duration * 0.5 });
  raw.push({ label: 'payoff-frame', timeSec: Math.max(0, duration - 0.05) });

  // Rounding has to happen before the clamp: hyperframes seeks to one-decimal
  // seconds, and rounding a time that sits just inside the end (duration - 0.05)
  // pushes it back onto the boundary, where the capture is past the last frame.
  const lastSeekable = Math.max(0, floor1(duration - 0.05));
  const out: PreviewSample[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const t = Math.max(0, Math.min(round1(item.timeSec), lastSeekable));
    // hyperframes names files by one-decimal seconds; collapsing here keeps our
    // plan 1:1 with the files it writes.
    const key = t.toFixed(1);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label: samplePlanKey(item.label), timeSec: t });
  }
  if (out.length <= maxFrames) return out;
  // Over budget: keep hook + payoff, thin the middle evenly.
  const first = out[0];
  const last = out[out.length - 1];
  const middle = out.slice(1, -1);
  const keep = Math.max(0, maxFrames - 2);
  const step = middle.length / keep;
  const thinned = Array.from({ length: keep }, (_, i) => middle[Math.floor(i * step)]).filter(Boolean);
  return [first, ...thinned, last];
}

/**
 * Map the PNGs `hyperframes snapshot --at t1,t2,...` wrote back onto the plan.
 *
 * It names them `frame-<NN>-at-<T>s.png`, ordered by the requested timestamps,
 * so the index prefix — not mtime, and not the rounded time in the name — is the
 * reliable join key. Stale files from a longer previous run share the directory,
 * hence the strict `index < plan.length` bound.
 */
export function matchPreviewFrames(plan: PreviewSample[], fileNames: string[]): Array<{ label: string; time_seconds: number; file: string }> {
  const byIndex = new Map<number, string>();
  for (const name of fileNames) {
    const m = /^frame-(\d+)-at-[\d.]+s\.png$/i.exec(name);
    if (!m) continue;
    const index = Number(m[1]);
    if (!Number.isInteger(index) || index < 0 || index >= plan.length) continue;
    if (!byIndex.has(index)) byIndex.set(index, name);
  }
  return plan
    .map((sample, index) => {
      const file = byIndex.get(index);
      return file ? { label: sample.label, time_seconds: sample.timeSec, file } : null;
    })
    .filter((entry): entry is { label: string; time_seconds: number; file: string } => !!entry);
}

export function analyzeNativeImage(image: { getSize(): { width: number; height: number }; toBitmap(): Buffer | Uint8Array }): { hash: string; brightness: number; contrast: number; width: number; height: number } {
  const size = image.getSize();
  const bitmap = image.toBitmap();
  const pixelCount = Math.max(1, size.width * size.height);
  const stride = Math.max(1, Math.floor(bitmap.length / pixelCount));
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < bitmap.length; i += stride) {
    const r = bitmap[i] ?? 0;
    const g = bitmap[i + 1] ?? r;
    const b = bitmap[i + 2] ?? r;
    const y = (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
    sum += y;
    sumSq += y * y;
  }
  const mean = sum / pixelCount;
  const variance = Math.max(0, (sumSq / pixelCount) - mean * mean);
  return {
    hash: crypto.createHash('sha256').update(bitmap).digest('hex'),
    brightness: round2(mean),
    contrast: round2(Math.sqrt(variance)),
    width: size.width,
    height: size.height,
  };
}

export async function writeFrameContactSheet(evidenceDirAbs: string, samples: FrameSampleEvidence[]): Promise<string> {
  const thumbW = 320;
  const thumbH = 180;
  const gap = 16;
  const cols = Math.min(3, Math.max(1, samples.length));
  const rows = Math.max(1, Math.ceil(samples.length / cols));
  const width = cols * thumbW + (cols + 1) * gap;
  const height = rows * (thumbH + 36) + (rows + 1) * gap;
  const items = samples.map((sample, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = gap + col * (thumbW + gap);
    const y = gap + row * (thumbH + 36 + gap);
    const href = path.basename(sample.path).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const label = `${sample.label} @ ${sample.time_seconds}s`.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    return `<image href="${href}" x="${x}" y="${y}" width="${thumbW}" height="${thumbH}" preserveAspectRatio="xMidYMid meet"/><text x="${x}" y="${y + thumbH + 24}" fill="#111" font-family="system-ui, sans-serif" font-size="16">${label}</text>`;
  }).join('\n');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fff"/>\n${items}\n</svg>\n`;
  const out = path.join(evidenceDirAbs, 'contact-sheet.svg');
  await fs.writeFile(out, svg, 'utf8');
  return out;
}

/** A sampled frame below this contrast is treated as blank. Exported so any
 *  capture-retry path re-shoots exactly the frames this check would reject —
 *  two thresholds drift, and the host retries frames QA accepts while
 *  shipping ones it does not. */
export const BLANK_FRAME_MAX_CONTRAST = 1.5;

export function summarizeVideoFrameQa(
  frameEvidence: FrameEvidence | null,
  _durationSec: number,
  options: { deliveredOpening?: boolean } = {},
): Record<string, unknown> {
  const issues: Issue[] = [];
  const samples = frameEvidence?.samples || [];
  if (!samples.length) {
    issues.push({
      code: 'VIDEO_SAMPLE_FRAMES_MISSING',
      severity: 'error',
      message: 'No sampled evidence frames were captured for draft video QA.',
      source: 'orkas-native-video-qa',
    });
  }
  for (const sample of samples) {
    if (sample.brightness < 4 || sample.brightness > 251 || sample.contrast < BLANK_FRAME_MAX_CONTRAST) {
      // A blank first frame on a non-opening segment is still an error — it is
      // a visible gap at the cut — but it is not a HOOK failure: the hook
      // belongs to the delivered opening.
      const isHook = sample.label === 'first-frame' && options.deliveredOpening !== false;
      issues.push({
        code: isHook ? 'EMPTY_HOOK_FRAME' : 'BLANK_SAMPLE_FRAME',
        severity: 'error',
        message: `Sample "${sample.label}" at ${sample.time_seconds}s appears blank or nearly flat (brightness=${sample.brightness}, contrast=${sample.contrast}).`,
        source: 'orkas-native-video-qa',
      });
    }
  }
  // No frozen-run detection: identical sampled hashes on an intentionally
  // static composition are noise, and stillness the user would object to is
  // visible on the contact sheet they review at the preview.
  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  return {
    ok: errorCount === 0,
    issue_count: issues.length,
    error_count: errorCount,
    warning_count: issues.filter((issue) => issue.severity === 'warning').length,
    evidence_dir: frameEvidence?.evidence_dir || '',
    contact_sheet: frameEvidence?.contact_sheet || '',
    frame_paths: frameEvidence?.frame_paths || [],
    samples,
    issues,
  };
}
