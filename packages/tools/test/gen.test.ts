import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '@orkas/video-studio-core';
import { speak, buildOpenAITtsRequest, capabilities as speechCapabilities } from '../src/speech/speech';
import { generateImage, buildOpenAIImageRequest, buildGeminiImageRequest } from '../src/image/image';
import { generateVideo, buildSeedanceCreateRequest } from '../src/video/video';

interface Captured {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

async function startServer(
  handler: (req: IncomingMessage, res: ServerResponse, body: string, captured: Captured[]) => void,
): Promise<{ baseUrl: string; requests: Captured[]; close: () => Promise<void> }> {
  const requests: Captured[] = [];
  const server: Server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      requests.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers, body });
      handler(req, res, body, requests);
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'ovs-gen-'));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

// --- request builders (pure) ----------------------------------------------

describe('request builders', () => {
  it('builds an OpenAI-compatible TTS request', () => {
    const r = buildOpenAITtsRequest({ base_url: 'https://api.x.com/v1', api_key: 'k', model: 'tts-1' }, { text: 'hi', output: 'o.mp3', voice: 'nova' });
    expect(r.url).toBe('https://api.x.com/v1/audio/speech');
    expect(r.headers.authorization).toBe('Bearer k');
    expect(r.body).toMatchObject({ model: 'tts-1', input: 'hi', voice: 'nova', response_format: 'mp3' });
  });

  it('builds OpenAI vs Gemini image requests differently', () => {
    const openai = buildOpenAIImageRequest({ base_url: 'https://api.x.com/v1', api_key: 'k' }, { prompt: 'a cat', output: 'o.png' });
    expect(openai.url).toBe('https://api.x.com/v1/images/generations');
    expect(openai.headers.authorization).toBe('Bearer k');

    const gemini = buildGeminiImageRequest({ api_key: 'gk', model: 'gemini-2.0-flash-preview-image-generation' }, { prompt: 'a cat', output: 'o.png' });
    expect(gemini.url).toContain(':generateContent');
    expect(gemini.headers['x-goog-api-key']).toBe('gk');
    expect(gemini.body.contents).toBeDefined();
  });

  it('builds a Seedance task request, adding the image part only for image-to-video', () => {
    const t2v = buildSeedanceCreateRequest({ api_key: 'k' }, { prompt: 'a dog', output: 'o.mp4' });
    expect(t2v.url).toContain('/contents/generations/tasks');
    expect((t2v.body.content as unknown[]).length).toBe(1);

    const i2v = buildSeedanceCreateRequest({ api_key: 'k' }, { prompt: 'a dog', output: 'o.mp4', image_url: 'https://x/a.png' });
    expect((i2v.body.content as unknown[]).length).toBe(2);
  });

  it('preserves the exact Seedance production settings and reference images', () => {
    const request = buildSeedanceCreateRequest(
      { api_key: 'k' },
      {
        prompt: 'a dog',
        output: 'o.mp4',
        reference_image_urls: ['https://x/a.png', 'https://x/b.png'],
        ratio: '9:16',
        duration: 8,
        resolution: '1080p',
        generate_audio: false,
      },
    );
    expect(request.body).toMatchObject({ ratio: '9:16', duration: 8, resolution: '1080p', generate_audio: false, watermark: false });
    expect(request.body.content).toEqual([
      { type: 'text', text: 'a dog' },
      { type: 'image_url', image_url: { url: 'https://x/a.png' }, role: 'reference_image' },
      { type: 'image_url', image_url: { url: 'https://x/b.png' }, role: 'reference_image' },
    ]);
  });

  it('reports a safe TTS capability profile without exposing credentials', () => {
    const result = speechCapabilities({ tts: { base_url: 'https://api.x.com/v1', api_key: 'secret', model: 'tts-1' } });
    expect(result).toMatchObject({ configured: true, route_ref: 'openai-compatible', model: 'tts-1', format: 'mp3' });
    expect(JSON.stringify(result)).not.toContain('secret');
  });
});

// --- mock-server round-trips ----------------------------------------------

