import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareComposition, reconcileComposition } from '../src/composition/scaffold.js';
import { resolveHyperframesInvocation } from '../src/hyperframes/client.js';
import {
  loadCompositionMeta,
  loadDesignContract,
  loadNarrationMap,
  loadSceneMap,
  runAudioTimingQa,
} from '../src/render/composition-qa.js';

function manifest(duration = 10): Record<string, unknown> {
  const split = duration / 2;
  return {
    schema_version: 2,
    composition: { id: 'main', width: 1920, height: 1080, duration, target_duration: duration, fps: 30, language: 'en' },
    scenes: [
      { id: 'hook', start: 0, duration: split, approved_copy: ['Launch'], narration_refs: [], source_shots: ['s01'], roles: ['hook'] },
      { id: 'payoff', start: split, duration: split, approved_copy: ['Finish'], narration_refs: [], source_shots: ['s02'], roles: ['payoff'] },
    ],
    audio: { owner: 'none', tracks: [] },
    art_direction: {},
  };
}

describe('manifest-owned HyperFrames scaffold', () => {
  it('prepares the contract and reconciles timing without replacing authored visuals', async () => {
    const project = mkdtempSync(join(tmpdir(), 'ovs-composition-'));
    try {
      const manifestPath = join(project, 'composition-manifest.json');
      writeFileSync(manifestPath, JSON.stringify(manifest()), 'utf8');
      const prepared = await prepareComposition(project);
      expect(prepared).toMatchObject({ ok: true, scaffold_created: true });
      expect(existsSync(join(project, 'assets', 'vendor', 'gsap.min.js'))).toBe(true);
      let html = readFileSync(join(project, 'index.html'), 'utf8');
      expect(html).toContain('data-composition-id="main" data-start="0"');
      expect(html).toContain('class="clip" data-scene-id="hook"');
      expect(html).toContain('#composition-root { position: relative; width: 1920px; height: 1080px;');
      expect(html).toContain('tl.fromTo("#scene-hook .scene-content"');
      expect(html).not.toContain('autoAlpha');
      expect(html).toContain('window.__timelines["main"] = tl');

      html = html.replace('<h1 id="title-hook" data-role="title">Launch</h1>', '<h1 id="title-hook" data-role="title">Authored visual survives</h1>');
      html = html.replace('class="clip" data-scene-id="hook"', 'class="authored-scene clip" data-scene-id="hook"');
      writeFileSync(join(project, 'index.html'), html, 'utf8');
      writeFileSync(manifestPath, JSON.stringify(manifest(12)), 'utf8');
      const reconciled = await reconcileComposition(project);
      expect(reconciled).toMatchObject({ ok: true, reconciled: true });
      const next = readFileSync(join(project, 'index.html'), 'utf8');
      expect(next).toContain('Authored visual survives');
      expect(next).toContain('class="authored-scene clip"');
      expect(next).toContain('data-duration="12"');
      expect(next).toContain('tl.fromTo("#scene-hook .scene-content", { opacity: 0, y: 48 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, 0);');
      expect(next).toContain('tl.fromTo("#scene-payoff .scene-content", { opacity: 0, y: 48 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, 6);');
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it('resolves the packaged HyperFrames dependency before using npx', () => {
    const previous = process.env.OVS_HYPERFRAMES_BIN;
    delete process.env.OVS_HYPERFRAMES_BIN;
    try {
      const invocation = resolveHyperframesInvocation('lint', ['project']);
      expect(invocation.source).toBe('dependency');
      expect(invocation.command).toBe(process.execPath);
      expect(invocation.args.join(' ')).toContain('hyperframes');
      expect(invocation.args.slice(-2)).toEqual(['lint', 'project']);
    } finally {
      if (previous === undefined) delete process.env.OVS_HYPERFRAMES_BIN;
      else process.env.OVS_HYPERFRAMES_BIN = previous;
    }
  });

  it('blocks standalone narration until audio is materialized but permits assembler-owned narration', async () => {
    const project = mkdtempSync(join(tmpdir(), 'ovs-composition-narration-'));
    try {
      const value = manifest();
      const scenes = value.scenes as Array<Record<string, unknown>>;
      scenes[0].narration_text = 'Narrated opening.';
      const narrationIntent = {
        route_ref: 'openai-compatible',
        voice_ref: 'nova',
        display_name: 'Nova',
        language: 'en-US',
        speed: 1,
      };
      value.audio = {
        owner: 'none',
        tracks: [],
        narration_intent: narrationIntent,
      };
      writeFileSync(join(project, 'composition-manifest.json'), JSON.stringify(value), 'utf8');
      await prepareComposition(project);

      const audioQa = async () => {
        const [loaded, contract, sceneMap, narrationMap] = await Promise.all([
          loadCompositionMeta(project),
          loadDesignContract(project),
          loadSceneMap(project),
          loadNarrationMap(project),
        ]);
        if (!loaded.meta) throw new Error('composition metadata missing');
        return runAudioTimingQa(loaded.meta, contract, sceneMap, narrationMap, project);
      };

      const standalone = await audioQa();
      expect(standalone).toMatchObject({ ok: false, narration_required: true });
      expect(JSON.stringify(standalone)).toContain('NARRATION_REQUIRED_BUT_NOT_MATERIALIZED');

      value.audio = { owner: 'assembler', tracks: [] };
      writeFileSync(join(project, 'composition-manifest.json'), JSON.stringify(value), 'utf8');
      await reconcileComposition(project);
      await expect(audioQa()).resolves.toMatchObject({ ok: true, narration_required: false });

      value.audio = { owner: 'none', tracks: [], narration_intent: narrationIntent };
      writeFileSync(join(project, 'composition-manifest.json'), JSON.stringify(value), 'utf8');
      await reconcileComposition(project);
      await expect(audioQa()).resolves.toMatchObject({ ok: false, narration_required: true });
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});
