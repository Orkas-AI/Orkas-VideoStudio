import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { containsWorkingVideo, deliveries, digest } from '../../../eval/video/delivery.mjs';
import { shouldRunStep, validateCases } from '../../../eval/video/case-flow.mjs';
import { startFixtureServer } from '../../../eval/video/fixture-server.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe('public model evaluation delivery evidence', () => {
  function fixture() {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'ovs-model-receipt-')));
    roots.push(root);
    const production = join(root, 'production');
    const file = join(production, 'versions', 'clip-v1.mp4');
    mkdirSync(join(production, 'versions'), { recursive: true });
    writeFileSync(file, 'fixture bytes');
    const version = { id: 'v1', product_facts: [{ id: 'fact', text: 'A fixture.' }], path: 'versions/clip-v1.mp4', sha256: digest(file) };
    writeFileSync(join(production, 'versions.json'), JSON.stringify({ versions: [version] }));
    const receipt = { type: 'item.completed', item: {
      type: 'command_execution', command: 'ovs timeline ship --production production', exit_code: 0,
      aggregated_output: 'diagnostic header\n' + JSON.stringify({ ok: true, version }, null, 2) + '\n',
    } };
    return { root, file, version, receipt, production };
  }

  it('requires both a public ship receipt and the matching immutable version', () => {
    const { root, file, version, receipt } = fixture();
    expect(deliveries(root, [])).toEqual([]);
    expect(deliveries(root, [receipt])).toMatchObject([{ file, id: 'v1', sha256: version.sha256 }]);
    writeFileSync(file, 'modified output');
    expect(deliveries(root, [receipt])).toEqual([]);
  });

  it('rejects a rejected or overridden delivery', () => {
    const { root, receipt, production, version } = fixture();
    expect(deliveries(root, [{ ...receipt, item: { ...receipt.item, exit_code: 1 } }])).toEqual([]);
    writeFileSync(join(production, 'versions.json'), JSON.stringify({
      versions: [{ ...version, override: { reason: 'test override' } }],
    }));
    expect(deliveries(root, [receipt])).toEqual([]);
  });
});

describe('model evaluation output directory', () => {
  const runner = fileURLToPath(new URL('../../../eval/video/run.mjs', import.meta.url));
  const indexCheck = fileURLToPath(new URL('../../../eval/video/check-index.mjs', import.meta.url));

  it('rejects a force-added run result during standalone verification', () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'ovs-model-index-')));
    roots.push(root);
    const git = (...args: string[]) => {
      const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
      expect(result.status, result.stderr).toBe(0);
    };
    git('init', '--quiet');
    const folder = 'ovs-model-eval-test';
    mkdirSync(join(root, folder));
    writeFileSync(join(root, '.gitignore'), 'ovs-model-eval-*/\n');
    writeFileSync(join(root, folder, 'result.json'), '{}');
    const check = () => spawnSync(process.execPath, [indexCheck], { cwd: root, encoding: 'utf8', timeout: 5000 });

    expect(check().status).toBe(0);
    git('add', '-f', folder + '/result.json');
    const staged = check();
    expect(staged.status).toBe(1);
    expect(staged.stderr).toContain('Keep model evaluation output outside Git: ovs-model-eval-test/result.json');
  });

  it.each([false, true])('rejects Git worktrees before creating any run output (symlink: %s)', (viaLink) => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'ovs-model-output-')));
    roots.push(root);
    const checkout = join(root, 'checkout');
    mkdirSync(checkout);
    writeFileSync(join(checkout, '.git'), 'gitdir: /test/worktrees/example\n');
    const link = join(root, 'linked-checkout');
    if (viaLink) symlinkSync(checkout, link, process.platform === 'win32' ? 'junction' : 'dir');
    const output = join(viaLink ? link : checkout, 'new-evidence', 'run');
    const result = spawnSync(process.execPath, [runner, '--case', 'retake-cleanup', '--output-dir', output], { encoding: 'utf8', timeout: 5000 });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Model evaluation output must be outside Git worktrees');
    expect(existsSync(join(checkout, 'new-evidence'))).toBe(false);
  });
});

describe('public evaluation transitions', () => {
  const delivery = (duration: number) => ({ probe: { duration } });
  const finished = (duration?: number) => {
    const version = duration === undefined ? undefined : delivery(duration);
    return { completed: true, delivery: version, versions: version ? [version] : [] };
  };

  it('offers late footage only after a completed turn without a substitute delivery', () => {
    const step = { after: 'no-delivery', attachments: 'later' };
    expect(shouldRunStep(step, finished())).toBe(true);
    expect(shouldRunStep(step, finished(14))).toBe(false);
    expect(shouldRunStep(step, { ...finished(), completed: false })).toBe(false);
  });

  it('distinguishes setup from an actual video created before the upload', () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'ovs-eval-delayed-video-')));
    roots.push(root);
    mkdirSync(join(root, 'production', 'render'), { recursive: true });
    writeFileSync(join(root, 'production', 'notes.md'), 'ovs timeline import --help');
    expect(containsWorkingVideo(root)).toBe(false);
    writeFileSync(join(root, 'production', 'render', 'stand-in.mp4'), 'video bytes');
    expect(containsWorkingVideo(root)).toBe(true);
  });

  it('authorizes the complete video only after a single short preview', () => {
    const step = { after: 'sample' };
    expect(shouldRunStep(step, finished(35))).toBe(true);
    expect(shouldRunStep(step, finished(175))).toBe(false);
    expect(shouldRunStep(step, { ...finished(35), versions: [delivery(35), delivery(175)] })).toBe(false);
  });

  it('rejects an unregistered fixture and a duplicated source case before execution', () => {
    const seed = { local: () => ({}) };
    const entry = { id: 'local', sourceCaseId: 'source', sourceCaseSha256: '0'.repeat(64),
      fixture: 'local', prompt: 'Make a clip.', review: 'Check the clip.' };
    expect(() => validateCases([entry], seed)).not.toThrow();
    expect(() => validateCases([{ ...entry, fixture: 'missing' }], seed)).toThrow('Invalid or duplicate');
    expect(() => validateCases([entry, { ...entry, id: 'duplicate' }], seed)).toThrow('Invalid or duplicate');
  });

  it('counts and denies paid provider attempts without a charge or task', async () => {
    const server = await startFixtureServer({}, 'budget');
    try {
      const response = await fetch(server.baseUrl + '/contents/generations/tasks', {
        method: 'POST', body: JSON.stringify({ prompt: 'Fixture only' }),
      });
      expect(response.status).toBe(402);
      expect(await response.json()).toMatchObject({ error: 'No payment authorized for this case' });
      expect(server.requests).toEqual([{ method: 'POST', route: '/contents/generations/tasks', status: 402 }]);
    } finally {
      await server.close();
    }
  });
});
