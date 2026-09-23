const { createIdempotencyGuard } = require('./security/idempotency');
function isDuplicateError(error) { const code=error?.code||''; const message=String(error?.message||'').toLowerCase(); return code==='23505'||message.includes('duplicate')||message.includes('unique')||message.includes('idempot'); }
// resume=true: modo de reprocessamento da fila (spool). Ignora o guard em memória
// (o dedupe durável é do banco) e, se a mensagem de entrada já existir, NÃO roda o SDR
// de novo (evita resposta duplicada ao cliente): se não houver SDR_PROCESSED para ela,
// registra SPOOL_REPLAY_NEEDS_HUMAN para retorno manual.
function createWebhookPipeline({ repository, idempotency=createIdempotencyGuard(), sdrGateway=null, onMessage=async()=>null, resume=false }) {
  if (!repository) throw new Error('REPOSITORY_REQUIRED');
  return async function process(messages=[]) {
    const results=[];
    for (const message of messages) {
      const whatsappJid=message?.whatsapp_jid||message?.whatsappJid||null;
      if (!message?.phone && !whatsappJid) { results.push({status:'ignored',reason:'WHATSAPP_IDENTITY_REQUIRED'}); continue; }
      const identity=message.phone||whatsappJid;
      const key=message.external_message_id||`${identity}:${message.timestamp}:${message.text||''}`;
      if (!resume && idempotency.has(key)) { results.push({status:'duplicate',key}); continue; }
      try {
        if(typeof repository.ingestInboundMessage==='function'){
          const atomic=await repository.ingestInboundMessage({...message,whatsapp_jid:whatsappJid,external_message_id:key});
          if(atomic.duplicate){
            idempotency.mark(key);
            if(resume){const sdrDone=await sdrAlreadyProcessed(repository,atomic.lead.id,key);if(!sdrDone)await repository.createEvent({lead_id:atomic.lead.id,type:'SPOOL_REPLAY_NEEDS_HUMAN',idempotency_key:`spool-needs-human:${key}`,payload:{external_message_id:key,reason:'INBOUND_SAVED_BUT_SDR_NOT_CONFIRMED'}});results.push({status:'duplicate',key,lead_id:atomic.lead.id,needsHuman:!sdrDone});continue}
            results.push({status:'duplicate',key,lead_id:atomic.lead.id});continue;
          }
          const lead=atomic.lead,saved=atomic.saved;idempotency.mark(key);
          const outcome=sdrGateway?await sdrGateway.process({lead,message,saved}):await onMessage({message,lead,saved});
          await repository.createEvent({lead_id:lead.id,type:'SDR_PROCESSED',idempotency_key:`sdr:${key}`,payload:{external_message_id:key,status:outcome?.status||'UNKNOWN'}});
          results.push({status:'processed',key,lead,saved,outcome,atomic:true});continue;
        }
        const defaults={source:message.source||'WHATSAPP',name:message.name||null};
        const lead=typeof repository.findOrCreateLeadByWhatsappIdentity==='function'
          ? await repository.findOrCreateLeadByWhatsappIdentity({phone:message.phone||null,jid:whatsappJid},defaults)
          : await repository.findOrCreateLeadByPhone(message.phone,defaults);
        if(whatsappJid)lead.whatsappJid=whatsappJid;
        try {
          await repository.createEvent({lead_id:lead.id,type:'WHATSAPP_INBOUND',idempotency_key:key,payload:{external_message_id:key,type:message.type||'text',timestamp:message.timestamp||null,whatsapp_jid:whatsappJid}});
          idempotency.mark(key);
        } catch(error) {
          if(isDuplicateError(error)){ idempotency.mark(key); results.push({status:'duplicate',key,lead_id:lead.id}); continue; }
          throw error;
        }
        let saved;
        try {
          saved=await repository.createMessage({lead_id:lead.id,channel:message.channel||'WHATSAPP',direction:'INBOUND',external_message_id:message.external_message_id||key,text_content:message.text||'',transcript:message.transcript||null,metadata:{type:message.type||'text',media_url:message.media_url||null,source:message.source||'WHATSAPP',campaign:message.campaign||null,timestamp:message.timestamp||null,whatsapp_jid:whatsappJid}});
        } catch(error) {
          if(!isDuplicateError(error)) throw error;
          if(!resume){ results.push({status:'duplicate',key,lead_id:lead.id}); continue; }
          const sdrDone=await sdrAlreadyProcessed(repository,lead.id,key);
          if(!sdrDone) await repository.createEvent({lead_id:lead.id,type:'SPOOL_REPLAY_NEEDS_HUMAN',idempotency_key:`spool-needs-human:${key}`,payload:{external_message_id:key,reason:'INBOUND_SAVED_BUT_SDR_NOT_CONFIRMED'}});
          results.push({status:'duplicate',key,lead_id:lead.id,needsHuman:!sdrDone}); continue;
        }
        const outcome=sdrGateway?await sdrGateway.process({lead,message,saved}):await onMessage({message,lead,saved});
        await repository.createEvent({lead_id:lead.id,type:'SDR_PROCESSED',idempotency_key:`sdr:${key}`,payload:{external_message_id:key,status:outcome?.status||'UNKNOWN'}});
        results.push({status:'processed',key,lead,saved,outcome});
      } catch(error) { if(typeof idempotency.forget==='function') idempotency.forget(key); results.push({status:'error',key,error:error?.message||'PROCESSING_ERROR'}); }
    }
    return results;
  };
}
async function sdrAlreadyProcessed(repository,leadId,key){
  if(typeof repository.listEvents!=='function') return false;
  const rows=await repository.listEvents({leadId,type:'SDR_PROCESSED',limit:200});
  return (rows||[]).some(e=>e?.idempotency_key===`sdr:${key}`||e?.payload?.external_message_id===key);
}
module.exports={createWebhookPipeline,isDuplicateError,sdrAlreadyProcessed};
