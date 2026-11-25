import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = (name: string) => readFileSync(join(root, name, 'SKILL.md'), 'utf8');
function docs(dir = root): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() ? docs(join(dir, d.name)) : d.name.endsWith('.md') ? [join(dir, d.name)] : []);
}
describe('portable current production guidance', () => {
  it('starts with the current workflow and preserves script-only and long-production endpoints', () => {
    const main = read('video-studio');
    expect(main).toContain('Script or storyboard only');
    expect(main).toContain('Do not generate media');
    expect(main).toContain('2 minutes');
    // 2026-11-24: "a video that must follow an exact script shows the script first" stopped short
    // videos made from the user's own script; only a script the Agent writes for a long one is shown.
    expect(main).toContain('If it must follow a script you write word for word, show that script first instead. A script the user gave is theirs: make it as written, without showing it back.');
    expect(main).not.toContain('must follow an exact script shows the script first');
    expect(main).toContain('ovs timeline ship');
    expect(main).toContain('Do not present a plan or preview for approval');
    expect(readFileSync(join(root, '../../AGENTS.md'), 'utf8')).toContain('video-studio');
  });
  it('keeps metered access authority explicit and never treats keys as permission', () => {
    const budget = readFileSync(join(root, 'video-studio/references/generation.md'), 'utf8');
    for (const field of ['provider', 'model', 'purpose', 'request', 'retry', 'cost']) expect(budget).toContain(field);
    expect(budget).toContain('Credentials are not spending authority');
    expect(read('video-studio')).toContain('specific alternative');
  });
  it('teaches the real timeline, per-line speech and cheapest local revisions', () => {
    const timeline = readFileSync(join(root, 'video-studio/references/timeline.md'), 'utf8');
    expect(timeline).toContain('schema_version'); expect(timeline).toContain('data-slot');
    for (const op of ['prepare', 'check', 'snapshot', 'render', 'ship', 'import']) expect(timeline).toContain(`ovs timeline ${op}`);
    const edit = read('stage-edit');
    for (const op of ['ovs edit extract-frame', 'ovs edit normalize-loudness', 'ovs narration fit', 'ovs speech-capabilities', '--on-existing-audio replace', '--narration']) expect(edit).toContain(op);
    expect(read('stage-decide')).toContain('ovs edit select');
    expect(read('stage-decide')).toContain('selection-id');
  });
  it('captions a recording from its transcript and revises only the narration that changed', () => {
    const flat = (name: string) => readFileSync(join(root, name), 'utf8').replace(/\s+/g, ' ');
    // 2026-11-24: a talk to camera with a few misheard words stopped three turns asking for the script.
    expect(read('video-studio')).toContain('The words spoken in a recording are not such a fact: caption them from the transcript, which is not inventing them, and name in your reply any you were unsure of.');
    expect(flat('stage-edit/references/transcript-and-screen-grounded-editing.md')).toContain('With neither, correct what the sentence around a word makes plain (坑 heard as 康) and keep the rest as heard; do not stop to ask the user for a script.');
    // 2026-11-25: a recap revision remixed the last delivery, so the replaced voice was still heard.
    expect(flat('video-craft/references/commentary.md')).toMatch(/before adding narration[^.]*`render\/pre-narration\.mp4`/);
    const edit = read('stage-edit').replace(/\s+/g, ' ');
    expect(edit).toMatch(/narration-only recap revision[^.]*pre-narration cut[^.]*original dialogue/i);
    expect(edit).toMatch(/reuse unchanged voice files at their existing offsets[^.]*replace only the changed/i);
    // 2026-11-23: an ad's price correction revoices only the changed words, on a whole-video narration track.
    expect(flat('video-studio/references/audio.md')).toContain('For a change to specific words, such as a price, start from the saved script and replace only those words.');
    expect(flat('video-studio/references/timeline.md')).toContain('{ "kind": "narration", "asset": "voice-all", "volume": 1 }');
  });
  // 2026-11-24: a length other than the one asked for is advice at delivery; the Agent decides.
  it('passes the requested length as advice and keeps a music cut on its beats', () => {
    const deliver = read('video-studio').split('## Check and deliver')[1]?.split('## Revise')[0] ?? '';
    expect(deliver).toMatch(/pass the user's requested length if known for either path/i);
    expect(deliver).toMatch(/decide whether to keep or recut an off-target version/);
    expect(deliver).not.toContain('supply `--expect` with `durationSec`');
    const music = readFileSync(join(root, 'video-craft/references/music-cut.md'), 'utf8').replace(/\s+/g, ' ');
    expect(music).toMatch(/Keep that beat timing when reviewing a duration warning/);
    expect(music).not.toContain('not the round number asked for');
  });
  it('keeps old skill names and their opt-in legacy APIs available', () => {
    for (const name of ['video-router', 'orchestration', 'gate-control', 'stage-plan', 'stage-assemble', 'stage-generate', 'stage-consistency', 'stage-compose', 'composition-design-review']) expect(existsSync(join(root, name, 'SKILL.md'))).toBe(true);
    expect(read('gate-control')).toContain('explicitly');
    expect(read('stage-compose')).toContain('ovs composition prepare');
    expect(read('stage-compose')).toContain('ovs draft');
    expect(existsSync(join(root, 'stage-compose/scripts/composition.mjs'))).toBe(true);
  });
  it('loads every referenced fragment locally and excludes commercial-host commands', () => {
    for (const path of docs()) {
      const body = readFileSync(path, 'utf8');
      for (const match of body.matchAll(/\]\(([^)]+\.md)(?:#[^)]*)?\)/g)) {
        if (/^https?:/.test(match[1])) continue;
        expect(existsSync(resolve(dirname(path), match[1])), `${path}: ${match[1]}`).toBe(true);
      }
      for (const token of ['ownerAgent:', '@skill/', 'video.request_budget', 'video.ship', 'video.check', 'generate_speech', 'run-skill', 'ORKAS_PC_DIR', '<plan-interaction']) expect(body, path).not.toContain(token);
    }
  });
  it('preserves reference/product fidelity, natural case and complete visual review', () => {
    expect(read('frontend-design')).toContain('sentence case');
    expect(read('composition-design-review')).toContain('complete reviewed frame set');
    const importer = read('design-system-importer');
    for (const intent of ['reproduce', 'edit', 'guide']) expect(importer).toContain(intent);
    expect(readFileSync(join(root, 'video-studio/references/product-fidelity.md'), 'utf8')).toContain('product');
    for (const ref of ['marketing', 'ecommerce', 'short-film', 'presenter', 'music-cut', 'commentary', 'explainer', 'product-source', 'reference-recreation']) expect(existsSync(join(root, 'video-craft/references', `${ref}.md`))).toBe(true);
  });
});
