const fs=require('fs');
const path=require('path');
const QRCode=require('qrcode');
const {default:makeWASocket,useMultiFileAuthState,DisconnectReason,Browsers,fetchLatestBaileysVersion}=require('@whiskeysockets/baileys');
const {Boom}=require('@hapi/boom');
const {createProductionSdrGateway}=require('./production-sdr');
const {createWebhookPipeline}=require('./webhook-pipeline');
const {createInboundSpool}=require('./inbound-spool');

const MAX_SLOTS=4;
function configuredMaxSlots(env=process.env){const n=Number(env.WHATSAPP_MAX_SLOTS||1);return Math.min(MAX_SLOTS,Math.max(1,Number.isInteger(n)?n:1))}
const sessions=new Map();
const retryCounts=new Map();
const BASE_DIR=process.env.WHATSAPP_QR_SESSION_DIR||'/tmp/luis-whatsapp-sessions';
const STALE_SESSION_TIMEOUT_MS=25000;
const LID_MAPPING_TIMEOUT_MS=2500;
const MAX_QR_ROUNDS=3;
const qrRounds=new Map();
if(/^\/tmp(\/|$)/.test(BASE_DIR))console.warn('WHATSAPP_SESSION_DIR_EPHEMERAL',{dir:BASE_DIR,hint:'use um disco persistente (ex.: /var/data/whatsapp-sessions) ou a sessão se perde em todo restart/deploy'});

