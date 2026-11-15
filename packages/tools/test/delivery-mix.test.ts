import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { narrationOverSpeechIssues } from '../src/render/mix-evidence.js';
import { transcribe } from '../src/analyze/analyze.js';
vi.mock('../src/analyze/analyze.js', () => ({ transcribe: vi.fn() }));
afterEach(() => vi.resetAllMocks());
it('checks actual narration over original dialogue, and treats changed or missing evidence as unknown', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ovs-mix-evidence-'));
  try {
    const base = join(root, 'base.mp4'), video = join(root, 'mixed.mp4');
    await writeFile(base, 'base-bytes'); await writeFile(video, 'output-bytes');
    const sha = async (p: string) => createHash('sha256').update(await readFile(p)).digest('hex');
    const sidecar = join(root, '.mixed.mp4.narration.json');
    await writeFile(sidecar, JSON.stringify({ kind: 'orkas-mix-narration', version: 1, output: { sha256: await sha(video) }, base: { path: base, sha256: await sha(base) }, lines: [{ index: 1, start: .2, end: 1.5 }] }));
    vi.mocked(transcribe).mockResolvedValue({ words: [{ word: 'Original', start: 0, end: 1 }, { word: 'dialogue', start: 1, end: 2 }] });
    expect(await narrationOverSpeechIssues(video, root, undefined, true)).toEqual([expect.objectContaining({ code: 'DELIVERY_NARRATION_OVER_SPEECH' })]);
    await writeFile(base, 'replaced');
    expect(await narrationOverSpeechIssues(video, root, undefined, true)).toEqual([expect.objectContaining({ code: 'DELIVERY_NARRATION_UNVERIFIABLE' })]);
    await rm(sidecar);
    expect(await narrationOverSpeechIssues(video, root, undefined, true)).toEqual([expect.objectContaining({ code: 'DELIVERY_NARRATION_UNVERIFIABLE' })]);
    expect(await narrationOverSpeechIssues(video, root, undefined, false)).toEqual([]);
    expect(transcribe).toHaveBeenCalledTimes(1);
  } finally { await rm(root, { recursive: true, force: true }); }
});
