import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { phrases, beats, activity } from '../src/analyze/current.js';
import { transcribe } from '../src/analyze/analyze.js';
import * as hyperframes from '../src/hyperframes/client.js';

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
  it('writes the measured HyperFrames word timings for downstream phrase selection', async () => {
    const { input, root } = silentRecording();
    const runner = join(root, 'transcribe.cjs');
    const output = join(root, 'words.json');
    writeFileSync(runner, `
      const { writeFileSync } = require('node:fs');
      const { join, dirname } = require('node:path');
      const args = process.argv.slice(2);
      const dir = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : dirname(args[0]);
      const transcriptPath = join(dir, 'transcript.json');
      writeFileSync(transcriptPath, JSON.stringify([{ text: 'hello', start: 1, end: 2 }]));
      console.log(JSON.stringify({ ok: true, engine: 'whisper', wordCount: 1, transcriptPath }));
    `);
    const invocation = vi.spyOn(hyperframes, 'resolveHyperframesInvocation')
      .mockImplementation((_op, args) => ({ command: process.execPath, args: [runner, ...args], source: 'override' }));
    try {
      expect(await transcribe({ input, output })).toMatchObject({
        path: output,
        transcript: { wordCount: 1, words: [{ text: 'hello', startSec: 1, endSec: 2 }] },
      });
      const result = await phrases({ input, transcript: output });
      expect(result.timing).toBe('word');
      expect(result.phrases[0].text).toBe('hello');
    } finally {
      invocation.mockRestore();
    }
  });

  it('preserves Chinese token timing across pauses through the packaged HyperFrames normalizer', async () => {
    const { root, input } = silentRecording();
    const raw = join(root, 'whisper.json');
    const output = join(root, 'words.json');
    const token = (text: string, from: number, to: number) => ({ text, offsets: { from, to } });
    writeFileSync(raw, JSON.stringify({
      transcription: [{ tokens: [
        token(' 大家', 300, 650), token('好', 650, 900), token('。', 900, 950),
        token('嗯', 1700, 1840), token('再来', 2400, 2780), token('一次', 2780, 3150),
      ] }],
    }));
    expect(await transcribe({ input: raw, output })).toMatchObject({
      transcript: { words: [
        { text: '大家', startSec: 0.3, endSec: 0.65 }, { text: '好。', startSec: 0.65, endSec: 0.95 },
        { text: '嗯', startSec: 1.7, endSec: 1.84 }, { text: '再来', startSec: 2.4, endSec: 2.78 },
        { text: '一次', startSec: 2.78, endSec: 3.15 },
      ] },
    });
    expect((await phrases({ input, transcript: output })).phrases.length).toBeGreaterThan(1);
  });
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
