import { describe, expect, it } from 'vitest';
import { resolveGateTransition } from '../src/gates/transition.js';

describe('resolveGateTransition', () => {
  it('turns a visual-only draft revision into one bounded edit without another gate', () => {
    const result = resolveGateTransition({
      line: 'compose',
      artifact: 'composition',
      gate: 'gate_d',
      decision: 'revise',
      scope: 'visual_only',
      recovery: 'not_available',
    });
    expect(result).toMatchObject({ next_action: 'edit_current_cycle', form: null });
    expect(result.allowed_ops).toContain('ovs snapshot');
    expect(result.prohibited_ops).toContain('emit_form');
  });

  it('uses one Gate B amendment and ignores recovery from the old signature', () => {
    const result = resolveGateTransition({
      line: 'compose',
      artifact: 'composition',
      gate: 'preview',
      decision: 'revise',
      scope: 'gate_b_payload',
      recovery: 'available',
    });
    expect(result).toMatchObject({
      next_action: 'open_gate_b_amendment',
      form: { fields: ['gate_b_decision'] },
    });
    expect(result.prohibited_ops).toContain('reset_visual_qa_cycle');
  });

  it('uses the current visual revise decision to start a fresh automatic QA cycle', () => {
    const result = resolveGateTransition({
      line: 'compose',
      artifact: 'composition',
      gate: 'preview',
      decision: 'revise',
      scope: 'visual_only',
      recovery: 'available',
    });
    expect(result).toMatchObject({
      next_action: 'edit_and_restart_visual_qa',
      form: null,
      authorities: ['edit_current_artifact', 'restart_visual_qa_cycle'],
    });
    expect(result.allowed_ops).toContain('ovs draft');
    expect(result.prohibited_ops).toContain('emit_form');
  });

  it('does not treat an authorization error as proof that recovery is available', () => {
    const result = resolveGateTransition({
      line: 'compose',
      artifact: 'composition',
      gate: 'gate_d',
      decision: 'revise',
      scope: 'visual_only',
      recovery: 'unknown',
      errorCode: 'E_VISUAL_REVISION_EXPLICIT_AUTHORIZATION_REQUIRED',
    });
    expect(result).toMatchObject({ next_action: 'query_status', form: null });
    expect(result.prohibited_ops).toContain('emit_form');
  });

  it('reports an exhausted QA blocker without creating a recovery form', () => {
    const result = resolveGateTransition({
      line: 'compose',
      artifact: 'composition',
      recovery: 'available',
      errorCode: 'E_VISUAL_REVISION_EXPLICIT_AUTHORIZATION_REQUIRED',
    });
    expect(result).toMatchObject({ next_action: 'report_visual_qa_blocker', form: null });
    expect(result.prohibited_ops).toContain('emit_form');
  });

  it('rejects mixed current and legacy decision fields', () => {
    expect(() => resolveGateTransition({
      line: 'compose',
      artifact: 'composition',
      gate: 'preview',
      decision: 'revise',
      scope: 'visual_only',
      recovery: 'available',
      recoveryDecision: 'new_visual_revision',
    })).toThrow(/cannot both describe the current turn/i);
  });

  it('consumes a legacy recovery decision without emitting another form', () => {
    const result = resolveGateTransition({
      line: 'compose',
      artifact: 'composition',
      recovery: 'available',
      recoveryDecision: 'new_visual_revision',
    });
    expect(result).toMatchObject({ next_action: 'edit_for_fresh_visual_qa', form: null });
    expect(result.allowed_ops).toContain('ovs draft');
    expect(result.prohibited_ops).toContain('emit_form');
  });

  it('continues from an existing approval for an unchanged artifact', () => {
    const result = resolveGateTransition({
      line: 'edit',
      artifact: 'production',
      gate: 'gate_b',
      artifactState: 'unchanged',
      approvalStatus: 'approved',
      recovery: 'not_available',
    });
    expect(result).toMatchObject({ next_action: 'continue_from_existing_approval', form: null });
    expect(result.prohibited_ops).toContain('emit_form');
  });

  it('maps an explicit preview approval to the real OVS draft operation', () => {
    const result = resolveGateTransition({
      line: 'compose',
      artifact: 'composition',
      gate: 'preview',
      decision: 'approve',
      scope: 'none',
      recovery: 'not_available',
    });
    expect(result).toMatchObject({ next_action: 'render_approved_preview', allowed_ops: ['ovs draft'] });
  });

  it('lets a current Gate B amendment approval win over cached approval', () => {
    const result = resolveGateTransition({
      line: 'compose',
      artifact: 'composition',
      gate: 'gate_b',
      decision: 'approve',
      scope: 'gate_b_payload',
      recovery: 'not_available',
      artifactState: 'unchanged',
      approvalStatus: 'approved',
    });
    expect(result).toMatchObject({
      next_action: 'apply_approved_amendment_then_approve_plan',
      authorities: ['edit_current_artifact', 'approve_gate_b'],
      form: null,
    });
    expect(result.prohibited_ops).toContain('emit_form');
  });
});