function isSessionStale(session,now=Date.now()){
  if(!session)return false;
  if(session.status!=='CONNECTING'&&session.status!=='QR_READY')return false;
  return (now-(session.startedAt||0))>STALE_SESSION_TIMEOUT_MS;
}
function slotId(v){const n=Number(v);if(!Number.isInteger(n)||n<1||n>MAX_SLOTS)throw new Error('INVALID_SLOT');return n}
function dir(s){return path.join(BASE_DIR,`slot-${s}`)}
function status(slot){const id=slotId(slot),c=sessions.get(id);return{slot:id,status:c?.status||'DISCONNECTED',phone:c?.phone||null,qrDataUrl:c?.qrDataUrl||null,lastError:c?.lastError||null,pendingInbound:typeof spoolSize==='function'?spoolSize(id):0,experimental:true,provider:'BAILEYS_QR'}}
function jidToPhone(value){const jid=String(value||'');if(!jid.endsWith('@s.whatsapp.net'))return null;const phone=jid.slice(0,-15).replace(/\D/g,'');return phone||null}
function normalizeIndividualJid(value){const jid=String(value||'').trim().toLowerCase();return jid.endsWith('@lid')||jid.endsWith('@s.whatsapp.net')?jid:null}
function extractInboundJid(key={}){const candidates=[key.remoteJid,key.participant,key.senderLid,key.remoteJidAlt,key.participantAlt,key.participantPn,key.remoteJidPn,key.senderPn];for(const value of candidates){const jid=normalizeIndividualJid(value);if(jid)return jid}return null}
function extractInboundPhone(key={}){const candidates=[key.remoteJidAlt,key.participantAlt,key.participantPn,key.remoteJidPn,key.senderPn,key.remoteJid,key.participant,key.senderLid];for(const value of candidates){const phone=jidToPhone(value);if(phone)return phone}return null}
function withTimeout(promise,ms){return Promise.race([promise,new Promise(resolve=>setTimeout(()=>resolve(null),ms))])}
async function resolveMessageIdentity(key={},socket){
  const jid=extractInboundJid(key);
  let phone=extractInboundPhone(key);
  if(!phone&&jid?.endsWith('@lid')){
    const mapping=socket?.signalRepository?.lidMapping;
    if(mapping?.getPNForLID){
      try{const mapped=await withTimeout(Promise.resolve(mapping.getPNForLID(jid)),LID_MAPPING_TIMEOUT_MS);phone=jidToPhone(mapped)||null}catch(_){}
    }
  }
  return{phone:phone||null,jid:jid||(phone?`${phone}@s.whatsapp.net`:null)};
}
async function resolveMessagePhone(key={},socket){return (await resolveMessageIdentity(key,socket)).phone}
function credsAreRegistered(creds){return Boolean(creds&&(creds.registered||creds.me?.id))}
function hasSavedSession(id){try{const raw=fs.readFileSync(path.join(dir(id),'creds.json'),'utf8');return credsAreRegistered(JSON.parse(raw))}catch(_){return false}}
function nextQrRound(id){const n=(qrRounds.get(id)||0)+1;qrRounds.set(id,n);return{round:n,exceeded:n>=MAX_QR_ROUNDS}}
function resetQrRounds(id){qrRounds.delete(id)}
function maskPhone(v){const d=String(v||'').replace(/\D/g,'');return d?`***${d.slice(-4)}`:null}
const SPOOL_REPLAY_INTERVAL_MS=60000;
const SPOOL_AUTOREPLY_MAX_AGE_MS=15*60*1000;
const spools=new Map();
const spoolProcessors=new Map();
let spoolTimer=null;
function getSpool(id){if(!spools.has(id))spools.set(id,createInboundSpool({dir:path.join(BASE_DIR,'spool'),name:`slot-${id}`}));return spools.get(id)}
function spoolSize(id){try{return getSpool(id).size()}catch(_){return 0}}
function buildSpoolProcessor({repository,sdrGateway=null,now=()=>Date.now()}){
  // pipelines próprios em modo resume: NUNCA reutilizar o pipeline ao vivo (o guard em memória dele
  // já marcou a chave da mensagem que falhou e descartaria o replay como 'duplicate').
  const pipeline=createWebhookPipeline({repository,sdrGateway,resume:true});
  const persistOnly=createWebhookPipeline({repository,resume:true});
  return async function processSpooled(message){
    const ts=Date.parse(message?.timestamp||'');
    const fresh=Number.isFinite(ts)&&(now()-ts)<=SPOOL_AUTOREPLY_MAX_AGE_MS;
    const results=await (fresh?pipeline:persistOnly)([message]);
    const r=(results||[])[0]||{};
    if(r.status==='error')throw new Error(r.error||'PROCESSING_ERROR');
    if(!fresh&&r.status==='processed'&&r.lead?.id){try{await repository.createEvent({lead_id:r.lead.id,type:'SPOOL_REPLAYED_NO_AUTOREPLY',idempotency_key:`spool-noreply:${r.key}`,payload:{external_message_id:r.key,reason:'MESSAGE_OLDER_THAN_15_MIN',timestamp:message.timestamp||null}})}catch(_){}}
    return 'done';
  };
}
async function replaySpool(id,{force=false}={}){const proc=spoolProcessors.get(id);if(!proc)return null;const sp=getSpool(id);if(!sp.size())return null;const r=await sp.replay(proc,{force});if(!r.skipped&&(r.done||r.dead||r.halted))console.log('WHATSAPP_SPOOL_REPLAY',{slot:id,...r,pending:sp.size()});return r}
function ensureSpoolTimer(){if(spoolTimer)return;spoolTimer=setInterval(()=>{for(const id of spoolProcessors.keys())replaySpool(id).catch(e=>console.error('WHATSAPP_SPOOL_REPLAY_FAILED',{slot:id,error:e.message}))},SPOOL_REPLAY_INTERVAL_MS);if(spoolTimer.unref)spoolTimer.unref()}
function spoolInbound(id,payload,error){try{const r=getSpool(id).enqueue(payload,error);console.warn('WHATSAPP_INBOUND_SPOOLED',{slot:id,queued:r.queued,reason:r.reason||null,pending:r.size,error:String(error||'').slice(0,120)})}catch(e){console.error('WHATSAPP_SPOOL_WRITE_FAILED',{slot:id,error:e.message})}}
function logStatus(id,status,extra={}){console.log('WHATSAPP_STATUS',{slot:id,status,...extra})}
function clearAuthState(id){try{fs.rmSync(dir(id),{recursive:true,force:true})}catch(_){}}
const MAX_AUTO_RECONNECT_ATTEMPTS=6;
function backoffDelay(retryCount){return Math.min(2500*Math.pow(2,retryCount),60000)}
function nextReconnectAttempt(id){const n=(retryCounts.get(id)||0)+1;retryCounts.set(id,n);return{attempt:n,delay:backoffDelay(n),exceeded:n>MAX_AUTO_RECONNECT_ATTEMPTS}}
function resetReconnectAttempts(id){retryCounts.delete(id)}
function shouldProcessUpsert(type){return type==='notify'}
function scheduleReconnect(id,repository,env,delay=800){const current=sessions.get(id);if(!current||current.reconnectTimer||current.stopped)return;current.reconnectTimer=setTimeout(()=>{current.reconnectTimer=null;if(sessions.get(id)===current)sessions.delete(id);connect(id,{repository,env,auto:true}).catch(e=>{const s=sessions.get(id);if(s){s.status='ERROR';s.lastError=e.message}})},delay)}
function messageText(message={}){return message?.conversation||message?.extendedTextMessage?.text||message?.imageMessage?.caption||message?.videoMessage?.caption||message?.documentMessage?.caption||''}
function messageTimestamp(value){if(value===undefined||value===null)return new Date().toISOString();const n=Number(value);return Number.isFinite(n)&&n>0?new Date(n*1000).toISOString():new Date().toISOString()}
async function findOrCreateWhatsappLead(repository,{phone,jid,name,source='WHATSAPP'}){
  if(typeof repository.findOrCreateLeadByWhatsappIdentity==='function')return repository.findOrCreateLeadByWhatsappIdentity({phone,jid},{source,name:name||null});
  if(!phone)throw new Error('PHONE_REQUIRED');
  return repository.findOrCreateLeadByPhone(phone,{source,name:name||null});
}
async function saveHistoryMessage({repository,msg,slot,socket}){
  if(!msg?.message)return null;
  const identity=await resolveMessageIdentity(msg.key||{},socket);
  if(!identity.phone&&!identity.jid)return null;
  const text=messageText(msg.message),externalId=msg.key?.id||null,timestamp=messageTimestamp(msg.messageTimestamp);
  const lead=await findOrCreateWhatsappLead(repository,{...identity,name:msg.pushName||null,source:'WHATSAPP'});
  try{return await repository.createMessage({lead_id:lead.id,channel:'WHATSAPP',direction:msg.key?.fromMe?'OUTBOUND':'INBOUND',external_message_id:externalId||`history:${slot}:${identity.jid||identity.phone}:${timestamp}:${text}`,text_content:text,metadata:{type:'text',media_url:null,source:`WHATSAPP_QR_HISTORY_SLOT_${slot}`,timestamp,history_sync:true,whatsapp_jid:identity.jid}})}catch(error){const code=error?.code||'',message=String(error?.message||'').toLowerCase();if(code==='23505'||message.includes('duplicate')||message.includes('unique'))return null;throw error}
}

