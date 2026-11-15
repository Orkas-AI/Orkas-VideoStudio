import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { phrases, beats, activity } from '../src/analyze/current.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function silentRecording() {
  const root = mkdtempSync(join(tmpdir(), 'ovs-analyze-')); roots.push(root);
  const pcm = Buffer.alloc(44 + 16000 * 2 * 8);
  pcm.write('RIFF'); pcm.writeUInt32LE(pcm.length - 8, 4); pcm.write('WAVEfmt ', 8); pcm.writeUInt32LE(16, 16);
  pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22); pcm.writeUInt32LE(16000, 24); pcm.writeUInt32LE(32000, 28);
  pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(pcm.length - 44, 40);
  writeFileSync(join(root, 'quiet.wav'), pcm);
  return { root, input: join(root, 'quiet.wav') };
}

describe('measured analysis adapters', () => {
  it('reports no invented beats for silent sound', async () => {
    const { input } = silentRecording();
    expect(await beats({ input })).toMatchObject({ steady: false, durationSec: 8 });
  });
  it('retains a phrase transcript and identifies its actual timing detail', async () => {
    const { input, root } = silentRecording();
    const transcript = join(root, 'transcript.json');
    writeFileSync(transcript, JSON.stringify({ segments: [{ text: 'A complete thought.', start: 1, end: 2 }] }));
    const result = await phrases({ input, transcript });
    expect(result.timing).toBe('segment');
    expect(result.phrases[0].text).toBe('A complete thought.');
    expect(result.note).toMatch(/recognition/);
    writeFileSync(transcript, JSON.stringify({ words: [{ text: 'hello', start: 0, end: 1 }] }));
    expect((await phrases({ input, transcript })).timing).toBe('word');
  });
  it('rejects invalid regions and unbounded windows before opening the media', async () => {
    await expect(activity({ input: 'missing', regions: [] })).rejects.toThrow(/1 to 4/);
    await expect(activity({ input: 'missing', regions: [{ box: [0, 0, 1, 1] }], window_sec: 0 })).rejects.toThrow(/positive finite/);
  });
});
