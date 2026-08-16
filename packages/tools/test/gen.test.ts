import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { existsSync, readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '@orkas/video-studio-core';
import { speak, buildOpenAITtsRequest, capabilities as speechCapabilities } from '../src/speech/speech';
import {
  generateImage,
  buildOpenAIImageRequest,
  buildGeminiImageRequest,
  compileImagePromptContract,
  normalizeImageReferenceBindings,
} from '../src/image/image';
import { generateVideo, buildAtlasCreateRequest, buildMuapiCreateRequest, buildSeedanceCreateRequest, validateDownloadedVideo } from '../src/video/video';

const VALID_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
const VALID_MP4 = Buffer.from('00000018667479706d703432000000006d70343269736f6d', 'hex');

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

  it('compiles a provider-neutral image reference and negative prompt contract', () => {
    const bindings = normalizeImageReferenceBindings(
      [{ index: 0, role: 'identity', strength: 0.8, preserve: ['face'], may_change: ['lighting'] }],
      1,
    );
    expect(compileImagePromptContract('Editorial portrait', bindings, ['watermark'])).toContain(
      'Reference 1: role=identity; strength=0.80; preserve=face; may change=lighting',
    );
    expect(() => normalizeImageReferenceBindings([], -1)).toThrow(/non-negative integer/);
    expect(() => normalizeImageReferenceBindings([{ index: 1, role: 'style' }], 1)).toThrow(/outside/);
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

  it('builds MuAPI text-to-video and image-to-video requests with endpoint overrides', () => {
    const t2v = buildMuapiCreateRequest(
      { provider: 'muapi', api_key: 'mu-key' },
      { prompt: 'a dog running', output: 'out.mp4' },
    );
    expect(t2v.url).toBe('https://api.muapi.ai/api/v1/kling-v2.1-master-t2v');
    expect(t2v.headers['x-api-key']).toBe('mu-key');
    expect(t2v.body).toMatchObject({ prompt: 'a dog running', aspect_ratio: '16:9', duration: 5 });
    expect(t2v.body).not.toHaveProperty('image_url');

    const i2v = buildMuapiCreateRequest(
      { provider: 'muapi', api_key: 'mu-key', base_url: 'https://example.test/api/v1', model: 'custom-i2v' },
      { prompt: 'gentle camera movement', output: 'out.mp4', image_url: 'https://example.test/frame.png', ratio: '9:16', duration: 8 },
    );
    expect(i2v.url).toBe('https://example.test/api/v1/custom-i2v');
    expect(i2v.body).toMatchObject({ prompt: 'gentle camera movement', aspect_ratio: '9:16', duration: 8, image_url: 'https://example.test/frame.png' });

    expect(() => buildMuapiCreateRequest(
      { provider: 'muapi', api_key: 'mu-key', model: 'custom-t2v' },
      { prompt: 'animate this', output: 'out.mp4', image_url: 'https://example.test/frame.png' },
    )).toThrow(/text-to-video/);
  });

  it('builds video edit requests with bounded source-video references', () => {
    const request = buildSeedanceCreateRequest(
      { api_key: 'k' },
      {
        prompt: 'Preserve subject identity and tighten the cut',
        output: 'o.mp4',
        operation: 'edit',
        quality: 'quality',
        reference_video_urls: ['https://x/source.mp4'],
      },
    );
    expect(request.body).not.toHaveProperty('operation');
    expect(request.body).not.toHaveProperty('quality');
    expect(request.body.content).toEqual([
      { type: 'text', text: 'Preserve subject identity and tighten the cut' },
      { type: 'video_url', role: 'reference_video', video_url: { url: 'https://x/source.mp4' } },
    ]);
    expect(() => buildSeedanceCreateRequest(
      { api_key: 'k' },
      { prompt: 'edit', output: 'o.mp4', operation: 'edit' },
    )).toThrow(/requires at least one reference video/);
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

  it('rejects a successful non-audio response without saving it or leaking the endpoint', async () => {
    const srv = await startServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'secret provider detail' }));
    });
    const out = join(dir, 'not-audio.mp3');
    try {
      await expect(
        speak({ text: 'hello', output: out }, { tts: { base_url: `${srv.baseUrl}/private-token`, api_key: 'sk-secret' } }),
      ).rejects.toThrow(/non-audio response/);
      expect(existsSync(out)).toBe(false);
    } finally {
      await srv.close();
    }
  });
});

