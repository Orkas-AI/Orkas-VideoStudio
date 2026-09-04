/**
 * Provider-aware half of plan validation. `validateEdl` enforces the
 * provider-neutral plan contract (six ratios, 4–15 s, generate | edit); the
 * configured BYO video provider may accept only a subset of it (MuAPI's Kling
 * endpoints: 16:9 / 9:16 / 1:1, 5 or 10 s, generate only). Without this check
 * a plan can be approved at Gate C and then fail on every billable segment at
 * generation time. Shared by `ovs plan validate` and the MCP plan_validate tool.
 */

import { loadConfig, validateEdl } from '@orkas/video-studio-core';
import type { EdlIssue, EdlValidation, OvsConfig } from '@orkas/video-studio-core';
import { videoProviderLimits, type VideoProviderLimits } from './video/video.js';

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function acceptsDuration(limits: VideoProviderLimits['durations'], seconds: number): boolean {
  return 'allowed' in limits ? limits.allowed.includes(seconds) : seconds >= limits.min && seconds <= limits.max;
}

function describeDurations(limits: VideoProviderLimits['durations']): string {
  return 'allowed' in limits ? `${limits.allowed.join(' or ')} seconds` : `${limits.min}-${limits.max} seconds`;
}

/**
 * Error issues for every generate VIDEO segment whose ratio, duration, or
 * operation the configured video provider (default doubao) would reject.
 * Image generation and plans without video generation are never affected, so
 * a compose-only project does not need a video provider configured at all.
 */
export function checkPlanVideoProvider(plan: unknown, config: OvsConfig = loadConfig()): EdlIssue[] {
  if (!isObject(plan) || !Array.isArray(plan.segments)) return [];
  const targets = plan.segments
    .map((segment, index) => ({ segment, index }))
    .filter(({ segment }) => isObject(segment) && segment.source === 'generate' && isObject(segment.spec) && segment.spec.media_kind !== 'image');
  if (!targets.length) return [];

  let limits: VideoProviderLimits;
  try {
    limits = videoProviderLimits(config.video);
  } catch (error) {
    return [{ level: 'error', path: '$', code: 'E_VIDEO_PROVIDER', message: (error as Error).message }];
  }

  const issues: EdlIssue[] = [];
  const err = (path: string, message: string) => issues.push({ level: 'error', path, code: 'E_SPEC_GENERATE_PROVIDER', message });
  const fix = 'change the plan or switch video.provider before Gate C';
  for (const { segment, index } of targets) {
    const spec = (segment as Record<string, unknown>).spec as Record<string, unknown>;
    const at = `segments[${index}].spec`;
    if (typeof spec.ratio === 'string' && !limits.ratios.includes(spec.ratio)) {
      err(`${at}.ratio`, `video provider "${limits.provider}" supports ratios ${limits.ratios.join(', ')}, not ${spec.ratio}; ${fix}`);
    }
    const seconds = spec.generation_duration_sec;
    if (typeof seconds === 'number' && Number.isFinite(seconds) && !acceptsDuration(limits.durations, seconds)) {
      err(`${at}.generation_duration_sec`, `video provider "${limits.provider}" supports durations of ${describeDurations(limits.durations)}, not ${seconds}; ${fix}`);
    }
    const operation = spec.operation ?? 'generate';
    if (typeof operation === 'string' && !(limits.operations as readonly string[]).includes(operation)) {
      err(`${at}.operation`, `video provider "${limits.provider}" supports the ${limits.operations.join(' and ')} operation only, not "${operation}"; ${fix}`);
    }
  }
  return issues;
}

/**
 * `validateEdl` plus the configured-provider check. A field the neutral
 * validator already rejected is not reported twice; `ok` is false when either
 * layer rejects the plan.
 */
export function validatePlanWithProvider(plan: unknown, config?: OvsConfig): EdlValidation {
  const base = validateEdl(plan);
  const rejected = new Set(base.errors.map((issue) => issue.path));
  const providerIssues = checkPlanVideoProvider(plan, config).filter((issue) => !rejected.has(issue.path));
  if (!providerIssues.length) return base;
  return { ok: false, errors: [...base.errors, ...providerIssues], warnings: base.warnings };
}
