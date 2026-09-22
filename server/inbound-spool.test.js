const assert=require('assert');const fs=require('fs');const os=require('os');const path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'spool-'));
process.env.WHATSAPP_QR_SESSION_DIR=tmp;
const {createInboundSpool}=require('./inbound-spool');
const qr=require('./qr-manager');
(async()=>{
  const sp=createInboundSpool({dir:path.join(tmp,'a'),name:'slot-1',maxAttempts:2,maxEntries:3});
  const m1={external_message_id:'m1',phone:'5551999990001',text:'oi',timestamp:new Date().toISOString()};
  assert.strictEqual(sp.enqueue(m1,'fetch failed').queued,true);
  assert.strictEqual(sp.enqueue(m1,'fetch failed').reason,'ALREADY_QUEUED','mesma mensagem não duplica na fila');
  assert.strictEqual(sp.size(),1);
  assert.strictEqual((fs.statSync(sp.file).mode&0o777),0o600,'arquivo só legível pelo processo');
  // banco ainda fora: continua na fila, conta tentativa
  let r=await sp.replay(async()=>{throw new Error('fetch failed')});
  assert.deepStrictEqual(r,{done:0,retry:1,dead:0});assert.strictEqual(sp.size(),1);
  // 2ª falha atinge maxAttempts -> dead-letter
  r=await sp.replay(async()=>{throw new Error('fetch failed')});
  assert.strictEqual(r.dead,1);assert.strictEqual(sp.size(),0);assert.ok(fs.readFileSync(sp.deadFile,'utf8').includes('"m1"'));
  // banco volta: processa e remove
  sp.enqueue({...m1,external_message_id:'m2'});
  r=await sp.replay(async()=>'done');assert.strictEqual(r.done,1);assert.strictEqual(sp.size(),0);
  // limite de tamanho
  for(const k of ['a','b','c'])sp.enqueue({...m1,external_message_id:k});
  assert.strictEqual(sp.enqueue({...m1,external_message_id:'d'}).reason,'SPOOL_FULL');
  // mensagem que chega durante o replay é preservada
  const sp2=createInboundSpool({dir:path.join(tmp,'b'),name:'x'});
  sp2.enqueue({external_message_id:'p1'});
  await sp2.replay(async()=>{sp2.enqueue({external_message_id:'p2'});return 'done'});
  assert.strictEqual(sp2.size(),1,'p2 chegou no meio do replay e não pode sumir');

  // processador do qr-manager: recente -> pipeline com SDR; antiga -> só grava, sem resposta automática
  const calls={sdr:0,events:[]};let db={leads:{},events:new Set(),messages:new Set()};
  const repository={
    async findOrCreateLeadByPhone(phone){return db.leads[phone]||(db.leads[phone]={id:'lead-'+phone,phone})},
    async createEvent(e){if(e.idempotency_key&&db.events.has(e.idempotency_key)){const x=new Error('duplicate key');x.code='23505';throw x}db.events.add(e.idempotency_key);calls.events.push(e.type);return e},
    async createMessage(m){if(db.messages.has(m.external_message_id)){const x=new Error('duplicate');x.code='23505';throw x}db.messages.add(m.external_message_id);return{id:'msg',...m}}
  };
  const {createWebhookPipeline}=require('./webhook-pipeline');
  const pipeline=createWebhookPipeline({repository,sdrGateway:{async process(){calls.sdr++;return{status:'REPLIED'}}}});
  const now=Date.parse('2026-09-23T12:00:00Z');
  const proc=qr.buildSpoolProcessor({repository,pipeline,now:()=>now});
  assert.strictEqual(await proc({channel:'WHATSAPP',external_message_id:'fresh',phone:'5551',text:'oi',timestamp:new Date(now-60000).toISOString()}),'done');
  assert.strictEqual(calls.sdr,1,'mensagem recente recebe resposta do SDR');
  assert.strictEqual(await proc({channel:'WHATSAPP',external_message_id:'old',phone:'5552',text:'oi',timestamp:new Date(now-3600000).toISOString()}),'done');
  assert.strictEqual(calls.sdr,1,'mensagem de 1h atrás NÃO dispara resposta automática');
  assert.ok(calls.events.includes('SPOOL_REPLAYED_NO_AUTOREPLY'),'marca para retorno humano');
  assert.ok(db.messages.has('old'),'mensagem antiga fica gravada no CRM');
  // replay repetido é idempotente
  assert.strictEqual(await proc({channel:'WHATSAPP',external_message_id:'fresh',phone:'5551',text:'oi',timestamp:new Date(now-60000).toISOString()}),'done');
  assert.strictEqual(calls.sdr,1,'replay da mesma mensagem não responde duas vezes');
  // banco fora -> processador lança (fica na fila)
  const down={async findOrCreateLeadByPhone(){throw new Error('fetch failed')},async createEvent(){},async createMessage(){}};
  const p2=qr.buildSpoolProcessor({repository:down,pipeline:createWebhookPipeline({repository:down}),now:()=>now});
  await assert.rejects(p2({external_message_id:'z',phone:'1',timestamp:new Date(now).toISOString()}),/fetch failed/);
  fs.rmSync(tmp,{recursive:true,force:true});
  console.log('inbound-spool tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