describe('generateImage (OpenAI-compatible)', () => {
  it('decodes b64_json and writes the image', async () => {
    const png = VALID_PNG;
    const srv = await startServer((req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ data: [{ b64_json: png.toString('base64') }] }));
    });
    try {
      const out = join(dir, 'img.png');
      const r = await generateImage({ prompt: 'a red cube', output: out }, { image: { provider: 'openai', base_url: srv.baseUrl, api_key: 'sk', model: 'gpt-image-1' } });
      expect(readFileSync(r.output)).toEqual(VALID_PNG);
      expect(r).toMatchObject({ mime_type: 'image/png', width: 1, height: 1 });
      expect(JSON.parse(srv.requests[0]!.body)).toMatchObject({ model: 'gpt-image-1', prompt: 'a red cube', size: '1024x1024' });
    } finally {
      await srv.close();
    }
  });

  it('rejects malformed provider bytes without saving an image', async () => {
    const srv = await startServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ data: [{ b64_json: Buffer.from('<html>ok</html>').toString('base64') }] }));
    });
    const out = join(dir, 'invalid.png');
    try {
      await expect(
        generateImage({ prompt: 'bad', output: out }, { image: { provider: 'openai', base_url: srv.baseUrl, api_key: 'sk' } }),
      ).rejects.toThrow(/invalid or unsupported image bytes/);
      expect(existsSync(out)).toBe(false);
    } finally {
      await srv.close();
    }
  });

  it('sends local reference bytes and their structured binding through Gemini', async () => {
    const reference = join(dir, 'reference.png');
    writeFileSync(reference, VALID_PNG);
    const srv = await startServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        candidates: [{ content: { parts: [{ inlineData: { data: VALID_PNG.toString('base64') } }] } }],
      }));
    });
    try {
      const out = join(dir, 'gemini.png');
      await generateImage(
        {
          prompt: 'Keep the subject',
          output: out,
          reference_images: [reference],
          reference_bindings: [{ index: 0, role: 'identity', preserve: ['face'] }],
          negative_prompt: ['watermark'],
        },
        { image: { provider: 'gemini', base_url: srv.baseUrl, api_key: 'gk', model: 'gemini-test' } },
      );
      const body = JSON.parse(srv.requests[0]!.body);
      expect(body.contents[0].parts[0].inlineData.data).toBe(VALID_PNG.toString('base64'));
      expect(body.contents[0].parts.at(-1).text).toContain('role=identity');
      expect(body.contents[0].parts.at(-1).text).toContain('Avoid: watermark');
    } finally {
      await srv.close();
    }
  });
});

describe('generateVideo (Doubao Seedance task + poll)', () => {
  it('creates a task, polls until succeeded, and downloads the result', async () => {
    let polls = 0;
    const vid = VALID_MP4;
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
      expect(readFileSync(r.output)).toEqual(VALID_MP4);
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
      ).rejects.toThrow(/task t2 failed/);
    } finally {
      await srv.close();
    }
  });

  it('rejects malformed downloaded video bytes before writing', () => {
    expect(() => validateDownloadedVideo(Buffer.from('<html>expired</html>'))).toThrow(/invalid or unsupported MP4/);
  });
});

describe('generateVideo (Atlas Cloud task + poll)', () => {
  it('defaults the model by task type: image-to-video when a first frame is passed', () => {
    const req = buildAtlasCreateRequest(
      { provider: 'atlas', api_key: 'atlas-key' },
      { prompt: 'a sunrise', output: 'out.mp4', image_url: 'https://example.com/first.png' },
    );
    expect(req.url).toBe('https://api.atlascloud.ai/api/v1/model/generateVideo');
    expect(req.headers.authorization).toBe('Bearer atlas-key');
    expect(req.body).toMatchObject({
      // The text-to-video model's schema has no `image` field — a first frame
      // must select the image-to-video model, or it is silently ignored.
      model: 'bytedance/seedance-2.0/image-to-video',
      prompt: 'a sunrise',
      image: 'https://example.com/first.png',
      duration: 5,
      resolution: '720p',
      ratio: '16:9',
    });
  });

  it('defaults to text-to-video without a first frame', () => {
    const req = buildAtlasCreateRequest(
      { provider: 'atlas', api_key: 'atlas-key' },
      { prompt: 'a sunrise', output: 'out.mp4' },
    );
    expect(req.body).toMatchObject({ model: 'bytedance/seedance-2.0/text-to-video' });
    expect(req.body).not.toHaveProperty('image');
  });

  it('fails closed on an explicit model/task mismatch instead of shipping the wrong video', () => {
    expect(() => buildAtlasCreateRequest(
      { provider: 'atlas', api_key: 'atlas-key', model: 'bytedance/seedance-2.0/text-to-video' },
      { prompt: 'a sunrise', output: 'out.mp4', image_url: 'https://example.com/first.png' },
    )).toThrow(/image-to-video/);
    expect(() => buildAtlasCreateRequest(
      { provider: 'atlas', api_key: 'atlas-key', model: 'bytedance/seedance-2.0/image-to-video' },
      { prompt: 'a sunrise', output: 'out.mp4' },
    )).toThrow(/requires a first-frame image_url/);
  });

  it('creates, polls, and downloads an Atlas Cloud result', async () => {
    const srv = await startServer((req, res) => {
      const url = req.url ?? '';
      if (req.method === 'POST' && url === '/model/generateVideo') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ code: 200, data: { id: 'atlas-1', status: 'starting' } }));
      } else if (req.method === 'GET' && url === '/model/prediction/atlas-1') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ code: 200, data: { id: 'atlas-1', status: 'completed', outputs: [`${srv.baseUrl}/atlas.mp4`] } }));
      } else if (req.method === 'GET' && url === '/atlas.mp4') {
        res.writeHead(200, { 'content-type': 'video/mp4' });
        res.end(VALID_MP4);
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    try {
      const result = await generateVideo(
        { prompt: 'a sunrise', output: join(dir, 'atlas.mp4') },
        { video: { provider: 'atlas', base_url: srv.baseUrl, api_key: 'atlas-key' } },
        { pollIntervalMs: 1 },
      );
      expect(result.task_id).toBe('atlas-1');
      expect(readFileSync(result.output)).toEqual(VALID_MP4);
    } finally {
      await srv.close();
    }
  });
});

