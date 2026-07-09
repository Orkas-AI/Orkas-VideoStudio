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

  it('wires the design layers into compose and orchestration', () => {
    const compose = skill('stage-compose');
    const orchestration = skill('orchestration');
    for (const body of [compose, orchestration]) {
      expect(body).toContain('frontend-design');
      expect(body).toContain('design-system-importer');
      expect(body).toContain('composition-design-review');
    }
    expect(compose).toContain('design-contract.json');
    expect(compose).toContain('HTML Preview Gate');
    expect(compose).toContain('./assets/vendor/gsap.min.js');
    expect(compose).toContain('ovs draft');
    expect(compose).toContain('ovs snapshot');
    expect(orchestration).toContain('ovs draft');
    expect(compose).not.toContain('cdn.jsdelivr.net');
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
    expect(edit).toContain('current build reports OCR unavailable');
    expect(edit).toContain('ovs edit normalize-loudness');
    expect(edit).toContain('--on-existing-audio replace');
  });
});
