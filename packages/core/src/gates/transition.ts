export type VideoLine = 'unknown' | 'compose' | 'auto' | 'generate' | 'edit';
export type GateArtifact = 'unknown' | 'composition' | 'production';
export type GateName = 'none' | 'gate_a' | 'gate_b' | 'gate_c' | 'preview' | 'gate_d';
export type GateDecision = 'none' | 'approve' | 'revise';
export type RevisionScope = 'unknown' | 'none' | 'visual_only' | 'gate_b_payload';
export type RecoveryState = 'unknown' | 'available' | 'not_available';
export type RecoveryDecision = 'none' | 'new_visual_revision' | 'pause';
export type ArtifactState = 'unknown' | 'new' | 'unchanged' | 'changed';
export type ApprovalStatus = 'unknown' | 'none' | 'pending' | 'approved';

export interface GateTransitionInput {
  line?: VideoLine;
  artifact?: GateArtifact;
  gate?: GateName;
  decision?: GateDecision;
  scope?: RevisionScope;
  recovery?: RecoveryState;
  recoveryDecision?: RecoveryDecision;
  artifactState?: ArtifactState;
  approvalStatus?: ApprovalStatus;
  errorCode?: string;
}

export interface GateTransitionResult {
  policy_version: 1;
  next_action: string;
  authorities: string[];
  form: { fields: string[] } | null;
  allowed_ops: string[];
  prohibited_ops: string[];
  reason: string;
}

const VALID = {
  line: new Set<VideoLine>(['unknown', 'compose', 'auto', 'generate', 'edit']),
  artifact: new Set<GateArtifact>(['unknown', 'composition', 'production']),
  gate: new Set<GateName>(['none', 'gate_a', 'gate_b', 'gate_c', 'preview', 'gate_d']),
  decision: new Set<GateDecision>(['none', 'approve', 'revise']),
  scope: new Set<RevisionScope>(['unknown', 'none', 'visual_only', 'gate_b_payload']),
  recovery: new Set<RecoveryState>(['unknown', 'available', 'not_available']),
  recoveryDecision: new Set<RecoveryDecision>(['none', 'new_visual_revision', 'pause']),
  artifactState: new Set<ArtifactState>(['unknown', 'new', 'unchanged', 'changed']),
  approvalStatus: new Set<ApprovalStatus>(['unknown', 'none', 'pending', 'approved']),
};

function assertEnum<T extends string>(name: string, value: T, allowed: Set<T>): void {
  if (!allowed.has(value)) throw new Error(`${name} must be one of: ${[...allowed].join(', ')}`);
}

function result(input: {
  nextAction: string;
  authorities?: string[];
  form?: { fields: string[] } | null;
  allowedOps?: string[];
  prohibitedOps?: string[];
  reason: string;
}): GateTransitionResult {
  return {
    policy_version: 1,
    next_action: input.nextAction,
    authorities: input.authorities ?? [],
    form: input.form ?? null,
    allowed_ops: input.allowedOps ?? [],
    prohibited_ops: input.prohibitedOps ?? [],
    reason: input.reason,
  };
}

const NO_VISUAL_RESET = ['reset_visual_qa_cycle'];

function lineOperations(line: VideoLine, artifact: GateArtifact): { status: string; edit: string[] } {
  if (artifact === 'composition' || (artifact === 'unknown' && line === 'compose')) {
    return {
      status: 'inspect_composition_state',
      edit: ['edit_current_artifact', 'ovs check', 'ovs snapshot', 'ovs draft'],
    };
  }
  return {
    status: 'inspect_plan_and_outputs',
    edit: ['edit_current_artifact', 'ovs plan validate', 'ovs plan promise-check'],
  };
}

/**
 * Canonical, host-neutral authorization resolver for every VideoStudio line.
 * It does not infer approval from prose and it never performs an operation; it
 * maps explicit user authority plus durable artifact state to one next action.
 */
