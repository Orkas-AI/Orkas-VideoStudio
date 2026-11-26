import { createServer } from 'node:http';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { resample, speak, wavBytes } from './media.mjs';

export const NARRATION_PILOT_HZ = 11600;

export async function startVoice(directory, { language, limit = 12 } = {}) {
  const requests = [];
  let attempted = 0;
  const server = createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/v1/audio/speech') {
      response.writeHead(404).end();
      return;
    }
    const sequence = ++attempted;
    try {
      if (sequence > limit) throw new Error('Fixture request limit reached');
      let body = '';
      for await (const chunk of request) {
        body += chunk;
        if (body.length > 4096) throw new Error('Fixture request too large');
      }
      const parsed = JSON.parse(body);
      if (typeof parsed.input !== 'string' || !parsed.input.trim() || parsed.input.length > 800
        || parsed.response_format !== 'wav') throw new Error('Expected fixture WAV speech input');
      const text = parsed.input.trim();
      const voice = language === 'tr' ? 'Yelda' : /[\u3400-\u9fff]/u.test(text) ? 'Tingting' : 'Samantha';
      const pcm = resample(await speak(text, voice), 44100);
      // Retain a quiet pilot outside the fixture's speech band for delivered-mix evidence.
      for (let i = 0; i < pcm.samples.length; i += 1) {
        pcm.samples[i] = pcm.samples[i] * 0.97 + 0.02 * Math.sin(2 * Math.PI * NARRATION_PILOT_HZ * i / pcm.rate);
      }
      const bytes = wavBytes(pcm);
      const file = join(directory, `voice-${sequence}.wav`);
      await writeFile(file, bytes, { flag: 'wx', mode: 0o600 });
      const duration = pcm.samples.length / pcm.rate;
      const audio = { path: file, sha256: createHash('sha256').update(bytes).digest('hex') };
      requests.push({ text, file, duration, seconds: duration, audio });
      response.writeHead(200, { 'Content-Type': 'audio/wav' }).end(bytes);
    } catch {
      if (!response.destroyed && !response.headersSent) response.writeHead(422).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    requests,
    attempted: () => attempted,
    baseUrl: `http://127.0.0.1:${server.address().port}/v1`,
    close: () => new Promise(resolve => {
      server.close(resolve);
      server.closeAllConnections();
    }),
  };
}
