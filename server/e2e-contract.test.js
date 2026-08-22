const { createWebhookPipeline } = require('./webhook-pipeline');
const { createSdrGateway } = require('./sdr-gateway');
const { createOutboundMessageHandler } = require('./outbound-message');

(async () => {
  const db=[]; const events=[]; const messages=[];
  const repo={
    async findOrCreateLeadByPhone(phone, data){ let lead=db.find(x=>x.phone===phone); if(!lead){lead={id:String(db.length+1),phone,...data};db.push(lead)} return lead; },
    async createMessage(m){ const row={id:String(messages.length+100),...m}; messages.push(row); return row; },
    async createEvent(e){events.push(e);}
  };
  const sender={ async sendText(p){ return {messages:[{id:'wamid.out.1'}],to:p.to}; } };
  const outbound=createOutboundMessageHandler({repository:repo,sender});
  const sdr=createSdrGateway({
    qualify:async()=>({status:'QUALIFIED'}),
    respond:async({lead})=>{ await outbound.send({lead,text:'Olá! Recebi sua mensagem e vou continuar seu atendimento.'}); return {sent:true}; }
  });
  const pipeline=createWebhookPipeline({repository:repo,sdrGateway:sdr});
  const input={external_message_id:'wamid.in.1',phone:'5551999999999',timestamp:'2026-08-22T15:00:00Z',text:'Quero abrir conta PJ',type:'text',source:'WHATSAPP'};
  const first=await pipeline.process([input]);
  const second=await pipeline.process([input]);
  if(first[0].status!=='processed') throw Error('E2E_INBOUND_FAILED');
  if(first[0].outcome.status!=='PROCESSED') throw Error('E2E_SDR_FAILED');
  const inbound=messages.find(x=>x.direction==='INBOUND');
  const outboundRow=messages.find(x=>x.direction==='OUTBOUND');
  if(!inbound || inbound.text_content!=='Quero abrir conta PJ') throw Error('E2E_INBOUND_NOT_PERSISTED');
  if(!outboundRow || outboundRow.text_content!=='Olá! Recebi sua mensagem e vou continuar seu atendimento.') throw Error('E2E_OUTBOUND_NOT_PERSISTED');
  if(second[0].status!=='duplicate') throw Error('E2E_IDEMPOTENCY_FAILED');
  if(!events.some(x=>x.type==='SDR_PROCESSED')) throw Error('E2E_SDR_EVENT_FAILED');
  if(!events.some(x=>x.type==='WHATSAPP_RESPONSE_SENT')) throw Error('E2E_OUTBOUND_EVENT_FAILED');
  console.log('PASS V1 E2E contract: inbound -> lead -> SDR -> outbound -> schema -> duplicate protection');
})();