export function resolveGateTransition(raw: GateTransitionInput = {}): GateTransitionResult {
  const input = {
    line: raw.line ?? 'unknown',
    artifact: raw.artifact ?? 'unknown',
    gate: raw.gate ?? 'none',
    decision: raw.decision ?? 'none',
    scope: raw.scope ?? 'unknown',
    recovery: raw.recovery ?? 'unknown',
    recoveryDecision: raw.recoveryDecision ?? 'none',
    artifactState: raw.artifactState ?? 'unknown',
    approvalStatus: raw.approvalStatus ?? 'unknown',
    errorCode: raw.errorCode ?? '',
  };
  assertEnum('line', input.line, VALID.line);
  assertEnum('artifact', input.artifact, VALID.artifact);
  assertEnum('gate', input.gate, VALID.gate);
  assertEnum('decision', input.decision, VALID.decision);
  assertEnum('scope', input.scope, VALID.scope);
  assertEnum('recovery', input.recovery, VALID.recovery);
  assertEnum('recoveryDecision', input.recoveryDecision, VALID.recoveryDecision);
  assertEnum('artifactState', input.artifactState, VALID.artifactState);
  assertEnum('approvalStatus', input.approvalStatus, VALID.approvalStatus);
  const lineOps = lineOperations(input.line, input.artifact);

  if (input.errorCode === 'E_VISUAL_REVISION_NOT_REQUIRED') {
    return result({
      nextAction: 'edit_current_cycle',
      authorities: ['edit_current_artifact'],
      allowedOps: lineOps.edit,
      prohibitedOps: ['open_gate', ...NO_VISUAL_RESET],
      reason: 'The current visual QA cycle is not exhausted.',
    });
  }

  if (input.errorCode === 'E_VISUAL_REVISION_EXPLICIT_AUTHORIZATION_REQUIRED') {
    if (input.recovery === 'available') {
      return result({
        nextAction: 'open_visual_recovery',
        form: { fields: ['visual_recovery_decision'] },
        prohibitedOps: ['edit_files', ...NO_VISUAL_RESET],
        reason: 'The latest deterministic QA result independently established recovery availability.',
      });
    }
    if (input.recovery === 'unknown') {
      return result({
        nextAction: 'query_status',
        allowedOps: [lineOps.status],
        prohibitedOps: ['open_gate', 'edit_files', ...NO_VISUAL_RESET],
        reason: 'An authorization error alone cannot establish recovery availability.',
      });
    }
  }

  if (input.recoveryDecision === 'pause') {
    return result({ nextAction: 'pause', reason: 'The user paused visual recovery.' });
  }

  if (input.recoveryDecision === 'new_visual_revision') {
    if (input.recovery === 'available') {
      return result({
        nextAction: 'begin_visual_revision',
        authorities: ['reset_visual_qa_cycle'],
        allowedOps: ['reset_visual_qa_cycle'],
        reason: 'The current user authorized the reset offered by deterministic QA.',
      });
    }
    if (input.recovery === 'unknown') {
      return result({
        nextAction: 'query_status',
        allowedOps: [lineOps.status],
        prohibitedOps: ['open_gate', 'edit_files', ...NO_VISUAL_RESET],
        reason: 'Recovery cannot be consumed until availability is verified.',
      });
    }
    return result({
      nextAction: 'edit_current_cycle',
      authorities: ['edit_current_artifact'],
      allowedOps: lineOps.edit,
      prohibitedOps: ['open_gate', ...NO_VISUAL_RESET],
      reason: 'The cycle is not exhausted, so ordinary editing continues without a reset.',
    });
  }

  if (input.decision !== 'revise' && input.approvalStatus === 'approved' && input.artifactState === 'unchanged') {
    return result({
      nextAction: 'continue_from_existing_approval',
      authorities: ['consume_existing_approval'],
      prohibitedOps: ['open_gate'],
      reason: 'The same artifact is already approved; do not ask again.',
    });
  }

  if (input.decision === 'revise') {
    if (input.scope === 'unknown') {
      return result({
        nextAction: 'classify_revision_scope',
        authorities: ['inspect_requested_change'],
        prohibitedOps: ['open_gate', ...NO_VISUAL_RESET],
        reason: 'Revise grants edit intent, but signed-plan impact must be classified first.',
      });
    }
    if (input.scope === 'gate_b_payload') {
      if (input.recovery === 'unknown') {
        return result({
          nextAction: 'query_status',
          authorities: ['edit_current_artifact'],
          allowedOps: [lineOps.status],
          prohibitedOps: ['open_gate', 'edit_files', ...NO_VISUAL_RESET],
          reason: 'Resolve recovery state before choosing one amendment or combined gate.',
        });
      }
      if (input.recovery === 'available') {
        return result({
          nextAction: 'open_combined_amendment_and_recovery',
          authorities: ['edit_current_artifact'],
          form: { fields: ['gate_b_decision', 'visual_recovery_decision'] },
          prohibitedOps: ['edit_files', ...NO_VISUAL_RESET],
          reason: 'The signed plan needs one amendment and the exhausted QA cycle needs one reset.',
        });
      }
      return result({
        nextAction: 'open_gate_b_amendment',
        authorities: ['edit_current_artifact'],
        form: { fields: ['gate_b_decision'] },
        prohibitedOps: NO_VISUAL_RESET,
        reason: 'The requested revision changes the signed Gate B payload.',
      });
    }
    if (input.recovery === 'available') {
      return result({
        nextAction: 'open_visual_recovery',
        authorities: ['edit_current_artifact'],
        form: { fields: ['visual_recovery_decision'] },
        prohibitedOps: ['edit_files', ...NO_VISUAL_RESET],
        reason: 'Edit intent exists, but the exhausted QA cycle must be reset first.',
      });
    }
    if (input.recovery === 'unknown') {
      return result({
        nextAction: 'query_status',
        authorities: ['edit_current_artifact'],
        allowedOps: [lineOps.status],
        prohibitedOps: ['open_gate', ...NO_VISUAL_RESET],
        reason: 'Resolve recovery state before editing or asking another question.',
      });
    }
    return result({
      nextAction: 'edit_current_cycle',
      authorities: ['edit_current_artifact'],
      allowedOps: lineOps.edit,
      prohibitedOps: ['open_gate', ...NO_VISUAL_RESET],
      reason: 'The user already authorized a bounded revision and no recovery reset is required.',
    });
  }

  if (input.decision === 'approve') {
    const artifact = input.artifact === 'unknown'
      ? (input.line === 'compose' ? 'composition' : 'production')
      : input.artifact;
    const mapped: Partial<Record<GateName, { action: string; op: string }>> = {
      gate_a: { action: 'lock_brief', op: 'continue_locked_line' },
      gate_b: { action: 'approve_plan', op: 'continue_approved_plan' },
      gate_c: { action: 'approve_generation', op: 'run_approved_generation' },
      preview: { action: 'render_approved_preview', op: 'ovs draft' },
      gate_d: artifact === 'composition'
        ? { action: 'export_approved_draft', op: 'ovs draft --quality high' }
        : { action: 'accept_draft', op: 'finalize_approved_delivery' },
    };
    const transition = mapped[input.gate];
    if (!transition) throw new Error('approve requires a named gate');
    return result({
      nextAction: transition.action,
      authorities: [`approve_${input.gate}`],
      allowedOps: [transition.op],
      prohibitedOps: ['open_gate', ...NO_VISUAL_RESET],
      reason: 'The current real user message explicitly approved the displayed artifact.',
    });
  }

  if (input.recovery === 'available') {
    return result({
      nextAction: 'open_visual_recovery',
      form: { fields: ['visual_recovery_decision'] },
      prohibitedOps: ['edit_files', ...NO_VISUAL_RESET],
      reason: 'The latest deterministic QA result explicitly offered exhausted-cycle recovery.',
    });
  }

  return result({
    nextAction: 'follow_durable_state',
    prohibitedOps: ['open_gate', ...NO_VISUAL_RESET],
    reason: 'No new authority is required; follow the current artifact and QA state.',
  });
}
