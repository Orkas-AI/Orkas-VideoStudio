import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compositionScript, prepareComposition, reconcileComposition } from '../src/composition/scaffold.js';
import { resolveHyperframesInvocation } from '../src/hyperframes/client.js';
import {
  authoredAbsoluteTimelinePositions,
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
      // Reveals stay anchored to S(id) — they read the reconciled data-start
      // at runtime, so the retime cannot strand them on a literal second.
      expect(next).toContain('tl.fromTo("#scene-hook .scene-content", { opacity: 0, y: 48 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, S("hook"));');
      expect(next).toContain('tl.fromTo("#scene-payoff .scene-content", { opacity: 0, y: 48 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, S("payoff"));');
      expect(next).toContain('const S = (id)');
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it('keeps a legacy literal-positioned scaffold literal — S() would reference an undefined helper', async () => {
    const project = mkdtempSync(join(tmpdir(), 'ovs-composition-legacy-'));
    try {
      const manifestPath = join(project, 'composition-manifest.json');
      writeFileSync(manifestPath, JSON.stringify(manifest()), 'utf8');
      // A pre-anchor scaffold: no S()/D() helpers, reveal at a literal second.
      writeFileSync(join(project, 'index.html'), [
        '<!doctype html><html><head></head><body>',
        '<main id="composition-root" data-composition-id="main" data-start="0" data-duration="10" data-width="1920" data-height="1080" data-fps="30">',
        '<section id="scene-hook" class="clip" data-scene-id="hook" data-start="0" data-duration="5"></section>',
        '<section id="scene-payoff" class="clip" data-scene-id="payoff" data-start="5" data-duration="5"></section>',
        '</main>',
        '<script>',
        'window.__timelines = window.__timelines || {};',
        'const tl = gsap.timeline({ paused: true });',
        'window.__timelines["main"] = tl;',
        'tl.fromTo("#scene-payoff .scene-content", { opacity: 0, y: 48 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, 5);',
        '</script></body></html>',
      ].join('\n'), 'utf8');
      writeFileSync(manifestPath, JSON.stringify(manifest(12)), 'utf8');
      const reconciled = await reconcileComposition(project);
      expect(reconciled).toMatchObject({ ok: true, reconciled: true });
      const next = readFileSync(join(project, 'index.html'), 'utf8');
      expect(next).toContain('data-scene-id="payoff" data-start="6"');
      expect(next).toContain('ease: "power3.out" }, 6);');
      expect(next).not.toContain('S("payoff")');
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it('renders the plan text read-only, without touching the composition dir', async () => {
    const project = mkdtempSync(join(tmpdir(), 'ovs-composition-script-'));
    try {
      writeFileSync(join(project, 'composition-manifest.json'), JSON.stringify(manifest()), 'utf8');
      const result = await compositionScript(project);
      expect(result.ok).toBe(true);
      expect(result.script).toContain('Timeline:');
      expect(result.script).toContain('hook');
      // Read-only: no scaffold, no vendor, no side effects — the plan text is
      // shown at Gate B BEFORE any approval authorizes writes.
      expect(existsSync(join(project, 'index.html'))).toBe(false);
      expect(existsSync(join(project, 'assets'))).toBe(false);

      const missing = await compositionScript(join(project, 'nowhere'));
      expect(missing.ok).toBe(false);
      expect(missing.issues.map((issue) => issue.code)).toContain('COMPOSITION_MANIFEST_MISSING');
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

  it('reports authored absolute timeline seconds with the exact S() replacement', () => {
    const scenes = [
      { id: 'hook', start: 0, duration: 5 },
      { id: 'payoff', start: 5, duration: 5 },
    ];
    const html = [
      '<script>',
      'tl.to("#a", { x: 10, duration: 1 }, 6.5);',
      'tl.fromTo("#b", { opacity: 0 }, { opacity: 1 }, S("hook") + 0.2);',
      'tl.from("#c", { y: 20 }, "+=1");',
      'tl.call(() => {}, null, 5);',
      'tl.to("#d", { x: 1, duration: 0.1 });',
      '</script>',
    ].join('\n');
    const found = authoredAbsoluteTimelinePositions(html, scenes);
    expect(found).toHaveLength(2);
    expect(found[0]).toMatchObject({ method: 'to', seconds: 6.5, scene_id: 'payoff', suggestion: 'S("payoff") + 1.5' });
    // tl.call's position is its THIRD argument, not the second.
    expect(found[1]).toMatchObject({ method: 'call', seconds: 5, scene_id: 'payoff', suggestion: 'S("payoff")' });
  });

  it('has no opinion without scene windows', () => {
    expect(authoredAbsoluteTimelinePositions('<script>tl.to("#a", {}, 3);</script>', [])).toEqual([]);
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
