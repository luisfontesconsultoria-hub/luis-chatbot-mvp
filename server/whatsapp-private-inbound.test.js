// Reprodução ponta a ponta do handler REAL de messages.upsert (qr-manager.connect) com o Baileys
// substituído por um socket falso. Modela o schema real (leads.phone anulável após 20260911,
// índices únicos de messages/events) e o comportamento do PostgREST sem ORDER BY (ordem de heap).
// Cenários: LID-only, remoteJidAlt, participantPn, grupo, chamada pendurada, phone NOT NULL, logs Signal.
const assert=require('assert');const fs=require('fs');const os=require('os');const path=require('path');const {EventEmitter}=require('events');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'wa-private-'));
process.env.WHATSAPP_QR_SESSION_DIR=tmp;process.env.CRM_ATOMIC_INBOUND='off';process.env.WHATSAPP_PIPELINE_TIMEOUT_MS='400';process.env.WHATSAPP_SEND_TIMEOUT_MS='200';

// ---- Baileys falso -------------------------------------------------------------------------
const sockets=[];
const fakeBaileys={
  default(opts){const ev=new EventEmitter();const sock={ev,opts,user:{id:'5551900000000:7@s.whatsapp.net'},sent:[],signalRepository:{lidMapping:{async getPNForLID(){return null}}},
    async sendMessage(jid,content){if(sock.hangSend)return new Promise(()=>{});sock.sent.push({jid,text:content.text});return{key:{id:`OUT-${sock.sent.length}-${Date.now()}`}}},end(){},logout:async()=>{},ws:{close(){}}};sockets.push(sock);return sock},
  async useMultiFileAuthState(){return{state:{creds:{registered:true,me:{id:'5551900000000:7@s.whatsapp.net'}},keys:{}},saveCreds:async()=>{}}},
  DisconnectReason:{connectionClosed:428,connectionLost:408,connectionReplaced:440,timedOut:408,loggedOut:401,badSession:500,restartRequired:515},
  Browsers:{ubuntu:()=>['Ubuntu','Chrome','22']},
  async fetchLatestBaileysVersion(){return{version:[2,3000,0]}}
};
const baileysPath=require.resolve('@whiskeysockets/baileys');
require.cache[baileysPath]={id:baileysPath,filename:baileysPath,loaded:true,exports:fakeBaileys};

// ---- captura de logs -----------------------------------------------------------------------
const logs=[];const orig={log:console.log,info:console.info,warn:console.warn,error:console.error};
const rawWrites=[];const origWrite=process.stdout.write.bind(process.stdout);const origErrWrite=process.stderr.write.bind(process.stderr);
for(const k of Object.keys(orig))console[k]=(...a)=>{logs.push({level:k,tag:typeof a[0]==='string'?a[0]:'',args:a});};
function tags(){return logs.map(l=>l.tag)}
function reset(){logs.length=0}

