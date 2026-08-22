const { createWebhookPipeline } = require('./webhook-pipeline');
const { createSdrGateway } = require('./sdr-gateway');
const { createOutboundMessageHandler } = require('./outbound-message');

(async () => {
  const db=[]; const events=[]; const sent=[];
  const repo={
    async findOrCreateLeadByPhone(phone, data){ let lead=db.find(x=>x.phone===phone); if(!lead){lead={id:String(db.length+1),phone,...data};db.push(lead)} return lead; },
    async createMessage(m){ const row={id:String(db.length+100),...m}; sent.push(row); return row; },
    async createEvent(e){events.push(e);}
  };
  const sender={ async sendText(p){ return {messages:[{id:'wamid.out.1'}],to:p.to}; } };
  const outbound=createOutboundMessageHandler({repository:repo,sender});
  const sdr=createSdrGateway({ qualify:async()=>({status:'QUALIFIED'}), respond:async({lead})=>{ await outbound.send({lead,text:'Olá! Recebi sua mensagem e vou continuar seu atendimento.'}); return {sent:true}; } });
  const pipeline=createWebhookPipeline({repository:repo,sdrGateway:sdr});
  const first=await pipeline.process([{external_message_id:'wamid.in.1',phone:'5551999999999',timestamp:'2026-08-22T15:00:00Z',text:'Quero abrir conta PJ',source:'WHATSAPP'}]);
  const second=await pipeline.process([{external_message_id:'wamid.in.1',phone:'5551999999999',timestamp:'2026-08-22T15:00:00Z',text:'Quero abrir conta PJ',source:'WHATSAPP'}]);
  if(first[0].status!=='processed') throw Error('E2E_INBOUND_FAILED');
  if(first[0].outcome.status!=='PROCESSED') throw Error('E2E_SDR_FAILED');
  if(!sent.some(x=>x.direction==='OUTBOUND')) throw Error('E2E_OUTBOUND_NOT_PERSISTED');
  if(second[0].status!=='duplicate') throw Error('E2E_IDEMPOTENCY_FAILED');
  if(!events.some(x=>x.event_type==='WHATSAPP_RESPONSE_SENT')) throw Error('E2E_AUDIT_FAILED');
  console.log('PASS V1 E2E contract: inbound -> lead -> SDR -> outbound -> audit -> duplicate protection');
})();
