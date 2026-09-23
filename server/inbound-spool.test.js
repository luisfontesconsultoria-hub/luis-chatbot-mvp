const assert=require('assert');const fs=require('fs');const os=require('os');const path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'spool-'));
process.env.WHATSAPP_QR_SESSION_DIR=tmp;
const {createInboundSpool,isTransientError,backoffMs}=require('./inbound-spool');
const qr=require('./qr-manager');
const {createWebhookPipeline}=require('./webhook-pipeline');
(async()=>{
  let clock=Date.parse('2026-09-23T12:00:00Z');const now=()=>clock;
  const sp=createInboundSpool({dir:path.join(tmp,'a'),name:'slot-1',maxAttempts:2,maxEntries:3,now});
  const m1={external_message_id:'m1',phone:'5551999990001',text:'oi',timestamp:new Date(clock).toISOString()};
  assert.strictEqual(sp.enqueue(m1,'fetch failed').queued,true);
  assert.strictEqual(sp.enqueue(m1,'fetch failed').reason,'ALREADY_QUEUED','mesma mensagem não duplica na fila');
  assert.strictEqual(sp.size(),1);
  assert.strictEqual((fs.statSync(sp.file).mode&0o777),0o600,'arquivo só legível pelo processo');

  // classificação de erro
  assert.ok(isTransientError('TypeError: fetch failed'));assert.ok(isTransientError('upstream timeout'));assert.ok(isTransientError('HTTP 503'));
  assert.ok(!isTransientError('null value in column "lead_id" violates not-null constraint'));
  assert.strictEqual(backoffMs(1),60000);assert.strictEqual(backoffMs(3),240000);assert.strictEqual(backoffMs(50),30*60000);

  // backoff: antes do nextAttemptAt não tenta
  let calls=0;let r=await sp.replay(async()=>{calls++;return 'done'});
  assert.strictEqual(calls,0);assert.strictEqual(r.deferred,1);
  // banco fora por MUITO mais que maxAttempts: erro transitório NUNCA vai pro dead-letter antes de 7 dias
  for(let i=0;i<20;i++){clock+=31*60000;r=await sp.replay(async()=>{throw new Error('fetch failed')});assert.strictEqual(r.dead,0,'transitório não pode matar a mensagem')}
  assert.strictEqual(sp.size(),1);
  // banco volta: processa e remove
  clock+=31*60000;r=await sp.replay(async()=>'done');assert.strictEqual(r.done,1);assert.strictEqual(sp.size(),0);

  // erro não transitório: dead-letter após maxAttempts (2)
  sp.enqueue({...m1,external_message_id:'bad'});
  await sp.replay(async()=>{throw new Error('violates not-null constraint')},{force:true});
  assert.strictEqual(sp.size(),1);
  r=await sp.replay(async()=>{throw new Error('violates not-null constraint')},{force:true});
  assert.strictEqual(r.dead,1);assert.strictEqual(sp.size(),0);assert.strictEqual(sp.deadSize(),1);
  // reprocesso manual do dead-letter
  assert.deepStrictEqual(sp.requeueDead(),{requeued:1,skipped:0});assert.strictEqual(sp.size(),1);assert.strictEqual(sp.deadSize(),0);
  await sp.replay(async()=>'done',{force:true});assert.strictEqual(sp.size(),0);

  // idade máxima (7 dias) -> dead-letter
  sp.enqueue({...m1,external_message_id:'old'});clock+=8*24*3600*1000;
  r=await sp.replay(async()=>'done',{force:true});assert.strictEqual(r.dead,1);assert.strictEqual(r.done,0);

  // circuit breaker: 1º erro transitório para o lote (não martela o banco com 5000 chamadas)
  const sp3=createInboundSpool({dir:path.join(tmp,'c'),name:'x',now});
  for(const k of ['a','b','c'])sp3.enqueue({external_message_id:k});
  let tries=0;r=await sp3.replay(async()=>{tries++;throw new Error('fetch failed')},{force:true});
  assert.strictEqual(tries,1);assert.strictEqual(r.halted,true);assert.strictEqual(sp3.size(),3);

  // linha corrompida não some: vai para o dead-letter com conteúdo bruto
  fs.appendFileSync(sp3.file,'{linha quebrada\n');
  assert.strictEqual(sp3.size(),3);assert.ok(fs.readFileSync(sp3.deadFile,'utf8').includes('CORRUPTED_LINE'));

  // limite de tamanho
  const sp4=createInboundSpool({dir:path.join(tmp,'d'),name:'x',maxEntries:2,now});
  sp4.enqueue({external_message_id:'1'});sp4.enqueue({external_message_id:'2'});
  assert.strictEqual(sp4.enqueue({external_message_id:'3'}).reason,'SPOOL_FULL');

  // mensagem que chega durante o replay é preservada
  const sp2=createInboundSpool({dir:path.join(tmp,'b'),name:'x',now});
  sp2.enqueue({external_message_id:'p1'});
  await sp2.replay(async()=>{sp2.enqueue({external_message_id:'p2'});return 'done'},{force:true});
  assert.strictEqual(sp2.size(),1,'p2 chegou no meio do replay e não pode sumir');

  // processador do qr-manager: recente -> SDR; antiga -> só grava, sem resposta automática
  const calls2={sdr:0,events:[]};const db={leads:{},events:new Map(),messages:new Set()};
  const repository={
    async findOrCreateLeadByPhone(phone){return db.leads[phone]||(db.leads[phone]={id:'lead-'+phone,phone})},
    async createEvent(e){if(e.idempotency_key&&db.events.has(e.idempotency_key))return db.events.get(e.idempotency_key);db.events.set(e.idempotency_key||Math.random(),e);calls2.events.push(e.type);return e},
    async listEvents({leadId,type}){return[...db.events.values()].filter(e=>e.lead_id===leadId&&(!type||e.type===type))},
    async createMessage(m){if(db.messages.has(m.external_message_id)){const x=new Error('duplicate');x.code='23505';throw x}db.messages.add(m.external_message_id);return{id:'msg',...m}}
  };
  const sdrGateway={async process(){calls2.sdr++;return{status:'REPLIED'}}};
  const t0=Date.parse('2026-09-23T12:00:00Z');
  const proc=qr.buildSpoolProcessor({repository,sdrGateway,now:()=>t0});
  assert.strictEqual(await proc({channel:'WHATSAPP',external_message_id:'fresh',phone:'5551',text:'oi',timestamp:new Date(t0-60000).toISOString()}),'done');
  assert.strictEqual(calls2.sdr,1,'mensagem recente recebe resposta do SDR');
  assert.strictEqual(await proc({channel:'WHATSAPP',external_message_id:'old',phone:'5552',text:'oi',timestamp:new Date(t0-3600000).toISOString()}),'done');
  assert.strictEqual(calls2.sdr,1,'mensagem de 1h atrás NÃO dispara resposta automática');
  assert.ok(calls2.events.includes('SPOOL_REPLAYED_NO_AUTOREPLY'),'marca para retorno humano');
  assert.ok(db.messages.has('old'),'mensagem antiga fica gravada no CRM');
  assert.strictEqual(await proc({channel:'WHATSAPP',external_message_id:'fresh',phone:'5551',text:'oi',timestamp:new Date(t0-60000).toISOString()}),'done');
  assert.strictEqual(calls2.sdr,1,'replay da mesma mensagem não responde duas vezes');
  assert.ok(!calls2.events.includes('SPOOL_REPLAY_NEEDS_HUMAN'),'SDR já confirmado: não pede humano');
  // mensagem gravada mas SDR nunca confirmado -> não re-roda SDR (risco de resposta dupla), pede humano
  db.messages.add('orphan');
  assert.strictEqual(await proc({channel:'WHATSAPP',external_message_id:'orphan',phone:'5553',text:'oi',timestamp:new Date(t0-60000).toISOString()}),'done');
  assert.strictEqual(calls2.sdr,1);assert.ok(calls2.events.includes('SPOOL_REPLAY_NEEDS_HUMAN'));
  // banco fora -> processador lança (fica na fila)
  const down={async findOrCreateLeadByPhone(){throw new Error('fetch failed')},async createEvent(){},async createMessage(){}};
  const p2=qr.buildSpoolProcessor({repository:down,now:()=>t0});
  await assert.rejects(p2({external_message_id:'z',phone:'1',timestamp:new Date(t0).toISOString()}),/fetch failed/);
  fs.rmSync(tmp,{recursive:true,force:true});
  console.log('inbound-spool tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