// ---- Supabase/PostgREST falso --------------------------------------------------------------
function fakeClient({phoneNotNull=false,hang=null}={}){
  const db={leads:[],messages:[],events:[],audit_log:[]};let seq=0;
  const uniq={leads:[['phone'],['whatsapp_jid']],messages:[['external_message_id']],events:[['idempotency_key']]};
  function from(name){
    const st={op:'select',row:null,filters:[],order:null,limit:null,single:false};
    const exec=()=>{
      if(hang&&hang(name,st.op))return new Promise(()=>{});
      const rows=db[name];const match=r=>st.filters.every(([k,v])=>r[k]===v);
      if(st.op==='insert'){
        const row={id:`${name}-${++seq}`,created_at:new Date(Date.now()+seq).toISOString(),updated_at:new Date(Date.now()+seq).toISOString(),...st.row};
        if(name==='leads'&&phoneNotNull&&(row.phone===undefined||row.phone===null))return Promise.resolve({data:null,error:{code:'23502',message:'null value in column "phone" of relation "leads" violates not-null constraint'}});
        for(const cols of (uniq[name]||[]))if(cols.every(c=>row[c]!=null)&&rows.some(r=>cols.every(c=>r[c]===row[c])))return Promise.resolve({data:null,error:{code:'23505',message:'duplicate key value violates unique constraint'}});
        rows.push(row);return Promise.resolve({data:st.single?row:[row],error:null});
      }
      if(st.op==='update'){const hit=rows.filter(match);hit.forEach(r=>Object.assign(r,st.row,{updated_at:new Date(Date.now()+(++seq)).toISOString()}));return Promise.resolve({data:st.single?hit[0]||null:hit,error:st.single&&!hit[0]?{code:'PGRST116'}:null})}
      let out=rows.filter(match);
      if(st.order){const [col,asc]=st.order;out=out.slice().sort((a,b)=>String(a[col]).localeCompare(String(b[col]))*(asc?1:-1))}
      if(st.limit!=null)out=out.slice(0,st.limit);
      if(st.single)return Promise.resolve(out[0]?{data:out[0],error:null}:{data:null,error:{code:'PGRST116',message:'no rows'}});
      return Promise.resolve({data:out,error:null});
    };
    const q={select(){return q},insert(r){st.op='insert';st.row=r;return q},update(r){st.op='update';st.row=r;return q},eq(k,v){st.filters.push([k,v]);return q},in(){return q},gte(){return q},lte(){return q},
      order(col,{ascending=true}={}){if(!st.order)st.order=[col,ascending];return q},limit(n){st.limit=n;return q},single(){st.single=true;return exec()},maybeSingle(){st.single=true;return exec()},then(res,rej){return exec().then(res,rej)}};
    return q;
  }
  return{db,from,async rpc(){throw new Error('rpc must not be called with CRM_ATOMIC_INBOUND=off')}};
}

const {createSupabaseRepository}=require('../backend/persistence/supabase-adapter');
const qr=require('./qr-manager');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(pred,ms=3000){const t=Date.now();while(Date.now()-t<ms){if(pred())return true;await wait(10)}return false}
const TERMINAL=['WHATSAPP_PIPELINE_OK','WHATSAPP_PIPELINE_ERROR','WHATSAPP_PIPELINE_EXCEPTION','WHATSAPP_PIPELINE_TIMEOUT','WHATSAPP_INBOUND_SPOOLED','WHATSAPP_GROUP_MESSAGE_IGNORED'];
let slotSeq=0;
async function open(client){
  const slot=(++slotSeq%4)+1;await qr.disconnect(slot).catch(()=>{});
  const repository=createSupabaseRepository(client);
  await qr.connect(slot,{repository,env:{...process.env,AI_ASSIST_ENABLED:'false'}});
  const sock=sockets[sockets.length-1];sock.ev.emit('connection.update',{connection:'open'});await wait(20);
  return{slot,sock,repository};
}
function upsert(sock,key,text='Olá, quero abrir conta PJ',pushName='Cliente Teste'){sock.ev.emit('messages.upsert',{type:'notify',messages:[{key:{fromMe:false,...key},pushName,messageTimestamp:Math.floor(Date.now()/1000),message:{conversation:text}}]})}

const results=[];
async function scenario(name,fn){reset();try{await fn();results.push([name,'PASS'])}catch(e){results.push([name,'FAIL',e.message.split('\n')[0]])}}

