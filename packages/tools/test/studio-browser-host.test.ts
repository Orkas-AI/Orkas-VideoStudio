import { expect, it } from 'vitest';
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
