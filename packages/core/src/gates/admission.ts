export type ProductionPolicyFacts = {
  planApproved: boolean;
  narrationRequired: boolean;
  narrationMaterialized: boolean;
};

export type ProductionOperationAdmission =
  | { ok: true }
  | {
    ok: false;
    errorCode: string;
    message: string;
    nextAction?: string;
  };

const PLAN_APPROVAL_REQUIRED_OPS = new Set([
  'composition.prepare',
  'composition.materialize_narration',
  'composition.lint',
  'composition.check',
  'composition.snapshot',
  'composition.approve_preview',
  'composition.submit_design_review',
  'composition.draft',
  'composition.approve_draft',
  'composition.export',
]);

const NARRATION_COMPLETE_REQUIRED_OPS = new Set([
  'composition.draft',
  'composition.approve_draft',
  'composition.export',
]);

/**
 * Fact-based production admission. No stage number participates in authority:
 * callers recompute approval and narration facts from current artifacts.
 */
export function evaluateProductionOperation(
  op: string,
  facts: ProductionPolicyFacts,
): ProductionOperationAdmission {
  if (PLAN_APPROVAL_REQUIRED_OPS.has(op) && !facts.planApproved) {
    return {
      ok: false,
      errorCode: 'E_GATE_B_APPROVAL_REQUIRED',
      message: 'Approve the current composition plan before production.',
      nextAction: 'composition.approve_plan',
    };
  }
  if (facts.narrationRequired
    && !facts.narrationMaterialized
    && NARRATION_COMPLETE_REQUIRED_OPS.has(op)) {
    return {
      ok: false,
      errorCode: 'E_NARRATION_MATERIALIZATION_REQUIRED',
      message: 'Standalone narration is incomplete. Materialize or recover it before creating or approving a deliverable artifact.',
      nextAction: 'composition.materialize_narration',
    };
  }
  return { ok: true };
}

export function nextAllowedProductionOperations(
  facts: ProductionPolicyFacts,
): string[] {
  const candidates = [
    'composition.approve_plan',
    'composition.prepare',
    'composition.materialize_narration',
    'composition.lint',
    'composition.check',
    'composition.snapshot',
    'composition.approve_preview',
    'composition.submit_design_review',
    'composition.draft',
    'composition.approve_draft',
    'composition.export',
    'composition.status',
    'composition.doctor',
    'composition.reconcile',
    'composition.check_narration_fit',
  ];
  return candidates.filter((op) => evaluateProductionOperation(op, facts).ok);
}