(async()=>{
  await scenario('LID-only privado: lead sem telefone, mensagem, SDR 1x, resultado terminal',async()=>{
    const client=fakeClient();const {sock}=await open(client);
    upsert(sock,{remoteJid:'111222333444555@lid',id:'WAMID-LID-1'});
    assert.ok(await until(()=>tags().some(t=>TERMINAL.includes(t))),'nenhum resultado terminal do pipeline foi logado');
    assert.ok(tags().includes('WHATSAPP_PIPELINE_OK'),`terminal inesperado: ${tags().filter(t=>TERMINAL.includes(t))}`);
    assert.strictEqual(client.db.leads.length,1);assert.strictEqual(client.db.leads[0].phone,undefined);assert.strictEqual(client.db.leads[0].whatsapp_jid,'111222333444555@lid');
    assert.strictEqual(client.db.messages.filter(m=>m.direction==='INBOUND').length,1);
    assert.strictEqual(sock.sent.length,1,'SDR deve responder exatamente 1x');assert.strictEqual(sock.sent[0].jid,'111222333444555@lid');
    upsert(sock,{remoteJid:'111222333444555@lid',id:'WAMID-LID-1'});await wait(150);
    assert.strictEqual(sock.sent.length,1,'reentrega do mesmo id não pode responder de novo');
  });
  await scenario('Conversas: lead novo aparece com >100 leads na base (GET /api/crm/leads?limit=100)',async()=>{
    const client=fakeClient();for(let i=0;i<150;i++)client.db.leads.push({id:`old-${i}`,phone:`55510000${String(i).padStart(4,'0')}`,created_at:new Date(Date.now()-86400000+i).toISOString(),updated_at:new Date(Date.now()-86400000+i).toISOString(),status:'NEW'});
    const {sock,repository}=await open(client);
    upsert(sock,{remoteJid:'999888777666555@lid',id:'WAMID-LID-2'});
    assert.ok(await until(()=>tags().includes('WHATSAPP_PIPELINE_OK')),'pipeline não concluiu');
    const listed=await repository.listLeads({limit:100});
    assert.ok(listed.some(l=>l.whatsappJid==='999888777666555@lid'),'lead novo do WhatsApp fora da lista de Conversas (listLeads sem ORDER BY)');
  });
  await scenario('LID + remoteJidAlt: reconcilia por telefone',async()=>{
    const client=fakeClient();const {sock}=await open(client);
    upsert(sock,{remoteJid:'555444333222111@lid',remoteJidAlt:'5551988887777@s.whatsapp.net',id:'WAMID-ALT-1'});
    assert.ok(await until(()=>tags().includes('WHATSAPP_PIPELINE_OK')));
    assert.strictEqual(client.db.leads.length,1);assert.strictEqual(client.db.leads[0].phone,'5551988887777');assert.strictEqual(client.db.leads[0].whatsapp_jid,'555444333222111@lid');
  });
  await scenario('LID + participantPn: resolve telefone',async()=>{
    const client=fakeClient();const {sock}=await open(client);
    upsert(sock,{remoteJid:'121212121212121@lid',participantPn:'5551977776666@s.whatsapp.net',id:'WAMID-PN-1'});
    assert.ok(await until(()=>tags().includes('WHATSAPP_PIPELINE_OK')));
    assert.strictEqual(client.db.leads[0].phone,'5551977776666');
  });
  await scenario('Grupo: ignorado de forma explícita, sem lead e sem resposta',async()=>{
    const client=fakeClient();const {sock}=await open(client);
    upsert(sock,{remoteJid:'120363000000000000@g.us',participant:'343434343434343@lid',participantPn:'5551966665555@s.whatsapp.net',id:'WAMID-GRP-1'},'bom dia grupo');
    await until(()=>tags().some(t=>TERMINAL.includes(t)),800);await wait(100);
    assert.strictEqual(client.db.leads.length,0,'mensagem de grupo criou lead comercial');
    assert.strictEqual(sock.sent.length,0,'SDR respondeu participante de grupo no privado');
    assert.ok(tags().includes('WHATSAPP_GROUP_MESSAGE_IGNORED'),'grupo não foi ignorado explicitamente');
  });
  await scenario('Chamada pendurada no banco: resultado terminal + spool (nunca silêncio)',async()=>{
    const client=fakeClient({hang:(t,op)=>t==='messages'&&op==='insert'});const {slot,sock}=await open(client);
    upsert(sock,{remoteJid:'777777777777777@lid',id:'WAMID-HANG-1'});
    assert.ok(await until(()=>tags().some(t=>TERMINAL.includes(t)),2000),'handler pendurado: nenhum resultado terminal (sintoma de produção)');
    assert.ok(tags().includes('WHATSAPP_INBOUND_SPOOLED'),'mensagem pendurada não foi para o spool');
    assert.ok(qr.getSpool(slot).size()>=1);
  });
  await scenario('Envio pendurado no WhatsApp: resultado terminal, sem resposta dupla',async()=>{
    const client=fakeClient();const {slot,sock}=await open(client);sock.hangSend=true;
    upsert(sock,{remoteJid:'787878787878787@lid',id:'WAMID-SENDHANG-1'});
    assert.ok(await until(()=>tags().some(t=>TERMINAL.includes(t)),2000),'envio pendurado sem resultado terminal');
    assert.ok(tags().includes('WHATSAPP_PIPELINE_ERROR')||tags().includes('WHATSAPP_PIPELINE_TIMEOUT'));
    sock.hangSend=false;const r=await qr.replaySpool(slot,{force:true});
    assert.strictEqual(sock.sent.length,0,'replay não pode reenviar resposta cuja entrega é incerta');
    assert.ok(client.db.events.some(e=>e.type==='SPOOL_REPLAY_NEEDS_HUMAN'),'replay deve pedir retorno humano');void r;
  });
  await scenario('Schema com phone NOT NULL: WHATSAPP_PIPELINE_ERROR + spool',async()=>{
    const client=fakeClient({phoneNotNull:true});const {slot,sock}=await open(client);
    upsert(sock,{remoteJid:'565656565656565@lid',id:'WAMID-NN-1'});
    assert.ok(await until(()=>tags().some(t=>TERMINAL.includes(t))));
    assert.ok(tags().includes('WHATSAPP_PIPELINE_ERROR'));assert.ok(tags().includes('WHATSAPP_INBOUND_SPOOLED'));assert.ok(qr.getSpool(slot).size()>=1);
  });
  await scenario('Logs: estruturas Signal e JID completo não vazam',async()=>{
    const secret=Buffer.from('0123456789abcdef0123456789abcdef');
    const w=[];process.stdout.write=(c,...r)=>{w.push(String(c));return true};process.stderr.write=(c,...r)=>{w.push(String(c));return true};
    try{
      for(const k of Object.keys(orig))console[k]=orig[k];
      if(typeof qr.installSignalLogGuard==='function')qr.installSignalLogGuard();
      console.info('Closing session:',{currentRatchet:{rootKey:secret,ephemeralKeyPair:{privKey:secret,pubKey:secret}},indexInfo:{baseKey:secret,remoteIdentityKey:secret}});
      console.warn('Session already closed',{chains:{[secret.toString('base64')]:{messageKeys:{1:secret}}}});
      const client=fakeClient();const {sock}=await open(client);
      upsert(sock,{remoteJid:'313131313131313@lid',id:'WAMID-LOG-1'});await wait(200);
    }finally{process.stdout.write=origWrite;process.stderr.write=origErrWrite;for(const k of Object.keys(orig))console[k]=(...a)=>{logs.push({level:k,tag:typeof a[0]==='string'?a[0]:'',args:a})}}
    const out=w.join('');
    for(const needle of ['rootKey','privKey','baseKey','remoteIdentityKey',secret.toString('base64'),'30 31 32 33','313131313131313@lid'])assert.ok(!out.includes(needle),`log expôs: ${needle}`);
  });

  await scenario('Supabase: fetch pendurado aborta com erro transitório',async()=>{
    const http=require('http');const {createTimeoutFetch}=require('./supabase-runtime');const {isTransientError}=require('./inbound-spool');
    const srv=http.createServer(()=>{}).listen(0);await new Promise(r=>srv.once('listening',r));
    try{const f=createTimeoutFetch(150);let err=null;const t=Date.now();try{await f(`http://127.0.0.1:${srv.address().port}/rest/v1/leads`)}catch(e){err=e}
      assert.ok(err,'fetch deveria abortar');assert.ok(Date.now()-t<2000);assert.ok(isTransientError(`${err.name}: ${err.message}`),`erro não transitório: ${err.name}: ${err.message}`);}
    finally{srv.closeAllConnections?.();srv.close()}
  });
  for(const k of Object.keys(orig))console[k]=orig[k];
  for(const r of results)console.log(r[1],r[0],r[2]?`— ${r[2]}`:'');
  fs.rmSync(tmp,{recursive:true,force:true});
  const failed=results.filter(r=>r[1]==='FAIL').length;
  if(failed){console.error(`${failed} cenário(s) falharam`);process.exit(1)}
  console.log('PASS WhatsApp private inbound end-to-end');process.exit(0);
})().catch(e=>{for(const k of Object.keys(orig))console[k]=orig[k];console.error(e);process.exit(1)});
