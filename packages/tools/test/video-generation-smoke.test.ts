import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveBinaries, runOk } from '@orkas/video-studio-core';
import { probeMedia } from '../src/edit/edit';
import { generateVideo } from '../src/video/video';

const bins = resolveBinaries();
const requested = process.env.OVS_VIDEO_TEST === '1';
const hasVideoRuntime = Boolean(bins.ffmpeg && bins.ffprobe);
const suite = hasVideoRuntime || requested ? describe : describe.skip;

suite('video generation capability (real mp4 artifact)', () => {
  let dir: string;
  let fixture: string;
  let server: Server;
  let baseUrl: string;
  const createBodies: Array<Record<string, unknown>> = [];

  beforeAll(async () => {
    if (!bins.ffmpeg || !bins.ffprobe) {
      throw new Error('video capability test requires ffmpeg and ffprobe; run `ovs doctor` for installation guidance');
    }
    dir = mkdtempSync(join(tmpdir(), 'ovs-video-capability-'));
    fixture = join(dir, 'provider-result.mp4');
    await runOk(bins.ffmpeg, [
      '-y',
      '-f', 'lavfi',
      '-i', 'color=c=0x315efb:size=320x180:rate=24:duration=1',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      fixture,
    ]);

    server = createServer((req, res) => {
      const url = req.url ?? '';
      if (req.method === 'POST' && url === '/contents/generations/tasks') {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          createBodies.push(JSON.parse(body) as Record<string, unknown>);
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ id: 'video-capability-task' }));
        });
        return;
      }
      if (req.method === 'GET' && url === '/contents/generations/tasks/video-capability-task') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'succeeded', content: { video_url: `${baseUrl}/result.mp4` } }));
        return;
      }
      if (req.method === 'GET' && url === '/result.mp4') {
        const media = readFileSync(fixture);
        res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': media.byteLength });
        res.end(media);
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 120_000);

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('creates, polls and downloads a playable provider video', async () => {
    const output = join(dir, 'generated.mp4');
    const result = await generateVideo(
      {
        prompt: 'A deterministic blue diagnostic frame',
        output,
        ratio: '16:9',
        duration: 5,
        resolution: '720p',
        generate_audio: false,
      },
      { video: { provider: 'doubao', base_url: baseUrl, api_key: 'test-key', model: 'test-model' } },
      { pollIntervalMs: 1 },
    );

    expect(result).toMatchObject({ task_id: 'video-capability-task', output });
    expect(result.bytes).toBeGreaterThan(500);
    expect(existsSync(output)).toBe(true);
    expect(createBodies[0]).toMatchObject({
      model: 'test-model',
      ratio: '16:9',
      duration: 5,
      resolution: '720p',
      generate_audio: false,
      watermark: false,
    });

    const media = await probeMedia(output);
    expect(media.width).toBe(320);
    expect(media.height).toBe(180);
    expect(media.v_codec).toBe('h264');
    expect(media.has_audio).toBe(false);
    expect(media.duration).toBeGreaterThan(0.8);
    expect(media.duration).toBeLessThan(1.2);
  }, 120_000);
});
