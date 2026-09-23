// Regressões encontradas na revisão do PR #14 (falhavam no commit 7310b65).
const assert=require('assert');const fs=require('fs');const os=require('os');const path=require('path');const EventEmitter=require('events');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'pr14-'));process.env.WHATSAPP_QR_SESSION_DIR=tmp;
// Baileys simulado (nenhuma conexão real)
const bpath=require.resolve('@whiskeysockets/baileys');const real=require(bpath);const socks=[];
require.cache[bpath].exports={...real,default:()=>{const ev=new EventEmitter();const s={ev,user:null,end(){},ws:{close(){}},logout:async()=>{},sendMessage:async()=>({key:{id:'o'}})};socks.push(s);return s},fetchLatestBaileysVersion:async()=>({version:[2,3000,1]})};
const qr=require('./qr-manager');const {createWebhookPipeline}=require('./webhook-pipeline');const {Boom}=require('@hapi/boom');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function saveCreds(slot){fs.mkdirSync(path.join(tmp,`slot-${slot}`),{recursive:true});fs.writeFileSync(path.join(tmp,`slot-${slot}`,'creds.json'),JSON.stringify({...real.initAuthCreds(),me:{id:`55519999900${slot}:1@s.whatsapp.net`}},real.BufferJSON.replacer))}
(async()=>{
  // 1) P0: falha parcial (lead ok, insert da mensagem falha) -> o replay era descartado pelo guard em memória do pipeline ao vivo
  let failMsg=1;const saved=[];
  const repo={async findOrCreateLeadByPhone(p){return{id:'L1',phone:p}},async createEvent(e){return e},async listEvents(){return[]},
    async createMessage(m){if(failMsg-->0)throw new Error('upstream timeout');saved.push(m.external_message_id);return m}};
  const live=createWebhookPipeline({repository:repo,sdrGateway:{async process(){return{status:'OK'}}}});
  const msg={channel:'WHATSAPP',external_message_id:'X1',phone:'5551',text:'oi',timestamp:new Date().toISOString()};
  assert.strictEqual((await live([msg]))[0].status,'error');
  await qr.buildSpoolProcessor({repository:repo,sdrGateway:{async process(){return{status:'OK'}}}})(msg);
  assert.deepStrictEqual(saved,['X1'],'replay não pode ser descartado pelo guard em memória');
  // e a reentrega ao vivo (Baileys reenviando) também não pode ser descartada após erro
  failMsg=1;const live2=createWebhookPipeline({repository:repo});
  const m2={...msg,external_message_id:'X2'};
  assert.strictEqual((await live2([m2]))[0].status,'error');
  assert.strictEqual((await live2([m2]))[0].status,'processed','após erro o guard libera a chave');

  // 2) P1: restauração ignorava WHATSAPP_MAX_SLOTS (subia slots escondidos da UI)
  assert.strictEqual(qr.configuredMaxSlots({}),1);assert.strictEqual(qr.configuredMaxSlots({WHATSAPP_MAX_SLOTS:'4'}),4);
  assert.strictEqual(qr.configuredMaxSlots({WHATSAPP_MAX_SLOTS:'9'}),4);assert.strictEqual(qr.configuredMaxSlots({WHATSAPP_MAX_SLOTS:'abc'}),1);
  saveCreds(1);saveCreds(2);
  const restored=await qr.restoreSavedSessions({repository:repo,env:{}});
  assert.deepStrictEqual(restored,[1],'com WHATSAPP_MAX_SLOTS=1 só o slot 1 pode ser restaurado');
  assert.strictEqual(qr.status(2).status,'DISCONNECTED');

  // 3) P1: connectionReplaced (440) não pode reconectar sozinho (duas instâncias brigando pela sessão)
  const s=socks[socks.length-1];
  s.ev.emit('connection.update',{connection:'close',lastDisconnect:{error:new Boom('Stream Errored (conflict)',{statusCode:440})}});
  await wait(50);
  const before=socks.length;await wait(1200);
  assert.strictEqual(socks.length,before,'não abre novo socket após connectionReplaced');
  assert.match(qr.status(1).lastError,/CONNECTION_REPLACED/);
  assert.ok(qr.hasSavedSession(1),'credenciais preservadas');

  // 4) permissões da pasta de sessão
  await qr.disconnect(1);
  await qr.connect(3,{repository:repo});
  assert.strictEqual(fs.statSync(path.join(tmp,'slot-3')).mode&0o077,0,'pasta de sessão sem acesso de grupo/outros');
  await qr.disconnect(3);
  fs.rmSync(tmp,{recursive:true,force:true});
  console.log('pr14-regression tests passed');
  process.exit(0);
})().catch(e=>{console.error('FALHA:',e.message);process.exit(1)});
