import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveBinaries } from '@orkas/video-studio-core';
import { lint, render } from '../src/render/render';
import { probeMedia } from '../src/edit/edit';
import { prepareComposition } from '../src/composition/scaffold';

// Heavy real e2e: scaffolds through OVS and renders with the packaged HyperFrames
// dependency. Opt-in (may need a browser download) — set OVS_E2E=1.
const bins = resolveBinaries();
const enabled = process.env.OVS_E2E === '1' && Boolean(bins.node) && Boolean(bins.ffmpeg);
const suite = enabled ? describe : describe.skip;

suite('render e2e (real hyperframes + ffmpeg)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ovs-render-e2e-'));
  const proj = join(dir, 'my-video');

  beforeAll(async () => {
    mkdirSync(proj, { recursive: true });
    writeFileSync(join(proj, 'composition-manifest.json'), JSON.stringify({
      schema_version: 2,
      composition: { id: 'main', width: 1920, height: 1080, duration: 3, target_duration: 3, fps: 30, language: 'en' },
      scenes: [{ id: 'main-scene', start: 0, duration: 3, approved_copy: ['HyperFrames'], narration_refs: [], source_shots: [], roles: ['title'] }],
      audio: { owner: 'none', tracks: [] },
      art_direction: {
        aesthetic: {
          subject_world: 'render laboratory', one_job: 'prove the packaged runtime path',
          signature_device: 'a frame counter', aesthetic_risk: 'single-purpose diagnostic frame',
          anti_template_check: 'rejected a generic card for a render counter',
        },
        visual_direction: {
          visual_tradition: 'technical test chart', lazy_defaults_rejected: 'no neon dashboard',
          video_scale: '1920x1080 title at 96px', depth_layer_rule: 'background, counter, label',
          motion_verb_rule: 'counter resolves', rhythm_pattern: 'reveal-hold',
        },
        layout_boxes: { title: 'safe center' },
        typography_tokens: { title: '96px' },
        color_tokens: { background: '#000000', text: '#ffffff' },
        motion_budget: { groups: 1, verbs: ['resolve'] },
        scene_variation: { rule: 'single diagnostic scene' },
        scenes: [{ id: 'main-scene', depth_layers: ['background', 'counter', 'label'], motion_verbs: ['resolve'] }],
      },
    }), 'utf8');
    const prepared = await prepareComposition(proj);
    expect(prepared.ok).toBe(true);
  }, 600_000);

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('renders a composition to a valid 1080p mp4', async () => {
    const qa = await lint(proj) as { ok?: boolean; errorCount?: number; error_count?: number };
    if (qa.ok === false) throw new Error(JSON.stringify(qa, null, 2));
    expect(qa.ok).not.toBe(false);
    expect(Number(qa.errorCount ?? qa.error_count ?? 0)).toBe(0);
    const r = await render({ project: proj, output: join(dir, 'out.mp4'), quality: 'draft' });
    expect(existsSync(r.output)).toBe(true);
    const p = await probeMedia(r.output);
    expect(p.width).toBe(1920);
    expect(p.height).toBe(1080);
    expect(p.v_codec).toBe('h264');
    expect(p.duration).toBeGreaterThan(1);
  }, 600_000);
});
