import { afterEach, beforeEach, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { connectOriginalConversation } from '../src/studio/conversation.js';

let root: string, client: ReturnType<typeof connectOriginalConversation> | undefined;
beforeEach(async () => { root = await fs.mkdtemp(join(tmpdir(), 'ovs-origin-client-')); });
afterEach(async () => { client?.close(); client = undefined; await fs.rm(root, { recursive: true, force: true }); });

async function fixture() {
  const script = join(root, 'client.cjs'), calls = join(root, 'calls.jsonl'), fail = join(root, 'fail');
  await fs.writeFile(script, `const fs=require('fs');
require('readline').createInterface({input:process.stdin}).on('line',line=>{
 const m=JSON.parse(line);fs.appendFileSync(${JSON.stringify(calls)},JSON.stringify(m)+'\\n');
 if(m.method==='send'&&fs.existsSync(${JSON.stringify(fail)}))process.exit(1);
 console.log(JSON.stringify({id:m.id,ok:true,result:m.method==='status'?{connected:true,busy:false,label:'原视频对话'}:{accepted:true}}));
});`);
  client = connectOriginalConversation(script);
  return { calls, fail };
}

it('uses the host companion for status and explicit delivery without spawning a native agent', async () => {
  const h = await fixture();
  expect(await client!.status()).toEqual({ connected: true, busy: false, label: '原视频对话' });
  expect(await client!.send({ requestId: 'send-1', text: '修改第 2 段' })).toEqual({ accepted: true });
  const requests = (await fs.readFile(h.calls, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  expect(requests.map(row => row.method)).toEqual(['status', 'send']);
  expect(requests[1].params).toEqual({ request_id: 'send-1', text: '修改第 2 段' });
});

it('retains an uncertain send as unconfirmed and reconnects only for status without replaying it', async () => {
  const h = await fixture(); await fs.writeFile(h.fail, '1');
  expect(await client!.send({ requestId: 'send-1', text: '修改第 2 段' })).toEqual({ accepted: false });
  expect((await client!.status()).connected).toBe(true);
  const requests = (await fs.readFile(h.calls, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  expect(requests.filter(row => row.method === 'send')).toHaveLength(1);
});
