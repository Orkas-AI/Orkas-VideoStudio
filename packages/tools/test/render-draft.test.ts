import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { draft, inspect, render } from '../src/render/render';

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

function writeContract(dir: string, extra: Record<string, unknown> = {}): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'design-contract.json'), JSON.stringify({
    canvas: { width: 1920, height: 1080, duration: 10 },
    scenes: [{ id: 's1', start: 0, duration: 10, headline: 'Launch' }],
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

describe('composition draft gate', () => {
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

  it('returns local preflight findings from inspect without loading unsafe HTML', async () => {
    const p = tmpProject('inspect-preflight');
    try {
      writeHtml(p.composition, '<img src="https://cdn.example.com/image.png"><div>Launch</div>');

      const result = await inspect(p.composition);

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
      expect(attempts[3]).toMatchObject({ ok: false, errorCode: 'E_REPAIR_BUDGET_EXCEEDED' });
      expect(existsSync(join(p.composition, 'qa', 'draft-repair-state.json'))).toBe(true);
    } finally {
      rmSync(p.root, { recursive: true, force: true });
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