describe('generateVideo (MuAPI task + poll)', () => {
  it('creates a task, polls until completed, and downloads the result', async () => {
    let polls = 0;
    const srv = await startServer((req, res) => {
      const url = req.url ?? '';
      if (req.method === 'POST' && url === '/custom-t2v') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ request_id: 'mu-1', status: 'processing' }));
      } else if (req.method === 'GET' && url === '/predictions/mu-1/result') {
        polls += 1;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(polls < 2 ? { status: 'processing' } : { status: 'completed', outputs: [`${srv.baseUrl}/mu.mp4`] }));
      } else if (req.method === 'GET' && url === '/mu.mp4') {
        res.writeHead(200, { 'content-type': 'video/mp4' });
        res.end(VALID_MP4);
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    try {
      const out = join(dir, 'muapi.mp4');
      const result = await generateVideo(
        { prompt: 'a dog running', output: out, ratio: '9:16', duration: 8 },
        { video: { provider: 'muapi', base_url: srv.baseUrl, api_key: 'mu-key', model: 'custom-t2v' } },
        { pollIntervalMs: 1 },
      );
      expect(result.task_id).toBe('mu-1');
      expect(polls).toBe(2);
      expect(readFileSync(result.output)).toEqual(VALID_MP4);
      const create = srv.requests.find((x) => x.method === 'POST')!;
      expect(create.headers['x-api-key']).toBe('mu-key');
      expect(create.headers.authorization).toBeUndefined();
      expect(JSON.parse(create.body)).toMatchObject({ prompt: 'a dog running', aspect_ratio: '9:16', duration: 8 });
    } finally {
      await srv.close();
    }
  });

  it('surfaces a MuAPI task failure without writing an output', async () => {
    const srv = await startServer((req, res) => {
      if (req.method === 'POST') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ request_id: 'mu-2' }));
      } else if (req.url === '/predictions/mu-2/result') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'failed', error: 'content policy' }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    const out = join(dir, 'muapi-failed.mp4');
    try {
      await expect(
        generateVideo(
          { prompt: 'unsafe', output: out },
          { video: { provider: 'muapi', base_url: srv.baseUrl, api_key: 'mu-key', model: 'custom-t2v' } },
          { pollIntervalMs: 1 },
        ),
      ).rejects.toThrow(/task mu-2 failed: content policy/);
      expect(existsSync(out)).toBe(false);
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

  it('selects MuAPI from MUAPI_API_KEY when no video provider is otherwise configured', () => {
    const prev = { ...process.env };
    process.env.OVS_CONFIG_DIR = dir;
    delete process.env.OVS_VIDEO_PROVIDER;
    delete process.env.OVS_VIDEO_API_KEY;
    process.env.MUAPI_API_KEY = 'mu-key';
    try {
      const c = loadConfig();
      expect(c.video).toMatchObject({ provider: 'muapi', api_key: 'mu-key' });

      const configDir = mkdtempSync(join(tmpdir(), 'ovs-muapi-config-'));
      try {
        writeFileSync(join(configDir, 'config.json'), JSON.stringify({ video: { provider: 'muapi' } }));
        process.env.OVS_CONFIG_DIR = configDir;
        expect(loadConfig().video).toMatchObject({ provider: 'muapi', api_key: 'mu-key' });
      } finally {
        rmSync(configDir, { recursive: true, force: true });
      }
    } finally {
      for (const k of ['OVS_CONFIG_DIR', 'OVS_VIDEO_PROVIDER', 'OVS_VIDEO_API_KEY', 'MUAPI_API_KEY']) {
        if (prev[k] === undefined) delete process.env[k];
        else process.env[k] = prev[k];
      }
    }
  });
});