async function connect(slot,{repository,env=process.env,auto=false}={}){
  const id=slotId(slot);if(!repository)throw new Error('REPOSITORY_NOT_CONFIGURED');
  if(!auto){resetQrRounds(id);resetReconnectAttempts(id)}
  const old=sessions.get(id);
  if(old?.status==='CONNECTED')return status(id);
  if(old&&(old.status==='CONNECTING'||old.status==='QR_READY')){
    if(!isSessionStale(old))return status(id);
    if(old.reconnectTimer)clearTimeout(old.reconnectTimer);if(old.qrTimer)clearTimeout(old.qrTimer);old.stopped=true;
    if(old.socket){try{old.socket.ev.removeAllListeners();old.socket.end(new Error('STALE_SESSION_RESTART'))}catch(_){}}
    sessions.delete(id);if(!hasSavedSession(id))clearAuthState(id);
  }else if(old){if(old.reconnectTimer)clearTimeout(old.reconnectTimer);if(old.qrTimer)clearTimeout(old.qrTimer);old.stopped=true}
  fs.mkdirSync(dir(id),{recursive:true,mode:0o700});
  const {state,saveCreds}=await useMultiFileAuthState(dir(id));
  const paired=credsAreRegistered(state.creds);
  const current={status:'CONNECTING',qrDataUrl:null,phone:null,lastError:null,socket:null,reconnectTimer:null,qrTimer:null,startedAt:Date.now(),stopped:false,sentMessageIds:new Set(),paired,qrShown:false,opened:false};
  logStatus(id,'CONNECTING',{paired,auto});
  sessions.set(id,current);
  const sender={provider:'BAILEYS_QR',async sendText({to,jid,text}){if(!current.socket)throw new Error('WHATSAPP_QR_NOT_CONNECTED');const direct=normalizeIndividualJid(jid)||normalizeIndividualJid(to);const phone=String(to||'').replace(/\D/g,'');const target=direct||(phone?`${phone}@s.whatsapp.net`:null);if(!target)throw new Error('WHATSAPP_RECIPIENT_REQUIRED');const r=await current.socket.sendMessage(target,{text:String(text).slice(0,4096)});if(r?.key?.id)current.sentMessageIds.add(r.key.id);return{messages:[{id:r?.key?.id||null}],raw:r}}};
  const sdr=createProductionSdrGateway({repository,sender,env});
  const pipeline=createWebhookPipeline({repository,sdrGateway:sdr});
  spoolProcessors.set(id,buildSpoolProcessor({repository,sdrGateway:sdr}));ensureSpoolTimer();
  let version;try{version=await fetchLatestBaileysVersion()}catch(_){version=null}
  const sock=makeWASocket({auth:state,browser:Browsers.ubuntu('Chrome'),version:version?.version,markOnlineOnConnect:false,syncFullHistory:true,printQRInTerminal:false,connectTimeoutMs:60000,defaultQueryTimeoutMs:60000,qrTimeout:120000,keepAliveIntervalMs:25000,retryRequestDelayMs:3000,generateHighQualityLinkPreview:false});
  current.socket=sock;
  if(!paired)current.qrTimer=setTimeout(()=>{if(sessions.get(id)!==current||current.stopped||current.status!=='CONNECTING'||current.qrDataUrl)return;current.stopped=true;current.status='ERROR';current.lastError='QR_TIMEOUT: QR Code não foi recebido; reiniciando pareamento';try{current.socket?.ws?.close()}catch(_){}clearAuthState(id);current.stopped=false;const retry=nextReconnectAttempt(id);if(retry.exceeded){current.lastError=`WHATSAPP_REGISTRATION_BLOCKED_AFTER_${MAX_AUTO_RECONNECT_ATTEMPTS}_ATTEMPTS: ${current.lastError||''}`.trim();resetReconnectAttempts(id);return}scheduleReconnect(id,repository,env,retry.delay)},25000);
  sock.ev.on('creds.update',saveCreds);
  sock.ev.on('connection.update',async({connection,lastDisconnect,qr})=>{try{if(current.stopped)return;if(qr){if(current.qrTimer)clearTimeout(current.qrTimer);current.qrTimer=null;current.status='QR_READY';current.qrDataUrl=await QRCode.toDataURL(qr,{width:320,margin:4,errorCorrectionLevel:'M'});current.lastError=null;resetReconnectAttempts(id);if(!current.qrShown){current.qrShown=true;logStatus(id,'QR_READY',{round:(qrRounds.get(id)||0)+1,maxRounds:MAX_QR_ROUNDS})}}if(connection==='connecting'&&!qr){current.status='CONNECTING';current.lastError=null}if(connection==='open'){if(current.qrTimer)clearTimeout(current.qrTimer);current.qrTimer=null;current.status='CONNECTED';current.qrDataUrl=null;current.lastError=null;current.phone=sock.user?.id?.split(':')[0]||sock.user?.id?.split('@')[0]||null;current.opened=true;current.paired=true;resetReconnectAttempts(id);resetQrRounds(id);logStatus(id,'CONNECTED',{phone:maskPhone(current.phone),pendingInbound:spoolSize(id)});replaySpool(id,{force:true}).catch(e=>console.error('WHATSAPP_SPOOL_REPLAY_FAILED',{slot:id,error:e.message}))}if(connection==='close'){if(current.qrTimer)clearTimeout(current.qrTimer);current.qrTimer=null;const errorMessage=String(lastDisconnect?.error?.message||''),code=new Boom(lastDisconnect?.error)?.output?.statusCode;current.socket=null;current.qrDataUrl=null;logStatus(id,'CLOSED',{code:code||null,reason:errorMessage.slice(0,120)||null,paired:current.paired,qrShown:current.qrShown});if(current.qrShown&&!current.opened&&code!==DisconnectReason.restartRequired&&!/restart required/i.test(errorMessage)){const round=nextQrRound(id);if(round.exceeded){current.status='ERROR';current.lastError=`QR_EXPIRED: QR Code expirou ${round.round}x sem leitura. Clique em "Tentar novamente" com o celular em mãos.`;resetQrRounds(id);resetReconnectAttempts(id);logStatus(id,'QR_EXPIRED_STOPPED',{rounds:round.round});return}}if(errorMessage.includes('Invalid account signature')){current.status='DISCONNECTED';current.lastError='Invalid account signature; auth state cleared for fresh pairing';clearAuthState(id);current.stopped=false;const retry=nextReconnectAttempt(id);if(!retry.exceeded)scheduleReconnect(id,repository,env,retry.delay);else resetReconnectAttempts(id);return}if(code===DisconnectReason.connectionReplaced){current.status='DISCONNECTED';current.lastError='CONNECTION_REPLACED: outra instância/aparelho assumiu esta sessão; reconexão automática suspensa';resetReconnectAttempts(id);resetQrRounds(id);logStatus(id,'REPLACED_STOPPED');return}if(code===DisconnectReason.restartRequired||/Stream Errored.*restart required/i.test(errorMessage)){current.status='CONNECTING';current.lastError=null;current.stopped=false;scheduleReconnect(id,repository,env,500);return}current.status=code===DisconnectReason.loggedOut?'LOGGED_OUT':'DISCONNECTED';current.lastError=errorMessage||`CONNECTION_CLOSED_${code||'UNKNOWN'}`;if(code===DisconnectReason.loggedOut){clearAuthState(id);resetQrRounds(id);resetReconnectAttempts(id);return}if(code===DisconnectReason.badSession)clearAuthState(id);current.stopped=false;const retry=nextReconnectAttempt(id);if(retry.exceeded){current.lastError=`WHATSAPP_REGISTRATION_BLOCKED_AFTER_${MAX_AUTO_RECONNECT_ATTEMPTS}_ATTEMPTS: ${current.lastError||''}`.trim();resetReconnectAttempts(id);return}scheduleReconnect(id,repository,env,retry.delay)}}catch(e){current.status='ERROR';current.lastError=e.message;current.stopped=false;const retry=nextReconnectAttempt(id);if(!retry.exceeded)scheduleReconnect(id,repository,env,2500);else resetReconnectAttempts(id)}});
  sock.ev.on('messaging-history.set',async({messages=[]}={})=>{for(const msg of messages){try{await saveHistoryMessage({repository,msg,slot:id,socket:sock})}catch(e){current.lastError=`HISTORY_SYNC_ERROR: ${e.message}`}}});
  sock.ev.on('messages.upsert',async({messages,type,requestId})=>{
    let payload=null;
    console.log('WHATSAPP_UPSERT',{slot:id,type,requestId:Boolean(requestId),count:(messages||[]).length});
    if(!shouldProcessUpsert(type,requestId))return;
    for(const msg of messages||[]){
      payload=null;
      try{
        if(!msg?.message)continue;
        const identity=await resolveMessageIdentity(msg.key||{},sock);
        if(!identity.phone&&!identity.jid){current.lastError=`MESSAGE_IDENTITY_RESOLUTION_FAILED:${msg.key?.remoteJid||msg.key?.participant||'UNKNOWN'}`;console.warn('WHATSAPP_IDENTITY_RESOLUTION_FAILED',{slot:id,type,remoteJid:msg.key?.remoteJid||null,remoteJidAlt:msg.key?.remoteJidAlt||null});continue}
        if(!identity.phone&&identity.jid?.endsWith('@lid'))console.log('WHATSAPP_LID_FALLBACK',{slot:id,jid:identity.jid});
        const text=messageText(msg.message),externalId=msg.key?.id||null;
        if(msg.key?.fromMe){
          if(externalId&&current.sentMessageIds.has(externalId)){current.sentMessageIds.delete(externalId);continue}
          const lead=await findOrCreateWhatsappLead(repository,{...identity,source:'WHATSAPP'});
          await repository.createMessage({lead_id:lead.id,channel:'WHATSAPP',direction:'OUTBOUND',external_message_id:externalId,text_content:text,metadata:{provider:'BAILEYS_QR',slot:id,source:'WHATSAPP_MANUAL',whatsapp_jid:identity.jid}});
          await repository.createEvent({lead_id:lead.id,type:'WHATSAPP_MANUAL_OUTBOUND',idempotency_key:externalId?`WHATSAPP_MANUAL_OUTBOUND:${externalId}`:null,payload:{external_message_id:externalId,slot:id,whatsapp_jid:identity.jid}});
          continue;
        }
        payload={channel:'WHATSAPP',external_message_id:externalId,phone:identity.phone,whatsapp_jid:identity.jid,name:msg.pushName||null,timestamp:messageTimestamp(msg.messageTimestamp),type:'text',text,media_url:null,source:`WHATSAPP_QR_SLOT_${id}`,campaign:null};
        const outcomes=await pipeline([payload]);
        const failure=(outcomes||[]).find(x=>x?.status==='error');
        if(failure){current.lastError=`MESSAGE_PIPELINE_ERROR:${failure.error||'PROCESSING_ERROR'}`;console.error('WHATSAPP_PIPELINE_ERROR',{slot:id,error:failure.error||'PROCESSING_ERROR'});spoolInbound(id,payload,failure.error)}
        else{current.lastError=null;console.log('WHATSAPP_PIPELINE_OK',{slot:id,status:outcomes?.[0]?.status||'UNKNOWN'})}
      }catch(e){current.lastError=`MESSAGE_PIPELINE_ERROR: ${e.message}`;console.error('WHATSAPP_PIPELINE_EXCEPTION',{slot:id,error:e.message});if(payload)spoolInbound(id,payload,e.message)}
    }
  });
  return status(id);
}

