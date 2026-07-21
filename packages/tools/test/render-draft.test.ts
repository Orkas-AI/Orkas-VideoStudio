import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { check, draft, render, snapshot } from '../src/render/render';
import { isEnvironmentalDraftFailure } from '../src/render/composition-qa';

function tmpProject(name: string): { root: string; composition: string; output: string; report: string } {
  const root = mkdtempSync(join(tmpdir(), `ovs-${name}-`));
  const composition = join(root, 'project', 'composition');
  return {
    root,
    composition,
    output: join(root, 'project', 'render', 'draft.mp4'),
    report: join(root, 'project', 'render', 'draft-report.json'),
  };
}

function writeHtml(dir: string, body: string, attrs = 'data-composition-id="main" data-start="0" data-duration="10" data-width="1920" data-height="1080"'): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), `<!doctype html><html><body><div id="root" ${attrs}>${body}</div></body></html>`, 'utf8');
}

/** A contract that satisfies the design budget, so these tests exercise the gate
 *  they name rather than tripping the design preflight. */
const CONTRACT_BUDGET = {
  aesthetic: {
    subject_world: 'battery lab oscilloscope traces',
    one_job: 'show the charge curve flattening',
    signature_device: 'the trace becomes the progress line',
    aesthetic_risk: 'no product shot until the payoff',
    anti_template_check: 'rejected a centered title card for an edge-anchored trace',
  },
  visual_direction: {
    visual_tradition: 'Swiss Pulse precision grid',
    lazy_defaults_rejected: 'rejected neon circles; using instrument traces',
    video_scale: '1920x1080: headline 88-132px, body 44-56px',
    depth_layer_rule: 'BG grid, MG trace, FG metadata ticks',
    motion_verb_rule: 'the trace draws, the value counts up',
    rhythm_pattern: 'hook-build-HOLD-resolve',
  },
  layout_boxes: { focal: 'left two thirds', supporting: 'right column' },
  typography_tokens: { title: '96px', body: '44px', label: '40px' },
  color_tokens: { bg: '#081018', ink: '#f3f0e8', accent: '#ffb000' },
  motion_budget: 'the trace draws once; everything else holds still',
  scene_variation: 'no two adjacent scenes share a layout grammar',
};

function writeContract(dir: string, extra: Record<string, unknown> = {}): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'design-contract.json'), JSON.stringify({
    canvas: { width: 1920, height: 1080, duration: 10 },
    scenes: [{ id: 's1', start: 0, duration: 10, headline: 'Launch', depth_layers: 'BG grid / MG trace / FG ticks', motion_verbs: 'trace draws' }],
    ...CONTRACT_BUDGET,
    ...extra,
  }, null, 2), 'utf8');
}

function writeSceneMap(dir: string, extra: Record<string, unknown> = {}): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'scene-map.json'), JSON.stringify({
    canvas: { width: 1920, height: 1080, duration: 10 },
    scenes: [{ id: 's1', start: 0, duration: 10, headline: 'Launch' }],
    ...extra,
  }, null, 2), 'utf8');
}

describe('design contract preflight', () => {
  it('blocks a draft when the declared contract has no design budget', async () => {
    const p = tmpProject('thin-contract');
    try {
      writeHtml(p.composition, '<div>Launch</div>');
      mkdirSync(p.composition, { recursive: true });
      // A contract that is a canvas + scenes, with none of the budget.
      writeFileSync(join(p.composition, 'design-contract.json'), JSON.stringify({
        canvas: { width: 1920, height: 1080, duration: 10 },
        scenes: [{ id: 's1', start: 0, duration: 10, headline: 'Launch' }],
      }), 'utf8');

      const res = await draft({ project: p.composition, output: p.output, reportPath: p.report });

      expect(res).toMatchObject({ ok: false, errorCode: 'E_DESIGN_CONTRACT_BLOCKED' });
      expect(JSON.stringify(res.report)).toContain('DESIGN_CONTRACT_BUDGET_INCOMPLETE');
      expect(existsSync(p.output)).toBe(false);
    } finally {
      rmSync(p.root, { recursive: true, force: true });
    }
  });

  it('does not second-guess a composition that ships no contract', async () => {
    const p = tmpProject('no-contract');
    try {
      // No design-contract.json at all: the gate must have no opinion, so this
      // gets past the design step and fails later for a real reason.
      writeHtml(p.composition, '<script src="https://cdn.example.com/runtime.js"></script><div>Launch</div>');

      const res = await draft({ project: p.composition, output: p.output, reportPath: p.report });

      expect(res.errorCode).not.toBe('E_DESIGN_CONTRACT_BLOCKED');
    } finally {
      rmSync(p.root, { recursive: true, force: true });
    }
  });
});

