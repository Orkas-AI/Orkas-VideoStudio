import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveBinaries } from '@orkas/video-studio-core';
import { render } from '../src/render/render';
import { probeMedia } from '../src/edit/edit';

// Heavy real e2e: scaffolds a HyperFrames composition via `npx hyperframes init`
// and renders it. Opt-in (needs network on first run + a browser) — set OVS_E2E=1.
const bins = resolveBinaries();
const enabled = process.env.OVS_E2E === '1' && Boolean(bins.npx) && Boolean(bins.ffmpeg);
const suite = enabled ? describe : describe.skip;

suite('render e2e (real hyperframes + ffmpeg)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ovs-render-e2e-'));
  const proj = join(dir, 'my-video');

  beforeAll(() => {
    execFileSync(
      bins.npx as string,
      ['-y', 'hyperframes@0.7.21', 'init', 'my-video', '--example', 'blank', '--non-interactive', '--skip-transcribe', '--resolution', 'landscape'],
      { cwd: dir, env: { ...process.env, HYPERFRAMES_SKIP_SKILLS: '1' }, stdio: 'ignore' },
    );
  }, 600_000);

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('renders a composition to a valid 1080p mp4', async () => {
    const r = await render({ project: proj, output: join(dir, 'out.mp4'), quality: 'draft' });
    expect(existsSync(r.output)).toBe(true);
    const p = await probeMedia(r.output);
    expect(p.width).toBe(1920);
    expect(p.height).toBe(1080);
    expect(p.v_codec).toBe('h264');
    expect(p.duration).toBeGreaterThan(1);
  }, 600_000);
});
