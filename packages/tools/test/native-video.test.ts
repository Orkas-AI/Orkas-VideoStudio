import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { generateNativeVideo, nativeVideoRequest } from '../src/video/native.js';
describe('native BYO video contracts', () => {
  const cfg = (provider: string, model: string) => ({ provider, model, api_key: 'test-key', base_url: 'https://provider.invalid', workspace_id: 'studio', region: 'cn-beijing' } as any);
  const p = { prompt: 'Keep the product', output: 'result.mp4', duration: 5, ratio: '16:9', resolution: '720p' } as any;
  it('keeps first/last frames distinct from generic references and rejects unsupported combinations before dispatch', async () => {
    const seed = await nativeVideoRequest(cfg('doubao', 'doubao-seedance-2-5-flash'), { ...p, first_frame_url: 'https://media.invalid/first.png', last_frame_url: 'https://media.invalid/last.png' });
    expect(seed.body.model).toBe('doubao-seedance-2-5-flash-261115');
    expect(seed.body).not.toHaveProperty('omni_reference_task_type');
    expect(seed.body.content).toEqual(expect.arrayContaining([expect.objectContaining({ role: 'first_frame' }), expect.objectContaining({ role: 'last_frame' })]));
    await expect(nativeVideoRequest(cfg('runway', 'gen4.5'), { ...p, last_frame_url: 'https://media.invalid/end.png' })).rejects.toThrow(/first/);
    await expect(nativeVideoRequest(cfg('minimax', 'MiniMax-H3'), { ...p, first_frame_url: 'https://media.invalid/a.png', reference_image_urls: ['https://media.invalid/b.png'] })).rejects.toThrow(/combine/);
  });
  it('sends the native edit mode and automatic duration when editing source footage with Flash', async () => {
    const source = 'https://media.invalid/source.mp4';
    const request = await nativeVideoRequest(cfg('doubao', 'doubao-seedance-2-5-flash'), {
      prompt: 'Change the background', output: 'result.mp4', operation: 'edit', reference_video_urls: [source],
    });
    expect(request.body).toMatchObject({
      model: 'doubao-seedance-2-5-flash-261115', omni_reference_task_type: 'edit', duration: -1, ratio: 'adaptive',
      content: expect.arrayContaining([{ type: 'video_url', role: 'reference_video', video_url: { url: source } }]),
    });
  });
  it('pins Mini for Ark but rejects unsupported source edits before preparing media', async () => {
    const mini = await nativeVideoRequest(cfg('doubao', 'doubao-seedance-2-0-mini'), p);
    expect(mini.body.model).toBe('doubao-seedance-2-0-mini-260615');
    await expect(nativeVideoRequest(cfg('google', 'gemini-omni-1.1-flash'), {
      ...p, operation: 'edit', reference_video_urls: ['https://media.invalid/source.mp4'],
    }, undefined, false)).rejects.toThrow(/Editing requires a supported source video/);
  });
  it.each([
    ['minimax', 'MiniMax-H3', '/v2/video_generation'],
    ['vidu', 'viduq3-pro', '/ent/v2/text2video'],
    ['kling', 'kling-v4-0', '/text-to-video/kling-4.0'],
    ['runway', 'gen4.5', '/v1/text_to_video'],
    ['aliyun', 'wan3.0-video', '/services/aigc/video-generation/video-synthesis'],
  ])('uses %s native request and result envelopes', async (provider, model, suffix) => {
    const request = await nativeVideoRequest(cfg(provider, model), p);
    expect(request.url).toBe('https://provider.invalid' + suffix);
    expect(JSON.stringify(request.body)).toContain(p.prompt);
  });
  it('keeps an overlong request rejected rather than silently losing the end of its action', async () => {
    await expect(nativeVideoRequest(cfg('minimax', 'MiniMax-H3'), { ...p, duration: 30 })).rejects.toThrow(/duration/);
  });
});

