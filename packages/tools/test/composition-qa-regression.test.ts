import { expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runAudioTimingQa, runContractHtmlQa, type CompositionMeta } from '../src/render/composition-qa.js';
const load = (value: unknown) => ({ path: 'composition-manifest.json', exists: true, value });
it('music/SFX ownership does not create a phantom narration requirement', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ovs-sfx-'));
  try {
    const meta: CompositionMeta = { htmlPath: join(dir, 'index.html'), html: '', rootAttrs: {}, id: 'main', width: 1920, height: 1080, durationSec: 10, audioTracks: [{ absPath: 'sfx.wav', startSec: 0, volume: 1 }] };
    const sceneMap = load({ audio: { owner: 'composition' }, scenes: [{ id: 'one', start: 0, duration: 10, narration_text: '' }] });
    const result = await runAudioTimingQa(meta, sceneMap, sceneMap, { path: 'narration-map.json', exists: false, value: null }, dir);
    expect(result).toMatchObject({ ok: true, narration_required: false });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
it('recognizes CJK copy split across elements and requires promised caption evidence', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ovs-copy-'));
  try {
    const meta: CompositionMeta = { htmlPath: join(dir, 'index.html'), html: '<main data-composition-id="main"><section class="clip" data-scene-id="one" data-start="0" data-duration="10"><h1 data-role="title"><span>生成</span><span>视频</span></h1></section></main>', rootAttrs: {}, id: 'main', width: 1920, height: 1080, durationSec: 10, audioTracks: [] };
    const sceneMap = load({ canvas: { width: 1920, height: 1080, duration: 10, caption_mode: 'on' }, scenes: [{ id: 'one', start: 0, duration: 10, approved_copy: ['生成视频'] }] });
    const result = await runContractHtmlQa(meta, [], load(null), sceneMap, dir);
    const codes = (result.issues as Array<{ code: string }>).map((i) => i.code);
    expect(codes).not.toContain('HTML_MISSING_SCENE_COPY');
    expect(codes).toContain('DELIVERY_CAPTIONS_MISSING');
    writeFileSync(join(dir, 'captions.srt'), '1\n00:00:00,000 --> 00:00:01,000\n生成视频');
    const fixed = await runContractHtmlQa(meta, [], load(null), sceneMap, dir);
    expect((fixed.issues as Array<{ code: string }>).map((i) => i.code)).not.toContain('DELIVERY_CAPTIONS_MISSING');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
