import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import * as vm from 'node:vm';

// Exercise the shipped browser host without a model: an Update reads the saved
// product facts, including when focusout and click happen in the same gesture.
async function host(refused = false) {
  const methods: string[] = [];
  let saved = false;
  let release!: () => void;
  const pending = new Promise<void>(done => { release = done; });
  const context: any = {
    navigator: { language: 'en' }, localStorage: { getItem: () => null },
    document: { addEventListener() {} }, AbortSignal, setTimeout, clearTimeout,
    fetch: async (_url: string, request: any) => {
      const { method } = JSON.parse(request.body);
      methods.push(method);
      if (method === 'videoCanvas.edit') { await pending; saved = !refused; }
      return { ok: true, json: async () => method === 'videoCanvas.edit'
        ? { ok: !refused, ...(refused ? { code: 'changed' } : {}), revision: 'current' }
        : { ok: true, revision: 'current', fact: saved ? 'Updated benefit' : 'Original benefit' } };
    },
  };
  context.window = { VideoCanvas: { refresh: () => context.api.studioInvoke('videoCanvas.read') } };
  vm.runInNewContext((await fs.readFile(new URL('../src/studio/web/studio.js', import.meta.url), 'utf8')) + '\nglobalThis.api={studioInvoke};', context);
  // Toast presentation is irrelevant to the ordering/recovery contract.
  vm.runInNewContext('uiToast = () => {};', context);
  return { invoke: context.api.studioInvoke, release, methods };
}

it('an Update read waits for the field save, so it sees the changed facts on the first click', async () => {
  const h = await host();
  const edit = h.invoke('videoCanvas.edit', { edit: { kind: 'set_fact', fact: 'benefit', text: 'Updated benefit' } });
  const read = h.invoke('videoCanvas.read');
  await new Promise(done => setImmediate(done));
  const beforeSave = [...h.methods];
  h.release();
  const [, result] = await Promise.all([edit, read]);
  expect(beforeSave).toEqual(['videoCanvas.edit']);
  expect(result.fact).toBe('Updated benefit');
});

it('a refused save can refresh the current facts without deadlocking its own write queue', async () => {
  const h = await host(true);
  const edit = h.invoke('videoCanvas.edit', { edit: { kind: 'set_fact', fact: 'benefit', text: 'Updated benefit' } });
  h.release();
  expect(await edit).toMatchObject({ ok: false, code: 'changed' });
  const read = await h.invoke('videoCanvas.read');
  expect(read.fact).toBe('Original benefit');
  expect(h.methods.filter(method => method === 'videoCanvas.read').length).toBeGreaterThan(0);
});

// The standalone browser must never take over the originating conversation.
// Requests remain intact until the bound host acknowledges delivery.
async function conversationHost(savedLanguage: string | null = null, accepted = true) {
  const elements = new Map<string, any>();
  const element = (id: string) => {
    if (!elements.has(id)) elements.set(id, {
      value: '', textContent: '', hidden: false, open: false,
      showModal() { this.open = true; }, close() { this.open = false; },
      focus() {}, select() {}, dispatchEvent() {}, setSelectionRange() {},
    });
    return elements.get(id);
  };
  const methods: string[] = [], requests: any[] = [];
  const context: any = {
    localStorage: { getItem: () => savedLanguage, setItem() {} },
    navigator: { language: 'en-US' }, crypto: { randomUUID: () => 'request-id' },
    document: { addEventListener() {}, getElementById: element },
    Event: class {}, AbortSignal, setTimeout, clearTimeout,
    fetch: async (_url: string, request: any) => {
      const body = JSON.parse(request.body); methods.push(body.method); requests.push(body.params);
      return { ok: true, json: async () => ({ ok: accepted, accepted, code: 'conversation_unavailable' }) };
    },
    window: {},
  };
  vm.runInNewContext((await fs.readFile(new URL('../src/studio/web/studio.js', import.meta.url), 'utf8')) +
    '\nglobalThis.api={getLang,t,composerNotify,studioInvoke,studioConversationState,studioSendHandoff};', context);
  return { ...context.api, element, methods, requests, send: context.window.sendInConversation };
}

describe('canvas requests continue in the original conversation', () => {
  it('opens in Chinese on an English browser and preserves an explicit language preference', async () => {
    const h = await conversationHost();
    expect(h.getLang()).toBe('zh');
    expect(h.t('video_canvas.product_hint')).toContain('原对话');
    expect(h.t('video_canvas.drop_hint')).toContain('当前工程');
    expect((await conversationHost('en')).getLang()).toBe('en');
    expect((await conversationHost('zh-CN')).getLang()).toBe('zh');
  });

  it('Tell Agent keeps a draft until Send delivers it to the bound original conversation', async () => {
    const h = await conversationHost();
    h.studioConversationState({ connected: true, label: '视频制作原对话' });
    const input = h.element('chat-input'); input.value = '关于第 2 段：保留这段草稿';
    h.composerNotify(input);
    expect(h.element('handoff-dialog').open).toBe(true);
    expect(h.methods).toEqual([]);
    const sending = h.studioSendHandoff();
    expect(h.element('handoff-dialog').open).toBe(true);
    await sending;
    expect(h.methods).toEqual(['conversation.send']);
    expect(h.requests[0]).toEqual({ request_id: 'request-id', text: '关于第 2 段：保留这段草稿' });
    expect(input.value).toBe('');
    expect(h.element('handoff-dialog').open).toBe(false);
    expect(h.element('toast').textContent).toContain('已发送');
  });

  it('an agent-dependent Update prepares the original request without starting another conversation', async () => {
    const h = await conversationHost();
    const result = await h.studioInvoke('videoCanvas.agentUpdate', { text: '更新第 2 段的旁白并重新交付。' });
    expect(result).toMatchObject({ ok: true, pending: true });
    expect(h.element('chat-input').value).toBe('更新第 2 段的旁白并重新交付。');
    expect(h.element('handoff-dialog').open).toBe(true);
    expect(h.methods).toEqual([]);
    expect(await h.send('studio', '继续修改')).toMatchObject({ started: false, pending: true });
    expect(h.element('chat-input').value).toContain('更新第 2 段的旁白');
    expect(h.element('chat-input').value).toContain('继续修改');
    expect(h.methods).toEqual([]);
  });

  it('an unbound or rejected original conversation keeps the request and never reports a sent message', async () => {
    const h = await conversationHost(null, false);
    h.element('chat-input').value = '保留这条修改请求';
    h.composerNotify(h.element('chat-input'));
    await h.studioSendHandoff();
    expect(h.methods).toEqual([]);
    expect(h.element('chat-input').value).toBe('保留这条修改请求');
    h.studioConversationState({ connected: true, label: '视频制作原对话' });
    await h.studioSendHandoff();
    expect(h.methods).toEqual(['conversation.send']);
    expect(h.element('chat-input').value).toBe('保留这条修改请求');
    expect(h.element('handoff-feedback').textContent).not.toContain('已发送');
    expect(h.element('handoff-dialog').open).toBe(true);
  });
});
