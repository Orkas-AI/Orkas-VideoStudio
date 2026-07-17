import { describe, expect, it } from 'vitest';
import { validateCompositionManifest } from '../src/composition/manifest.js';

function manifest(): Record<string, unknown> {
  return {
    schema_version: 2,
    composition: { id: 'main', width: 1920, height: 1080, duration: 10, target_duration: 10, fps: 30, language: 'en' },
    scenes: [
      { id: 'hook', start: 0, duration: 4, approved_copy: ['Hook'], narration_refs: [], source_shots: ['s01'], roles: ['hook'] },
      { id: 'payoff', start: 4, duration: 6, approved_copy: ['Payoff'], narration_refs: [], source_shots: ['s02'], roles: ['payoff'] },
    ],
    audio: { owner: 'none', tracks: [] },
    art_direction: { aesthetic: { signature_device: 'timeline ribbon' } },
  };
}

describe('composition manifest v2', () => {
  it('accepts one continuous canonical timeline', () => {
    const result = validateCompositionManifest(manifest());
    expect(result.ok).toBe(true);
    expect(result.data?.composition.id).toBe('main');
  });

  it('rejects gaps and unsafe audio paths', () => {
    const value = manifest();
    (value.scenes as Array<Record<string, unknown>>)[1].start = 5;
    value.audio = { owner: 'composition', tracks: [{ id: 'music', kind: 'music', src: '../music.mp3', start: 0, duration: 10, volume: 0.2 }] };
    const result = validateCompositionManifest(value);
    expect(result.ok).toBe(false);
    expect(result.issues.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      'COMPOSITION_MANIFEST_SCENE_GAP',
      'COMPOSITION_MANIFEST_AUDIO_PATH_INVALID',
    ]));
  });

  it('requires a signed narration intent for standalone v2 narration', () => {
    const value = manifest();
    const scenes = value.scenes as Array<Record<string, unknown>>;
    scenes[0].narration_text = 'A narrated hook.';
    value.audio = { owner: 'composition', tracks: [{ id: 'narration', kind: 'narration', src: 'assets/narration.mp3', start: 0, duration: 10, volume: 1 }] };
    const result = validateCompositionManifest(value);
    expect(result.issues.map((entry) => entry.code)).toContain('COMPOSITION_MANIFEST_NARRATION_INTENT_MISSING');
  });
});