describe('speak (OpenAI-compatible TTS)', () => {
  it('posts the right request and writes the audio bytes', async () => {
    const audio = Buffer.from('FAKE-AUDIO-BYTES');
    const srv = await startServer((req, res) => {
      if (req.method === 'POST' && req.url === '/audio/speech') {
        res.writeHead(200, { 'content-type': 'audio/mpeg' });
        res.end(audio);
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    try {
      const out = join(dir, 'narration.mp3');
      const r = await speak({ text: 'hello world', output: out, voice: 'alloy' }, { tts: { base_url: srv.baseUrl, api_key: 'sk-x', model: 'tts-1' } });
      expect(r.bytes).toBe(audio.byteLength);
      expect(existsSync(out)).toBe(true);
      const req = srv.requests[0]!;
      expect(req.headers.authorization).toBe('Bearer sk-x');
      expect(JSON.parse(req.body)).toMatchObject({ model: 'tts-1', input: 'hello world', voice: 'alloy', response_format: 'mp3' });
    } finally {
      await srv.close();
    }
  });

  it('throws a clear error when no provider is configured', async () => {
    await expect(speak({ text: 'x', output: join(dir, 'x.mp3') }, {})).rejects.toThrow(/No TTS provider/);
  });
});

describe('generateImage (OpenAI-compatible)', () => {
  it('decodes b64_json and writes the image', async () => {
    const png = Buffer.from('PNG-BYTES');
    const srv = await startServer((req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ data: [{ b64_json: png.toString('base64') }] }));
    });
    try {
      const out = join(dir, 'img.png');
      const r = await generateImage({ prompt: 'a red cube', output: out }, { image: { provider: 'openai', base_url: srv.baseUrl, api_key: 'sk', model: 'gpt-image-1' } });
      expect(readFileSync(r.output).toString()).toBe('PNG-BYTES');
      expect(JSON.parse(srv.requests[0]!.body)).toMatchObject({ model: 'gpt-image-1', prompt: 'a red cube', size: '1024x1024' });
    } finally {
      await srv.close();
    }
  });
});

describe('generateVideo (Doubao Seedance task + poll)', () => {
  it('creates a task, polls until succeeded, and downloads the result', async () => {
    let polls = 0;
    const vid = Buffer.from('VIDEO-BYTES');
    const srv = await startServer((req, res, _body, _cap) => {
      const url = req.url ?? '';
      if (req.method === 'POST' && url === '/contents/generations/tasks') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ id: 't1' }));
      } else if (req.method === 'GET' && url === '/contents/generations/tasks/t1') {
        polls += 1;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(polls < 2 ? { status: 'running' } : { status: 'succeeded', content: { video_url: `${srv.baseUrl}/v.mp4` } }));
      } else if (req.method === 'GET' && url === '/v.mp4') {
        res.writeHead(200, { 'content-type': 'video/mp4' });
        res.end(vid);
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    try {
      const out = join(dir, 'gen.mp4');
      const r = await generateVideo({ prompt: 'a dog running', output: out }, { video: { provider: 'doubao', base_url: srv.baseUrl, api_key: 'sk' } }, { pollIntervalMs: 1 });
      expect(r.task_id).toBe('t1');
      expect(polls).toBe(2);
      expect(readFileSync(r.output).toString()).toBe('VIDEO-BYTES');
      const create = srv.requests.find((x) => x.method === 'POST')!;
      expect((JSON.parse(create.body).content as Array<{ type: string; text?: string }>)[0]).toMatchObject({ type: 'text', text: 'a dog running' });
    } finally {
      await srv.close();
    }
  });

  it('fails clearly when the task fails', async () => {
    const srv = await startServer((req, res) => {
      const url = req.url ?? '';
      if (req.method === 'POST') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ id: 't2' }));
      } else if (url.endsWith('/t2')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'failed', error: { message: 'content policy' } }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    try {
      await expect(
        generateVideo({ prompt: 'x', output: join(dir, 'f.mp4') }, { video: { provider: 'doubao', base_url: srv.baseUrl, api_key: 'sk' } }, { pollIntervalMs: 1 }),
      ).rejects.toThrow(/failed.*content policy/);
    } finally {
      await srv.close();
    }
  });
});

// --- config env overlay ----------------------------------------------------

describe('config env overlay', () => {
  it('reads image/video provider config from env', () => {
    const prev = { ...process.env };
    process.env.OVS_CONFIG_DIR = dir; // no config.json here → file part is empty
    process.env.OVS_IMAGE_PROVIDER = 'gemini';
    process.env.OVS_IMAGE_API_KEY = 'gk';
    process.env.OVS_VIDEO_PROVIDER = 'doubao';
    process.env.OVS_VIDEO_API_KEY = 'vk';
    try {
      const c = loadConfig();
      expect(c.image).toMatchObject({ provider: 'gemini', api_key: 'gk' });
      expect(c.video).toMatchObject({ provider: 'doubao', api_key: 'vk' });
    } finally {
      for (const k of ['OVS_CONFIG_DIR', 'OVS_IMAGE_PROVIDER', 'OVS_IMAGE_API_KEY', 'OVS_VIDEO_PROVIDER', 'OVS_VIDEO_API_KEY']) {
        if (prev[k] === undefined) delete process.env[k];
        else process.env[k] = prev[k];
      }
    }
  });
});
