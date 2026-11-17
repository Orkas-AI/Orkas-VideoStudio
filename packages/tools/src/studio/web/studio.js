/* Browser host for the unchanged PC canvas interaction contract. */
'use strict';
let studioLanguage = localStorage.getItem('ovs-language') === 'en' ? 'en' : 'zh';
let studioLocales = {}, studioRevision = '', studioQueue = Promise.resolve(), studioBusy = false;
const studioPush = new Set();
const studioWords = {
 handoff: {
  en: {title:'Video canvas',language:'Language: English',return:'Original conversation',handoff_title:'Tell Agent',handoff_hint:'Add your request and send it to the original conversation.',request:'Request',send_request:'Send',sent:'Sent to the original conversation.',send_failed:'Delivery was not confirmed. Your request is kept.',unavailable:'The original conversation is not connected. Sending is unavailable.',destination:'Original conversation: ',connected:'Canvas connected',product_hint:'After editing, choose Update video. Agent changes go to the original conversation.',drop_hint:'Files join this production. Continue making the video in the original conversation.'},
  zh: {title:'视频画布',language:'语言：中文',return:'原对话',handoff_title:'告诉智能体',handoff_hint:'补充修改要求，点击发送后交给原对话处理。',request:'修改要求',send_request:'发送',sent:'已发送到原对话。',send_failed:'尚未确认送达，已保留修改要求。',unavailable:'原对话尚未连接，暂时不能发送。',destination:'发送到原对话：',connected:'画布已连接',product_hint:'修改后点「更新视频」；需要智能体处理的内容会发到原对话。',drop_hint:'文件会加入当前工程，可在原对话中继续制作。'}
 },
 en: {send:'Send',stop:'Stop',idle:'Ready',running:'Agent is working',waiting:'Waiting for your answer',completed:'Completed',stopped:'Stopped',failed:'The operation failed. You can try again.',unbound:'Agent is not connected. Start ovs studio with --agent codex or --agent claude.',connecting:'Connecting…',offline:'Connection lost. Keep this service running and reload.',allow:'Allow',deny:'Deny',answer:'Submit answer',cancel:'Cancel',confirm:'Confirm',changed:'The production changed. Your input is kept; check the refreshed canvas before saving again.',busy:'Wait for the current task to finish.',agent_version:'Update your native Agent CLI before continuing.',agent_session:'The original session could not be resumed. Reopen with its valid session or explicitly choose --new-session.',agent_unavailable:'The Agent could not start. Check that its native CLI is installed and signed in.',in_progress:'An earlier generation request needs attention. Check its provider task before making a new paid request.',unsupported:'The configured service does not support these inputs.',you:'You',agent:'Agent',approval:'Permission requested',question:'Your answer is needed',connect:'Open the access link printed by ovs studio.',too_many:'Import at most 32 files at a time.'},
 'zh-CN': {send:'发送',stop:'停止',idle:'已就绪',running:'智能体正在处理',waiting:'等待你的答复',completed:'已完成',stopped:'已停止',failed:'操作未完成，可以重试。',unbound:'尚未连接智能体。请使用 --agent codex 或 --agent claude 启动画布。',connecting:'正在连接…',offline:'连接已断开。请保持服务运行，然后刷新页面。',allow:'允许',deny:'拒绝',answer:'提交答复',cancel:'取消',confirm:'确认',changed:'工程已更新。已保留你的输入，请核对刷新后的画布再保存。',busy:'请等待当前任务完成。',agent_version:'请更新本机智能体 CLI 后继续。',agent_session:'无法恢复原会话。请使用有效会话重新打开，或明确选择 --new-session。',agent_unavailable:'智能体未能启动。请检查本机 CLI 是否已安装并登录。',in_progress:'有一次生成请求需要处理。请先核对服务商任务，避免重复付费。',unsupported:'当前配置的服务不支持这些输入。',you:'你',agent:'智能体',approval:'需要操作许可',question:'需要你的答复',connect:'请打开 ovs studio 输出的访问链接。',too_many:'每次最多导入 32 个文件。'}
};
function studioT(key) { return studioWords.handoff[studioLanguage]?.[key] || (studioWords[studioLanguage === 'zh' ? 'zh-CN' : 'en'] || studioWords.en)[key] || studioWords.en[key] || studioWords.en.failed; }
function getLang() { return studioLanguage; }
function t(key, values = {}) {
 const hostKey={'video_canvas.product_hint':'product_hint','video_canvas.drop_hint':'drop_hint'}[key];
 if(hostKey)return studioT(hostKey);
 const table = studioLocales[studioLanguage] || studioLocales.en || {};
 let result = table[key] || studioLocales.en?.[key] || key;
 for (const [name,value] of Object.entries(values)) result = result.split('{' + name + '}').join(String(value));
 return result;
}
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function composerText(input) { return input.value; }
function composerSetText(input,text) { input.value=text; }
function composerNotify(input) { input.dispatchEvent(new Event('input',{bubbles:true})); studioOpenHandoff(); }
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
 if(method==='videoCanvas.agentUpdate') { await studioQueue; return studioPrepareHandoff(params.text); }
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
let studioConversation={connected:false,label:''},studioSending=false,studioPendingRequest=null;
function studioConversationState(binding) {
 studioConversation={connected:binding?.connected===true,label:typeof binding?.label==='string'?binding.label:''};
 document.getElementById('handoff-destination').textContent=studioConversation.connected?studioT('destination')+studioConversation.label:studioT('unavailable');
 document.getElementById('handoff-send').disabled=!studioConversation.connected||studioSending;
}
function studioOpenHandoff() {
 const dialog=document.getElementById('handoff-dialog');
 document.getElementById('handoff-feedback').textContent='';
 studioConversationState(studioConversation);
 if(!dialog.open)dialog.showModal();
}
function studioPrepareHandoff(text) {
 const input=document.getElementById('chat-input');
 if(typeof text==='string' && text.trim() && input.value!==text)input.value=input.value.trim()?input.value+'\n\n'+text:text;
 studioOpenHandoff();input.focus();
 return {ok:true,pending:true};
}
async function studioSendHandoff() {
 const input=document.getElementById('chat-input'),feedback=document.getElementById('handoff-feedback'),text=input.value;
 if(studioSending||!text.trim())return;
 if(!studioConversation.connected){feedback.textContent=studioT('unavailable');return;}
 if(!studioPendingRequest||studioPendingRequest.text!==text)studioPendingRequest={request_id:crypto.randomUUID(),text};
 studioSending=true;studioConversationState(studioConversation);
 try {
  const result=await studioPost('conversation.send',studioPendingRequest);
  if(!result.ok||result.accepted!==true)throw new Error('unconfirmed');
  feedback.textContent=studioT('sent');if(input.value===text)input.value='';studioPendingRequest=null;
 }catch{feedback.textContent=studioT('send_failed');}
 finally{studioSending=false;studioConversationState(studioConversation);}
}
window.sendInConversation=async(_cid,text)=>{studioPrepareHandoff(text);return {started:false,pending:true};};
function studioLocalize() {
 document.documentElement.lang=studioLanguage;
 document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));
 for(const attribute of ['title','aria-label']) document.querySelectorAll('[data-i18n-'+attribute+']').forEach(el=>el.setAttribute(attribute,t(el.getAttribute('data-i18n-'+attribute))));
 document.querySelectorAll('[data-studio-i18n]').forEach(el=>el.textContent=studioT(el.dataset.studioI18n));
 document.getElementById('media-close').setAttribute('aria-label',t('common.close'));
 document.title=studioT('title');studioConversationState(studioConversation);
 window.dispatchEvent(new Event('i18n-change'));
}
function studioAgentState(agent) {
 studioBusy=!!agent?.busy;
 document.getElementById('studio-status').textContent=studioT(studioBusy?'running':'connected');
 window.VideoCanvas?.notifyBusy('studio',studioBusy);
}
async function studioStart() {
 const status=document.getElementById('studio-status');status.textContent=studioT('connecting');
 try {
  if(location.hash.length>1) { const token=location.hash.slice(1);history.replaceState(null,'',location.pathname);const response=await fetch('/api/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token}),signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('connect'); }
  studioLocales=await(await fetch('/locales.json',{signal:AbortSignal.timeout(10000)})).json();studioLocalize();
  await window.VideoCanvas.probe('studio');await window.VideoCanvas.open('studio');
  let after=0, generation=-1;
  async function poll() {
   try { const result=await studioPost('studio.status',{after});if(!result.ok)throw new Error();studioAgentState(result.conversation?.busy?{busy:true}:result.agent);studioConversationState(result.conversation);for(const event of result.jobs)studioPush.forEach(callback=>callback(event));after=result.eventSeq;
    if(!document.activeElement?.closest('#video-canvas-panel textarea,#video-canvas-panel input') && (generation!==result.generation || studioRevision!==result.revision)) { await window.VideoCanvas.refresh();generation=result.generation; }
   } catch {status.textContent=studioT('offline');}
   setTimeout(poll,studioBusy?1000:5000);
  }
  await poll();
 } catch {status.textContent=studioT('connect');}
}
document.addEventListener('DOMContentLoaded',()=>{
 document.getElementById('handoff-form').addEventListener('submit',event=>{event.preventDefault();if(!event.isComposing)studioSendHandoff();});
 document.getElementById('handoff-open').addEventListener('click',studioOpenHandoff);
 document.getElementById('handoff-close').addEventListener('click',()=>document.getElementById('handoff-dialog').close());
 document.getElementById('language').addEventListener('click',()=>{studioLanguage=studioLanguage==='zh'?'en':'zh';localStorage.setItem('ovs-language',studioLanguage);document.getElementById('handoff-feedback').textContent='';studioLocalize();});
 document.getElementById('media-close').addEventListener('click',()=>document.getElementById('media-dialog').close());document.getElementById('media-dialog').addEventListener('close',()=>document.getElementById('media-content').replaceChildren());
 studioStart();
});