async function disconnect(slot){const id=slotId(slot),c=sessions.get(id);if(c?.reconnectTimer)clearTimeout(c.reconnectTimer);if(c?.qrTimer)clearTimeout(c.qrTimer);if(c)c.stopped=true;if(c?.socket){try{await c.socket.logout()}catch(_){}}clearAuthState(id);sessions.delete(id);resetReconnectAttempts(id);return status(id)}
async function send(slot,{to,text}){const id=slotId(slot),c=sessions.get(id);if(!c?.socket||c.status!=='CONNECTED')throw new Error('WHATSAPP_QR_NOT_CONNECTED');const direct=normalizeIndividualJid(to),phone=String(to||'').replace(/\D/g,''),target=direct||(phone?`${phone}@s.whatsapp.net`:null);if(!target)throw new Error('WHATSAPP_RECIPIENT_REQUIRED');const r=await c.socket.sendMessage(target,{text:String(text).slice(0,4096)});if(r?.key?.id)c.sentMessageIds.add(r.key.id);return r}
function list(){return Array.from({length:MAX_SLOTS},(_,i)=>status(i+1))}
async function restoreSavedSessions({repository,env=process.env}={}){const restored=[];if(!repository||String(env.WHATSAPP_AUTO_RESTORE||'true').toLowerCase()==='false')return restored;const limit=configuredMaxSlots(env);for(let id=1;id<=MAX_SLOTS;id++){if(!hasSavedSession(id))continue;if(id>limit){logStatus(id,'RESTORE_SKIPPED_SLOT_DISABLED',{maxSlots:limit});continue}try{await connect(id,{repository,env,auto:true});restored.push(id);logStatus(id,'RESTORE_STARTED')}catch(e){console.error('WHATSAPP_RESTORE_FAILED',{slot:id,error:e.message})}}return restored}
module.exports={MAX_SLOTS,connect,disconnect,send,status,list,jidToPhone,normalizeIndividualJid,extractInboundJid,extractInboundPhone,resolveMessageIdentity,resolveMessagePhone,slotId,isSessionStale,STALE_SESSION_TIMEOUT_MS,LID_MAPPING_TIMEOUT_MS,backoffDelay,MAX_AUTO_RECONNECT_ATTEMPTS,nextReconnectAttempt,resetReconnectAttempts,shouldProcessUpsert,credsAreRegistered,hasSavedSession,nextQrRound,resetQrRounds,MAX_QR_ROUNDS,restoreSavedSessions,configuredMaxSlots,BASE_DIR,buildSpoolProcessor,getSpool,replaySpool,SPOOL_AUTOREPLY_MAX_AGE_MS};