describe('composition draft gate', () => {
  it('blocks snapshot from current narration facts before invoking HyperFrames', async () => {
    const p = tmpProject('snapshot-narration-facts');
    try {
      writeHtml(p.composition, '<div>Launch</div>');
      writeContract(p.composition);
      writeSceneMap(p.composition, {
        audio: { owner: 'none', tracks: [] },
        scenes: [{ id: 's1', start: 0, duration: 10, headline: 'Launch', narration_text: 'Narrated opening.' }],
      });

      await expect(snapshot({ project: p.composition, output: join(p.root, 'preview.png') }))
        .rejects.toThrow(/NARRATION_REQUIRED_BUT_NOT_MATERIALIZED/);
      expect(existsSync(join(p.root, 'preview.png'))).toBe(false);
    } finally {
      rmSync(p.root, { recursive: true, force: true });
    }
  });

  it('blocks draft from current narration facts before invoking HyperFrames', async () => {
    const p = tmpProject('draft-narration-facts');
    try {
      writeHtml(p.composition, '<div>Launch</div>');
      writeContract(p.composition);
      writeSceneMap(p.composition, {
        audio: { owner: 'none', tracks: [] },
        scenes: [{ id: 's1', start: 0, duration: 10, headline: 'Launch', narration_text: 'Narrated opening.' }],
      });

      await expect(draft({ project: p.composition, output: p.output, reportPath: p.report }))
        .resolves.toMatchObject({ ok: false, errorCode: 'E_AUDIO_TIMING_BLOCKED' });
      expect(JSON.stringify(JSON.parse(readFileSync(p.report, 'utf8')))).toContain('NARRATION_REQUIRED_BUT_NOT_MATERIALIZED');
      expect(existsSync(p.output)).toBe(false);
    } finally {
      rmSync(p.root, { recursive: true, force: true });
    }
  });

  it('blocks remote runtime resources before rendering', async () => {
    const p = tmpProject('remote-resource');
    try {
      writeHtml(p.composition, '<script src="https://cdn.example.com/runtime.js"></script><div>Launch</div>');

      const res = await draft({ project: p.composition, output: p.output, reportPath: p.report });

      expect(res).toMatchObject({ ok: false, errorCode: 'E_LINT_BLOCKED' });
      expect(JSON.stringify(res.report)).toContain('REMOTE_RESOURCE_BLOCKED');
      expect(existsSync(p.output)).toBe(false);
    } finally {
      rmSync(p.root, { recursive: true, force: true });
    }
  });

  it('returns local preflight findings from check without loading unsafe HTML', async () => {
    const p = tmpProject('check-preflight');
    try {
      writeHtml(p.composition, '<img src="https://cdn.example.com/image.png"><div>Launch</div>');

      const result = await check(p.composition);

      expect(JSON.stringify(result)).toContain('REMOTE_RESOURCE_BLOCKED');
    } finally {
      rmSync(p.root, { recursive: true, force: true });
    }
  });

  it('blocks direct render through local preflight before invoking the backend', async () => {
    const p = tmpProject('render-preflight');
    try {
      writeHtml(p.composition, '<img src="https://cdn.example.com/image.png"><div>Launch</div>');

      await expect(render({ project: p.composition, output: p.output })).rejects.toThrow(/REMOTE_RESOURCE_BLOCKED/);
      expect(existsSync(p.output)).toBe(false);
    } finally {
      rmSync(p.root, { recursive: true, force: true });
    }
  });

  it('blocks contract/html canvas mismatches before rendering', async () => {
    const p = tmpProject('contract-mismatch');
    try {
      writeHtml(p.composition, '<div>Launch</div>', 'data-composition-id="main" data-start="0" data-duration="8" data-width="1280" data-height="720"');
      writeContract(p.composition);
      writeSceneMap(p.composition);

      const res = await draft({ project: p.composition, output: p.output, reportPath: p.report });

      expect(res).toMatchObject({ ok: false, errorCode: 'E_CONTRACT_HTML_BLOCKED' });
      expect(JSON.stringify(res.report)).toContain('CANVAS_CONTRACT_MISMATCH');
      expect(existsSync(p.output)).toBe(false);
    } finally {
      rmSync(p.root, { recursive: true, force: true });
    }
  });

  it('enforces the bounded draft repair budget', async () => {
    const p = tmpProject('repair-budget');
    try {
      writeHtml(p.composition, '<div>Launch</div>', 'data-composition-id="main" data-start="0" data-width="1920" data-height="1080"');
      const attempts = [];
      for (let i = 0; i < 4; i += 1) {
        attempts.push(await draft({ project: p.composition, output: p.output, reportPath: p.report }));
      }

      expect(attempts[0]).toMatchObject({ ok: false, errorCode: 'E_LINT_BLOCKED' });
      expect(attempts[1]).toMatchObject({ ok: false, errorCode: 'E_LINT_BLOCKED' });
      expect(attempts[2]).toMatchObject({
        ok: false,
        errorCode: 'E_LINT_BLOCKED',
        repair_budget: expect.objectContaining({ budget_exhausted: true, repair_passes_used: 2 }),
      });
      expect(attempts[3]).toMatchObject({
        ok: false,
        errorCode: 'E_REPAIR_BUDGET_EXCEEDED',
        visual_revision_recovery_available: true,
        recovery_requires_new_user_revision: true,
        next_action: 'report_visual_qa_blocker_or_wait_for_user_revision',
      });
      expect(attempts[3]).not.toHaveProperty('recovery_form');
      expect(existsSync(join(p.composition, 'qa', 'draft-repair-state.json'))).toBe(true);
    } finally {
      rmSync(p.root, { recursive: true, force: true });
    }
  });

  it('starts a fresh bounded cycle after authored composition inputs change', async () => {
    const p = tmpProject('repair-budget-content-change');
    try {
      writeHtml(p.composition, '<div>First invalid version</div>', 'data-composition-id="main" data-start="0" data-width="1920" data-height="1080"');
      for (let i = 0; i < 3; i += 1) {
        await draft({ project: p.composition, output: p.output, reportPath: p.report });
      }
      await expect(draft({ project: p.composition, output: p.output, reportPath: p.report }))
        .resolves.toMatchObject({ errorCode: 'E_REPAIR_BUDGET_EXCEEDED' });

      writeFileSync(join(p.composition, 'composition-manifest.json'), '{}', 'utf8');
      await expect(draft({ project: p.composition, output: p.output, reportPath: p.report }))
        .resolves.toMatchObject({ errorCode: 'E_LINT_BLOCKED' });

      writeHtml(p.composition, '<div>Edited invalid version</div>', 'data-composition-id="main" data-start="0" data-width="1920" data-height="1080"');
      await expect(draft({ project: p.composition, output: p.output, reportPath: p.report }))
        .resolves.toMatchObject({ errorCode: 'E_LINT_BLOCKED' });
    } finally {
      rmSync(p.root, { recursive: true, force: true });
    }
  });

  it('classifies only machine/runtime failures as environmental', () => {
    for (const code of ['E_RENDER_TOO_HEAVY', 'E_FFMPEG_MISSING', 'E_FFPROBE_MISSING', 'E_NPX_MISSING', 'E_HYPERFRAMES_MISSING', 'E_RENDER_ABORTED']) {
      expect(isEnvironmentalDraftFailure(code)).toBe(true);
    }
    for (const code of ['E_RENDER_FAILED', 'E_LINT_BLOCKED', 'E_VIDEO_QA_BLOCKED', 'E_REPAIR_BUDGET_EXCEEDED']) {
      expect(isEnvironmentalDraftFailure(code)).toBe(false);
    }
  });

  it('prepares the local GSAP vendor before later QA runs', async () => {
    const p = tmpProject('vendor');
    try {
      writeHtml(p.composition, '<script src="./assets/vendor/gsap.min.js"></script><script>gsap.timeline({ paused: true })</script><div>Launch</div>');

      const res = await draft({ project: p.composition, output: p.output, reportPath: p.report });

      expect(res).toMatchObject({ ok: false, errorCode: 'E_CONTRACT_HTML_BLOCKED' });
      const vendor = join(p.composition, 'assets', 'vendor', 'gsap.min.js');
      expect(existsSync(vendor)).toBe(true);
      expect(readFileSync(vendor, 'utf8')).toContain('totalDuration');
    } finally {
      rmSync(p.root, { recursive: true, force: true });
    }
  });
});
