/* Browser host for the unchanged PC canvas interaction contract. */
'use strict';
let studioLanguage = (localStorage.getItem('ovs-language') || navigator.language).startsWith('zh') ? 'zh' : 'en';
let studioLocales = {}, studioRevision = '', studioQueue = Promise.resolve(), studioBusy = false;
const studioPush = new Set();
const studioWords = {
 en: {send:'Send',stop:'Stop',idle:'Ready',running:'Agent is working',waiting:'Waiting for your answer',completed:'Completed',stopped:'Stopped',failed:'The operation failed. You can try again.',unbound:'Agent is not connected. Start ovs studio with --agent codex or --agent claude.',connecting:'Connecting…',offline:'Connection lost. Keep this service running and reload.',allow:'Allow',deny:'Deny',answer:'Submit answer',cancel:'Cancel',confirm:'Confirm',changed:'The production changed. Your input is kept; check the refreshed canvas before saving again.',busy:'Wait for the current task to finish.',agent_version:'Update your native Agent CLI before continuing.',agent_session:'The original session could not be resumed. Reopen with its valid session or explicitly choose --new-session.',agent_unavailable:'The Agent could not start. Check that its native CLI is installed and signed in.',in_progress:'An earlier generation request needs attention. Check its provider task before making a new paid request.',unsupported:'The configured service does not support these inputs.',you:'You',agent:'Agent',approval:'Permission requested',question:'Your answer is needed',connect:'Open the access link printed by ovs studio.',too_many:'Import at most 32 files at a time.'},
 'zh-CN': {send:'发送',stop:'停止',idle:'已就绪',running:'智能体正在处理',waiting:'等待你的答复',completed:'已完成',stopped:'已停止',failed:'操作未完成，可以重试。',unbound:'尚未连接智能体。请使用 --agent codex 或 --agent claude 启动画布。',connecting:'正在连接…',offline:'连接已断开。请保持服务运行，然后刷新页面。',allow:'允许',deny:'拒绝',answer:'提交答复',cancel:'取消',confirm:'确认',changed:'工程已更新。已保留你的输入，请核对刷新后的画布再保存。',busy:'请等待当前任务完成。',agent_version:'请更新本机智能体 CLI 后继续。',agent_session:'无法恢复原会话。请使用有效会话重新打开，或明确选择 --new-session。',agent_unavailable:'智能体未能启动。请检查本机 CLI 是否已安装并登录。',in_progress:'有一次生成请求需要处理。请先核对服务商任务，避免重复付费。',unsupported:'当前配置的服务不支持这些输入。',you:'你',agent:'智能体',approval:'需要操作许可',question:'需要你的答复',connect:'请打开 ovs studio 输出的访问链接。',too_many:'每次最多导入 32 个文件。'}
};
function studioT(key) { return (studioWords[studioLanguage === 'zh' ? 'zh-CN' : 'en'] || studioWords.en)[key] || studioWords.en[key] || studioWords.en.failed; }
function getLang() { return studioLanguage; }
function t(key, values = {}) {
 const table = studioLocales[studioLanguage] || studioLocales.en || {};
 let result = table[key] || studioLocales.en?.[key] || key;
 for (const [name,value] of Object.entries(values)) result = result.split('{' + name + '}').join(String(value));
 return result;
}
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function composerText(input) { return input.value; }
function composerSetText(input,text) { input.value=text; }
function composerNotify(input) { input.dispatchEvent(new Event('input',{bubbles:true})); }
function composerSetSelection(input,a,b) { input.setSelectionRange(a,b); }
let studioToastTimer;
function uiToast(message, options={}) { const el=document.getElementById('toast'); el.textContent=message; el.hidden=false; clearTimeout(studioToastTimer); studioToastTimer=setTimeout(()=>el.hidden=true, options.timeoutMs || 5000); }
let studioConfirmQueue=Promise.resolve();
function uiConfirm(options) {
 const next=studioConfirmQueue.then(()=>new Promise(resolve=>{
  const dialog=document.getElementById('confirm-dialog'); document.getElementById('confirm-message').textContent=options.message;
  document.getElementById('confirm-ok').textContent=options.okLabel || studioT('confirm'); document.getElementById('confirm-cancel').textContent=studioT('cancel');
  dialog.returnValue='cancel'; dialog.addEventListener('close',()=>resolve(dialog.returnValue==='ok'),{once:true}); dialog.showModal();
 })); studioConfirmQueue=next.catch(()=>{}); return next;
}
function uiConfirmDanger(options) { return uiConfirm(options); }
async function studioPost(method,params={}) {
 const response=await fetch('/api/invoke',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,params}),signal:AbortSignal.timeout(60000)});
 if(!response.ok) throw new Error('offline'); return response.json();
}
const studioMutations=new Set(['videoCanvas.edit','videoCanvas.draft','videoCanvas.redo','videoCanvas.generateDraft','videoCanvas.layout','videoCanvas.agentUpdate']);
async function studioInvoke(method,params={}) {
 if(method==='videoCanvas.saveCopy') { const available=await fetch('/media?file='+encodeURIComponent(params.file),{method:'HEAD',signal:AbortSignal.timeout(10000)});if(!available.ok)return {ok:false};const link=document.createElement('a'); link.href='/media?download=1&file='+encodeURIComponent(params.file); link.download=''; link.click(); return {ok:true}; }
 const perform=async()=>{
  const result=await studioPost(method,{...params,...(studioMutations.has(method)?{revision:studioRevision}:{})});
  if(result.revision) studioRevision=result.revision;
  if(result.code==='changed' && studioMutations.has(method)) { uiToast(studioT('changed'),{timeoutMs:10000}); window.VideoCanvas?.refresh(); }
  return result;
 };
 if(studioMutations.has(method)) { const next=studioQueue.then(perform); studioQueue=next.catch(()=>{}); return next; }
 await studioQueue;
 return perform();
}
window.orkas={invoke:studioInvoke,onPushEvent:(_name,callback)=>studioPush.add(callback),async importLocalFiles(_kind,files) {
 if(files.length>32) { uiToast(studioT('too_many')); return {ok:false,files:[]}; }
 const results=[];
 for(const file of files) {
  const perform=async()=>{
   const response=await fetch('/api/upload?name='+encodeURIComponent(file.name),{method:'POST',body:file,signal:AbortSignal.timeout(600000)});
   const result=await response.json(); if(result.revision) studioRevision=result.revision;
   results.push(...(result.files || [{ok:false,name:file.name,reason:result.code}]));
  };
  const next=studioQueue.then(perform); studioQueue=next.catch(()=>{}); await next;
 }
 return {ok:true,files:results};
}};
async function _chatAttachUpload(_cid,files) { await window.orkas.importLocalFiles('video_canvas',files); await window.VideoCanvas.refresh(); }
function openChatFileViewer(file) {
 const content=document.getElementById('media-content'); content.replaceChildren();
 const extension=String(file).split('.').pop().toLowerCase(), image=['png','jpg','jpeg','webp','gif','avif'].includes(extension), audio=['wav','mp3','m4a','ogg','flac'].includes(extension);
 const media=document.createElement(image?'img':audio?'audio':'video'); media.src='/media?file='+encodeURIComponent(file); if(!image)media.controls=true;
 content.append(media); document.getElementById('media-dialog').showModal();
}
window.sendInConversation=async(_cid,text)=>{
 try { const result=await studioPost('agent.send',{text}); if(!result.ok)uiToast(studioT(result.code)); return {started:result.ok===true}; }
 catch { uiToast(studioT('offline')); return {started:false}; }
};
function studioLocalize() {
 document.documentElement.lang=studioLanguage;
 document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));
 for(const attribute of ['title','aria-label']) document.querySelectorAll('[data-i18n-'+attribute+']').forEach(el=>el.setAttribute(attribute,t(el.getAttribute('data-i18n-'+attribute))));
 document.querySelectorAll('[data-studio-i18n]').forEach(el=>el.textContent=studioT(el.dataset.studioI18n));
 document.getElementById('media-close').setAttribute('aria-label',t('common.close'));
 window.dispatchEvent(new Event('i18n-change'));
}
let studioMessageSignature='', studioRequestSignature='';
function studioAgentState(agent) {
 studioBusy=!!agent?.busy;
 document.getElementById('agent-status').textContent=agent?((agent.engine==='codex'?'Codex':'Claude Code')+' · '+studioT(agent.status)):studioT('unbound');
 document.getElementById('agent-send').disabled=!agent || studioBusy; document.getElementById('agent-stop').disabled=!studioBusy;
 window.VideoCanvas?.notifyBusy('studio',studioBusy);
 const messages=JSON.stringify(agent?.messages || []);
 if(messages!==studioMessageSignature) {
  const host=document.getElementById('agent-messages'), atEnd=host.scrollHeight-host.scrollTop-host.clientHeight<80;
  host.replaceChildren(); for(const message of agent?.messages || []) { const row=document.createElement('article'), label=document.createElement('strong'), text=document.createElement('p'); label.textContent=studioT(message.role==='user'?'you':'agent'); text.textContent=message.text; row.append(label,text); host.append(row); }
  if(atEnd)host.scrollTop=host.scrollHeight; studioMessageSignature=messages;
 }
 const requests=JSON.stringify(agent?.requests || []);
 if(requests!==studioRequestSignature) {
  const host=document.getElementById('agent-requests'); host.replaceChildren();
  for(const request of agent?.requests || []) {
   const form=document.createElement('form'), title=document.createElement('strong'), detail=document.createElement('pre'); title.textContent=studioT(request.kind==='question'?'question':'approval'); detail.textContent=[request.title,request.detail].filter(Boolean).join('\n'); form.append(title,detail);
   for(const q of request.questions || []) {
    const label=document.createElement('label');label.textContent=q.question; const input=document.createElement('input');input.name=q.id;input.type=q.isSecret?'password':'text';input.required=true;label.append(input);
    if(q.options?.length) { const choices=document.createElement('div');choices.className='ai-select';label.append(choices);_aiSelectMount(choices,{options:q.options.map(o=>({value:o.label,label:o.label,hint:o.description})),value:'',ariaLabel:q.question,onChange:value=>input.value=value}); }
    form.append(label);
   }
   const allow=document.createElement('button'), deny=document.createElement('button');allow.className='btn btn-primary';allow.type='submit';allow.textContent=studioT(request.kind==='question'?'answer':'allow');deny.type='button';deny.className='btn';deny.textContent=studioT('deny');form.append(deny,allow);
   const respond=async value=>{ allow.disabled=deny.disabled=true; try { const answers={}; for(const q of request.questions || [])answers[q.id]=[form.elements.namedItem(q.id).value];const result=await studioPost('agent.respond',{id:request.id,answer:{allow:value,answers}});if(!result.ok)throw new Error(); } catch {uiToast(studioT('failed'));allow.disabled=deny.disabled=false;} };
   form.addEventListener('submit',event=>{event.preventDefault();respond(true);});deny.addEventListener('click',()=>respond(false));host.append(form);
  }
  studioRequestSignature=requests;
 }
}
async function studioStart() {
 const status=document.getElementById('agent-status');status.textContent=studioT('connecting');
 try {
  if(location.hash.length>1) { const token=location.hash.slice(1);history.replaceState(null,'',location.pathname);const response=await fetch('/api/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token}),signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('connect'); }
  studioLocales=await(await fetch('/locales.json',{signal:AbortSignal.timeout(10000)})).json();studioLocalize();
  await window.VideoCanvas.probe('studio');await window.VideoCanvas.open('studio');
  let after=0, generation=-1;
  async function poll() {
   try { const result=await studioPost('studio.status',{after});if(!result.ok)throw new Error();studioAgentState(result.agent);for(const event of result.jobs)studioPush.forEach(callback=>callback(event));after=result.eventSeq;
    if(!document.activeElement?.closest('#video-canvas-panel textarea,#video-canvas-panel input') && (generation!==result.generation || studioRevision!==result.revision)) { await window.VideoCanvas.refresh();generation=result.generation; }
   } catch {status.textContent=studioT('offline');document.getElementById('agent-send').disabled=true;}
   setTimeout(poll,studioBusy?1000:5000);
  }
  await poll();
 } catch {status.textContent=studioT('connect');}
}
document.addEventListener('DOMContentLoaded',()=>{
 document.getElementById('agent-form').addEventListener('submit',async event=>{event.preventDefault();const input=document.getElementById('chat-input'),text=input.value;if(!text.trim())return;document.getElementById('agent-send').disabled=true;const result=await window.sendInConversation('studio',text);if(result.started && input.value===text)input.value='';else if(!studioBusy)document.getElementById('agent-send').disabled=false;});
 document.getElementById('chat-input').addEventListener('keydown',event=>{if(!event.isComposing && event.keyCode!==229 && event.key==='Enter' && (event.ctrlKey || event.metaKey)) {event.preventDefault();document.getElementById('agent-form').requestSubmit();}});
 document.getElementById('agent-stop').addEventListener('click',()=>studioPost('agent.stop').catch(()=>uiToast(studioT('failed'))));
 document.getElementById('language').addEventListener('click',()=>{studioLanguage=studioLanguage==='zh'?'en':'zh';localStorage.setItem('ovs-language',studioLanguage);studioMessageSignature=studioRequestSignature='';studioLocalize();});
 document.getElementById('media-close').addEventListener('click',()=>document.getElementById('media-dialog').close());document.getElementById('media-dialog').addEventListener('close',()=>document.getElementById('media-content').replaceChildren());
 studioStart();
});