import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveFfmpegTools, runOk } from '@orkas/video-studio-core';
import { probeMedia } from '../src/edit/edit.js';
let directory: string, mp4: Buffer;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'ovs-native-video-'));
  const file = join(directory, 'source.mp4');
  await runOk(resolveFfmpegTools().ffmpeg, ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=24:duration=2', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', file], { timeoutMs: 30_000 });
  mp4 = await readFile(file);
});
afterAll(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });
afterEach(() => vi.unstubAllGlobals());
it.each([
  ['minimax', 'MiniMax-H3', { task: { status: 'success', content: { url: 'https://media.invalid/result.mp4' } } }],
  ['vidu', 'viduq3-pro', { state: 'success', creations: [{ url: 'https://media.invalid/result.mp4' }] }],
  ['kling', 'kling-v4-0', { data: [{ id: 'task-one', status: 'completed', outputs: [{ type: 'video', url: 'https://media.invalid/result.mp4' }] }] }],
  ['runway', 'gen4.5', { status: 'SUCCEEDED', output: ['https://media.invalid/result.mp4'] }],
  ['aliyun', 'wan3.0-video', { output: { task_status: 'SUCCEEDED', video_url: 'https://media.invalid/result.mp4' } }],
])('tracks %s once, recovers a transient poll failure and downloads a probeable file without forwarding credentials', async (provider, model, completed) => {
  let creates = 0, polls = 0, downloads = 0;
  const fetch = vi.fn(async (url: any, init: any) => {
    if (String(url).startsWith('https://media.invalid')) { downloads++; expect(init.headers?.Authorization).toBeUndefined(); return new Response(mp4); }
    if (init.method === 'POST') { creates++; return Response.json({ id: 'task-one' }); }
    polls++; return polls === 1 ? new Response('', { status: 503 }) : Response.json(completed);
  }); vi.stubGlobal('fetch', fetch);
  const result = await generateNativeVideo({ prompt: 'Action', output: join(directory, provider + '.mp4'), duration: 2, ratio: '16:9', resolution: '720p' }, { provider, model, api_key: 'local-key', base_url: 'https://provider.invalid', workspace_id: 'studio', region: 'cn-beijing' } as any, { pollIntervalMs: 0 });
  expect(result.task_id).toBe('task-one'); expect(creates).toBe(1); expect(polls).toBe(2); expect(downloads).toBe(1);
  expect(await probeMedia(result.output)).toMatchObject({ v_codec: 'h264', width: expect.any(Number) });
});
it('refuses an existing native output before any paid dispatch and keeps its bytes', async () => {
  const output=join(directory,'keep-original.mp4'); await writeFile(output,mp4);
  const fetch=vi.fn().mockRejectedValue(new Error('must not dispatch')); vi.stubGlobal('fetch',fetch);
  await expect(generateNativeVideo({prompt:'Action',output},{provider:'runway',model:'gen4.5',api_key:'local-key'},{})).rejects.toThrow(/existing|already exists/i);
  expect(fetch).not.toHaveBeenCalled(); expect(await readFile(output)).toEqual(mp4);
});
it('retains accepted task identity on tracking failure and never automatically resubmits', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ id: 'accepted' })).mockResolvedValueOnce(Response.json({ status: 'FAILED' })); vi.stubGlobal('fetch', fetch);
  await expect(generateNativeVideo({ prompt: 'Action', output: join(directory, 'failed.mp4') }, { provider: 'runway', model: 'gen4.5', api_key: 'local-key' }, { pollIntervalMs: 0 })).rejects.toMatchObject({ task_id: 'accepted', post_dispatch: true });
  expect(fetch).toHaveBeenCalledTimes(2);
  const receipt=JSON.parse(await readFile(join(directory,'failed.mp4.video-task.json'),'utf8'));
  expect(receipt).toMatchObject({phase:'accepted',task_id:'accepted'}); expect(JSON.stringify(receipt)).not.toContain('local-key');
  await expect(generateNativeVideo({prompt:'Action',output:join(directory,'failed.mp4')},{provider:'runway',model:'gen4.5',api_key:'local-key'},{})).rejects.toThrow(/receipt|existing/i);
  expect(fetch).toHaveBeenCalledTimes(2);
});
it('waits for a Google file to become active and sends its key only to the validated Files API', async () => {
  let metadata = 0;
  const fetch = vi.fn(async (url: any, init: any) => {
    const value = String(url);
    if (value.endsWith('/interactions')) return Response.json({ id: 'google-task' });
    if (value.endsWith('/interactions/google-task')) return Response.json({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'video', mime_type: 'video/mp4', uri: 'https://generativelanguage.googleapis.com/v1beta/files/file-one' }] }] });
    expect(init.headers['x-goog-api-key']).toBe('local-key');
    if (value.includes(':download')) { expect(metadata).toBe(2); return new Response(mp4); }
    metadata++; return Response.json({ state: metadata === 1 ? 'PROCESSING' : 'ACTIVE' });
  }); vi.stubGlobal('fetch', fetch);
  const result = await generateNativeVideo({ prompt: 'Action', output: join(directory, 'google.mp4'), duration: 2 }, { provider: 'google', model: 'gemini-omni-1.1-flash', api_key: 'local-key', base_url: 'https://provider.invalid' }, { pollIntervalMs: 0 });
  expect(result.task_id).toBe('google-task'); expect(metadata).toBe(2);
});

import { videoProviderLimits } from '../src/video/video.js';
it('uses the selected Seedance generation limits rather than an older tier when validating a plan', () => {
  expect(videoProviderLimits({ provider: 'doubao', model: 'doubao-seedance-2-5-260628' }).durations).toEqual({ min: 4, max: 30 });
  expect(videoProviderLimits({ provider: 'doubao', model: 'doubao-seedance-2-0-260128' }).durations).toEqual({ min: 4, max: 15 });
});
it('collects an explicitly resumed accepted task without another create request', async () => {
  const output = join(directory, 'resumed.mp4');
  await writeFile(`${output}.video-task.json`, JSON.stringify({ provider: 'runway', phase: 'accepted', task_id: 'already-accepted' }));
  let posts = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: any, init: any) => {
    if (init.method === 'POST') { posts++; throw new Error('Must never create another paid task'); }
    if (String(url).endsWith('/v1/tasks/already-accepted')) return Response.json({ status: 'SUCCEEDED', output: ['https://media.invalid/resumed.mp4'] });
    return new Response(mp4);
  }));
  const result = await generateNativeVideo({ prompt: 'Original action', output, duration: 2 }, { provider: 'runway', model: 'gen4.5', api_key: 'local-key' }, { resumeTaskId: 'already-accepted', pollIntervalMs: 0 });
  expect(posts).toBe(0);
  expect(result.task_id).toBe('already-accepted');
  expect((await probeMedia(output)).duration).toBeCloseTo(2, 1);
});
