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
    expect(result.prohibited_ops).toContain('open_gate');
  });

  it('opens one combined decision when a signed amendment and exhausted recovery are both required', () => {
    const result = resolveGateTransition({
      line: 'compose',
      artifact: 'composition',
      gate: 'preview',
      decision: 'revise',
      scope: 'gate_b_payload',
      recovery: 'available',
    });
    expect(result).toMatchObject({
      next_action: 'open_combined_amendment_and_recovery',
      form: { fields: ['gate_b_decision', 'visual_recovery_decision'] },
    });
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
    expect(result.prohibited_ops).toContain('open_gate');
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
});
