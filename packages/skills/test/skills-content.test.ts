import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const skillsRoot = fileURLToPath(new URL('../', import.meta.url));

function skill(name: string): string {
  return readFileSync(join(skillsRoot, name, 'SKILL.md'), 'utf8');
}

function allSkillDocs(): Array<{ name: string; body: string }> {
  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(skillsRoot, d.name, 'SKILL.md')))
    .map((d) => ({ name: d.name, body: skill(d.name) }));
}

describe('skill pack content', () => {
  it('includes the VideoStudio design-layer skills', () => {
    for (const name of ['frontend-design', 'design-system-importer', 'composition-design-review']) {
      expect(skill(name)).toContain(`name: ${name}`);
    }
  });

  it('centralizes gate authority in the host-neutral gate-control skill', () => {
    const gate = skill('gate-control');
    const orchestration = skill('orchestration');
    expect(gate).toContain('name: gate-control');
    expect(gate).toContain('ovs gate transition');
    expect(gate).toContain('authority');
    expect(gate).toContain('recovery');
    expect(gate).toContain('content edit changes the draft signature');
    expect(gate).toContain('equivalent `gate_transition` MCP tool');
    expect(gate).toContain('Never execute a resolver by referencing an installed skill or Marketplace path directly');
    // The exhausted-cycle contract: a user fork with real choices, never a
    // silent wait, never a form, and the skip option is always named.
    expect(gate).toContain('user fork, not a silent wait');
    expect(gate).toContain('materially different edit');
    expect(gate).toContain('--waive');
    expect(gate).toContain('they cannot choose an option they were never told exists');
    // Who asked for the change decides whether to ask again.
    expect(gate).toContain('apply_user_instruction_then_approve_plan');
    expect(gate).toContain('never ask them to confirm a change they dictated');
    expect(gate).toContain('automatically starts a fresh persisted repair cycle');
    expect(gate).toContain('Never emit `visual_recovery_decision`');
    expect(gate).toContain('Production plan confirmation');
    expect(gate).toContain('制作计划确认');
    expect(gate).toContain('current UI/user language');
    expect(gate).toContain('local visual-only revision reuses the approved plan, assets, and narration');
    expect(orchestration).toContain('gate-control');
  });

  it('carries the checkpoint craft: five stops, visual identity, direction first', () => {
    const orchestration = skill('orchestration');
    const router = skill('video-router');
    const gate = skill('gate-control');
    // The closed stop set + anti-over-stopping rule.
    expect(orchestration).toContain('stop only five times');
    expect(orchestration).toContain('Showing an artifact is not an ending in itself');
    // The preview re-gates only on a visual-identity change.
    expect(orchestration).toContain('once per visual identity');
    expect(orchestration).toContain('preserve the prior silent frames');
    // The direction stop precedes any plan artifact, in both entry skills.
    expect(orchestration).toContain('before any plan file exists');
    expect(router).toContain('Routing ends at the direction stop');
    // An enumerated-option reply is the decision; frames ride the ending message.
    expect(orchestration).toContain('IS that decision');
    expect(orchestration).toContain('message that ENDS the turn');
    // Assembled stop economics + amendment aftermath by identity.
    expect(orchestration).toContain('never grows with the segment count');
    expect(gate).toContain('re-run visual QA and the preview only when the visual identity changed');
  });

  it('wires the design layers into compose and orchestration', () => {
    const compose = skill('stage-compose');
    const orchestration = skill('orchestration');
    for (const body of [compose, orchestration]) {
      expect(body).toContain('frontend-design');
      expect(body).toContain('design-system-importer');
      expect(body).toContain('composition-design-review');
    }
    expect(compose).toContain('composition-manifest.json');
    expect(compose).toContain('"schema_version": 2');
    expect(compose).toContain('ovs composition prepare');
    expect(compose).toContain('ovs composition reconcile');
    expect(compose).toContain('ovs check');
    expect(compose).toContain('HTML Preview Gate');
    expect(compose).toContain('./assets/vendor/gsap.min.js');
    expect(compose).toContain('ovs draft');
    expect(compose).toContain('ovs snapshot');
    expect(compose).toContain('every immutable full-size frame');
    expect(compose).toContain('contact sheet is an index');
    expect(compose).toContain('`ovs snapshot` may proceed while narration is pending');
    expect(compose).toContain('Required narration blocks only complete `ovs draft`/final delivery');
    expect(orchestration).toContain('ovs draft');
    expect(compose).not.toContain('cdn.jsdelivr.net');
    expect(existsSync(join(skillsRoot, 'stage-compose', 'scripts', 'composition.mjs'))).toBe(true);
  });

  it('keeps skill instructions on the open-source ovs command surface', () => {
    const forbidden = [
      'ownerAgent',
      'min_app_version',
      'video_studio',
      'run-skill',
      'ORKAS_PC_DIR',
      'composition.draft',
      'composition.snapshot',
      'generate_speech',
      'normalize_loudness',
      'audio_segments',
      'on_existing_audio',
    ];
    for (const { name, body } of allSkillDocs()) {
      for (const token of forbidden) {
        expect(body, `${name} should not contain ${token}`).not.toContain(token);
      }
    }
  });

  it('documents synced edit/assembly guardrails that the OSS tools expose', () => {
    const assemble = skill('stage-assemble');
    const edit = skill('stage-edit');
    expect(assemble).toContain('ovs edit normalize-loudness');
    expect(assemble).toContain('coverage');
    expect(assemble).toContain('ovs plan promise-check project/plan.json --probe-produced');
    expect(edit).toContain('E_OCR_RUNTIME_MISSING');
    expect(edit).toContain('ovs edit normalize-loudness');
    expect(edit).toContain('--on-existing-audio replace');
    expect(edit).toContain('ovs speech-capabilities');
    expect(edit).toContain('ovs narration fit');
  });

  it('preserves natural casing and exact generation parameters', () => {
    const frontend = skill('frontend-design');
    const review = skill('composition-design-review');
    const generate = skill('stage-generate');
    expect(frontend).toContain('sentence case or natural title case');
    expect(review).toContain('forced to all caps');
    expect(review).toContain('model-authored art direction is not authorization');
    expect(review).toContain('reviewed_frame_paths');
    expect(review).toContain('`passed | repair | blocked`');
    for (const token of ['--image-urls', '--ratio', '--duration', '--resolution', '--generate-audio']) {
      expect(generate).toContain(token);
    }
    expect(generate).toContain('ovs gate transition');
  });

  it('keeps the EDL and preview review contracts explicit', () => {
    const plan = skill('stage-plan');
    const compose = skill('stage-compose');
    expect(plan).toContain('`tracks` is required');
    expect(plan).toContain('Use `{}` when no tracks are needed');
    expect(plan).toContain('`motion_min_ratio` to the minimum share');
    expect(plan).toContain('For `compose_led`, use exactly `0`');
    expect(compose).toContain('Only a scored passing review may be shown as the visual preview');
    expect(compose).toContain('data-cover-hero');
    expect(plan).toContain('`edit_strategy`');
    expect(plan).toContain('Top-level `references`');
  });
});
