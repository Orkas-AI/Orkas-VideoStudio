import { expect, it } from 'vitest';
import { visualProjectionOfCompositionManifest, normalizeCompositionHtmlForVisualIdentity, authoredAbsoluteTimelinePositions } from '../src/composition/index.js';
it('keeps visual identity for audio-only changes, but invalidates changed copy and scene windows', () => {
  const base = { composition: { duration: 10, target_duration: 10 }, scenes: [{ id: 'one', start: 0, duration: 10, approved_copy: ['Hello'], narration_text: 'Old', narration_refs: ['old'] }], audio: { tracks: [] } };
  const audio = structuredClone(base); audio.audio.tracks = [];
  audio.scenes[0].narration_text = 'New voice text'; audio.scenes[0].narration_refs = ['new'];
  expect(visualProjectionOfCompositionManifest(audio)).toBe(visualProjectionOfCompositionManifest(base));
  audio.scenes[0].duration = 9;
  expect(visualProjectionOfCompositionManifest(audio)).not.toBe(visualProjectionOfCompositionManifest(base));
  audio.scenes[0].duration = 10; audio.scenes[0].approved_copy = ['Goodbye'];
  expect(visualProjectionOfCompositionManifest(audio)).not.toBe(visualProjectionOfCompositionManifest(base));
});
it('removing a declarative audio line preserves the indentation of adjacent visual markup', () => {
  const html = '<main data-composition-id="main">\n  <h1>Hello</h1>\n  </main>';
  const withAudio = html.replace('  </main>', '    <audio data-start="0" src="voice.mp3"></audio>\n  </main>');
  expect(normalizeCompositionHtmlForVisualIdentity(withAudio)).toBe(normalizeCompositionHtmlForVisualIdentity(html));
});
it('provides scene-relative fixes for numeric tween positions without changing existing relative expressions', () => {
  const found = authoredAbsoluteTimelinePositions('<script>tl.to("#a", {x: 4}, 5.2); tl.to("#b", {x: 2}, S("two") + 1);</script>', [{ id: 'one', start: 0, duration: 5 }, { id: 'two', start: 5, duration: 5 }]);
  expect(found).toHaveLength(1);
  expect(found[0]).toMatchObject({ seconds: 5.2, suggestion: 'S("two") + 0.2', scene_id: 'two' });
});
