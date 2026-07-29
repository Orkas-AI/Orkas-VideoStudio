import { createHash } from 'node:crypto';

const RESERVED_METADATA_ENVELOPES = new Set(['_runtime', '_catalog']);

const LEGACY_EXECUTION_FACT_KEYS = new Set([
  'status',
  'produced_path',
  'provider_task_id',
  'generated_at',
  'started_at',
  'updated_at',
  'completed_at',
  'failed_at',
  'error_code',
  'transaction_id',
  'request_id',
  'attempt_number',
  'attempt_count',
  'retry_count',
  'output_sha256',
]);

const VOICE_CATALOG_METADATA_KEYS = new Set([
  'display_name',
  'provider',
  'provider_label',
  'provider_model',
  'model_label',
  'catalog_version',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isStableVoiceSelection(value: Record<string, unknown>): boolean {
  const route = typeof value.route_ref === 'string' ? value.route_ref.trim() : '';
  const voice = typeof value.voice_ref === 'string'
    ? value.voice_ref.trim()
    : typeof value.voice === 'string'
      ? value.voice.trim()
      : '';
  return !!route && !!voice;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (!isRecord(value)) {
    const encoded = JSON.stringify(value);
    return encoded === undefined ? 'null' : encoded;
  }
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${stableJson(value[key])}`
  )).join(',')}}`;
}

export type ApprovalIntentProjectionOptions = {
  /**
   * Artifact-specific implementation fields that do not represent user
   * intent. Only root keys may be excluded this way.
   */
  excludeRootKeys?: Iterable<string>;
};

/**
 * Project a plan or manifest onto stable user intent. Unknown fields remain
 * signed by default; only explicit runtime/catalog metadata is excluded.
 */
export function projectApprovalIntent(
  value: unknown,
  options: ApprovalIntentProjectionOptions = {},
): unknown {
  const excludedRootKeys = new Set(options.excludeRootKeys || []);
  const project = (current: unknown, depth: number): unknown => {
    if (Array.isArray(current)) return current.map((entry) => project(entry, depth + 1));
    if (!isRecord(current)) return current;
    const stableVoiceSelection = isStableVoiceSelection(current);
    const projected: Record<string, unknown> = {};
    for (const key of Object.keys(current).sort()) {
      if (depth === 0 && excludedRootKeys.has(key)) continue;
      if (RESERVED_METADATA_ENVELOPES.has(key)) continue;
      if (LEGACY_EXECUTION_FACT_KEYS.has(key)) continue;
      if (stableVoiceSelection && VOICE_CATALOG_METADATA_KEYS.has(key)) continue;
      projected[key] = project(current[key], depth + 1);
    }
    return projected;
  };
  return project(value, 0);
}

/** Content address for an already validated approval payload. */
export function approvalIntentSignature(
  value: unknown,
  options: ApprovalIntentProjectionOptions = {},
): string {
  return createHash('sha256')
    .update(stableJson(projectApprovalIntent(value, options)))
    .digest('hex');
}
