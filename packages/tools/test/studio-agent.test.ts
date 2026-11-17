import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NativeAgent } from '../src/studio/agent.js';

// Protocol simulation: real child/stdin/stdout; no model-quality or provider claim.
let root: string;
let agent: NativeAgent | undefined;
afterEach(async () => { await agent?.close(); agent = undefined; if (root) await fs.rm(root, { recursive: true, force: true }); });
async function fixture(engine: 'codex' | 'claude') {
  root = await fs.mkdtemp(join(tmpdir(), 'ovs-agent-'));
  const bin = join(root, 'agent.cjs');
  await fs.writeFile(bin, `
const fs=require('fs');
if(process.argv.includes('--version')) { console.log(${JSON.stringify(engine === 'codex' ? 'codex-cli 0.160.1' : '2.1.148 (Claude Code)')}); process.exit(); }
let turn=0;
require('readline').createInterface({input:process.stdin}).on('line',line=>{
 const m=JSON.parse(line);fs.appendFileSync(${JSON.stringify(join(root, 'input.jsonl'))},line+'\\n');
 const emit=x=>console.log(JSON.stringify(x));
 if(m.method==='initialize') emit({id:m.id,result:{}});
 if(m.method==='thread/start'||m.method==='thread/resume') emit({id:m.id,result:{thread:{id:m.params.threadId||'exact-thread',cwd:${JSON.stringify(root)}}}});
 if(m.method==='turn/start') {emit({id:m.id,result:{turn:{id:'t'+(++turn)}}});emit({id:'approval',method:'item/commandExecution/requestApproval',params:{command:'test command'}});}
 if(m.id==='approval'&&m.result) {emit({method:'item/agentMessage/delta',params:{delta:'Done'}});emit({method:'turn/completed',params:{turn:{id:'t'+turn,status:'completed'}}});}
 if(m.type==='user') {emit({type:'system',subtype:'init',session_id:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'});emit({type:'control_request',request_id:'approval',request:{subtype:'can_use_tool',tool_name:'Edit',input:{file_path:'example'}}});}
 if(m.type==='control_response') {emit({type:'assistant',message:{content:[{type:'text',text:'Done'}]}});emit({type:'result',subtype:'success',is_error:false});}
});`);
  agent = new NativeAgent({ engine, root, command: process.execPath, prefixArgs: [bin] });
  return agent;
}
async function until(predicate: () => boolean) {
  const deadline = Date.now() + 5000;
  while (!predicate()) { if (Date.now() > deadline) throw new Error('Protocol did not settle.'); await new Promise(r => setTimeout(r, 10)); }
}
describe.each(['codex', 'claude'] as const)('%s canvas session', engine => {
  it('sends only on explicit submit, surfaces native approval and reuses its exact session', async () => {
    const native = await fixture(engine);
    expect(native.state().busy).toBe(false);
    expect(await fs.stat(join(root, 'input.jsonl')).catch(() => null)).toBeNull();
    await native.send('User modification');
    await until(() => native.state().requests.length > 0);
    expect(native.state().busy).toBe(true);
    await expect(native.send('Duplicate')).rejects.toThrow();
    await native.respond(native.state().requests[0].id, { allow: true });
    await until(() => !native.state().busy);
    expect(native.state().messages.at(-1)).toMatchObject({ role: 'assistant', text: 'Done' });
    await native.send('Second modification');
    await until(() => native.state().requests.length > 0);
    await native.respond(native.state().requests[0].id, { allow: false });
    await until(() => !native.state().busy);
    const input = (await fs.readFile(join(root, 'input.jsonl'), 'utf8')).trim().split('\n').map(l => JSON.parse(l));
    if (engine === 'codex') {
      expect(input.filter(m => m.method === 'thread/start')).toHaveLength(1);
      expect(input.filter(m => m.method === 'turn/start').map(m => m.params.threadId)).toEqual(['exact-thread', 'exact-thread']);
      expect(input.find(m => m.id === 'approval' && m.result)?.result.decision).toBe('accept');
    } else {
      expect(input.filter(m => m.type === 'user')).toHaveLength(2);
      expect(input.find(m => m.type === 'control_response')?.response.response).toMatchObject({ behavior: 'allow' });
    }
  });
});
it('restores the exact saved session after an explicit stop, without replaying the previous input', async () => {
  const native = await fixture('codex');
  await native.send('First request');
  await until(() => native.state().requests.length > 0);
  await native.close();
  await native.send('New explicit request');
  await until(() => native.state().requests.length > 0);
  await native.respond(native.state().requests[0].id, { allow: true });
  await until(() => !native.state().busy);
  const input = (await fs.readFile(join(root, 'input.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  expect(input.filter(m => m.method === 'thread/resume').map(m => m.params.threadId)).toEqual(['exact-thread']);
  expect(input.filter(m => m.method === 'turn/start').map(m => m.params.input[0].text)).toEqual(['First request', 'New explicit request']);
});
it('refuses an unavailable exact session instead of silently starting another conversation', async () => {
  const native = await fixture('codex');
  await fs.writeFile(join(root, '.ovs-studio-session.json'), JSON.stringify({ engine: 'codex', session: 'missing-session' }));
  const file = join(root, 'agent.cjs');
  await fs.writeFile(file, (await fs.readFile(file, 'utf8')).replace("if(m.method==='thread/start'||m.method==='thread/resume')", "if(m.method==='thread/resume'){emit({id:m.id,error:{code:-32000,message:'missing fixture session'}});return;}\n if(m.method==='thread/start')"));
  await expect(native.send('Do not lose my context')).rejects.toThrow();
  const input = (await fs.readFile(join(root, 'input.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  expect(input.some(message => message.method === 'thread/resume')).toBe(true);
  expect(input.some(message => message.method === 'thread/start' || message.method === 'turn/start')).toBe(false);
});
it('returns structured native question answers and never sends a typed answer when the user declines', async () => {
  const native = await fixture('codex'); const file = join(root, 'agent.cjs');
  await fs.writeFile(file, (await fs.readFile(file, 'utf8')).replace("method:'item/commandExecution/requestApproval',params:{command:'test command'}", "method:'item/tool/requestUserInput',params:{questions:[{id:'selection',question:'Choose a version',options:[{label:'A',description:'First'},{label:'B',description:'Second'}]}]}"));
  await native.send('Ask me first'); await until(() => native.state().requests.length > 0);
  expect(native.state().requests[0].kind).toBe('question');
  await native.respond(native.state().requests[0].id, { allow: true, answers: { selection: ['B'] } });
  await until(() => !native.state().busy);
  await native.send('Ask again'); await until(() => native.state().requests.length > 0);
  await native.respond(native.state().requests[0].id, { allow: false, answers: { selection: ['Do not send'] } });
  await until(() => !native.state().busy);
  const input = (await fs.readFile(join(root, 'input.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  const responses = input.filter(message => message.id === 'approval' && message.result);
  expect(responses.map(message => message.result)).toEqual([{ answers: { selection: { answers: ['B'] } } }, { answers: {} }]);
});
