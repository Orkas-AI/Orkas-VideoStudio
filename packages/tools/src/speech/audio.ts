import { mkdtemp, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveFfmpegTools, runOk } from '@orkas/video-studio-core';
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
function pcmFromWav(audio: Buffer): Buffer | undefined {
  if (audio.length < 44 || audio.length > MAX_AUDIO_BYTES || audio.toString('ascii', 0, 4) !== 'RIFF'
    || audio.toString('ascii', 8, 12) !== 'WAVE') return undefined;
  let validFormat = false;
  for (let offset = 12; offset + 8 <= audio.length;) {
    const size = audio.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (size > audio.length - start) return undefined;
    const kind = audio.toString('ascii', offset, offset + 4);
    if (kind === 'fmt ' && size >= 16) validFormat = audio.readUInt16LE(start) === 1
      && audio.readUInt16LE(start + 2) === 1 && audio.readUInt32LE(start + 4) === 24000
      && audio.readUInt16LE(start + 14) === 16;
    if (kind === 'data') return validFormat && size > 0 && size % 2 === 0 ? audio.subarray(start, start + size) : undefined;
    offset = start + size + (size % 2);
  }
  return undefined;
}

export function wrapPcm16MonoWav(audio: Buffer, sampleRate = 24000): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + audio.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(audio.length, 40);
  return Buffer.concat([header, audio]);
}

export async function convertTtsWav(audio: Buffer, format: string, signal?: AbortSignal): Promise<Buffer | undefined> {
  const pcm = pcmFromWav(audio);
  if (!pcm) return undefined;
  if (format === 'wav') return audio;
  if (format === 'pcm') return pcm;
  if (!['mp3', 'opus'].includes(format)) return undefined;
  const root = await mkdtemp(join(tmpdir(), 'ovs-voice-'));
  try {
    const input = join(root, 'voice.wav'), output = join(root, `voice.${format}`);
    await writeFile(input, audio, { flag: 'wx' });
    await runOk(resolveFfmpegTools().ffmpeg, ['-hide_banner', '-nostdin', '-loglevel', 'error', '-i', input, '-vn', '-c:a', format === 'mp3' ? 'libmp3lame' : 'libopus', '-fs', String(MAX_AUDIO_BYTES + 1), output], { signal, timeoutMs: 30_000, maxBuffer: 64 * 1024 });
    if ((await stat(output)).size > MAX_AUDIO_BYTES) throw new Error('Converted speech exceeds the audio limit.');
    return await readFile(output);
  } finally { await rm(root, { recursive: true, force: true }); }
}
