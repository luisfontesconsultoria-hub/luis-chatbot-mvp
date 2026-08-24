/** Follow-up scheduling primitives. External delivery is intentionally not performed here. */
const { scoreLead, priority } = require('../commercial-assistant');

function normalizeFollowUp(input={}) {
  const when=input.dueAt||input.scheduledFor||null;
  const note=String(input.note||input.reason||'').trim();
  if(!when) throw new Error('FOLLOW_UP_DATE_REQUIRED');
  const date=new Date(when); if(Number.isNaN(date.getTime())) throw new Error('FOLLOW_UP_DATE_INVALID');
  return { dueAt:date.toISOString(), note, channel:input.channel||'WHATSAPP', status:'PENDING', priority:input.priority||null };
}

async function scheduleFollowUp(repo, leadId, input={}) {
  const lead=await repo.getLead(leadId); if(!lead) throw new Error('LEAD_NOT_FOUND');
  const followUp=normalizeFollowUp(input);
  const score=scoreLead(lead);
  const event=await repo.createEvent({lead_id:leadId,type:'FOLLOW_UP_SCHEDULED',idempotency_key:input.idempotencyKey||null,payload:{...followUp,score,leadPriority:priority(score)}});
  const updated=await repo.updateLead(leadId,{status:'AGUARDANDO_RETORNO',nextAction:'FAZER_FOLLOW_UP'});
  await repo.createAudit({lead_id:leadId,action:'FOLLOW_UP_SCHEDULED',from_status:lead.status||null,to_status:'AGUARDANDO_RETORNO',actor:input.actor||'SYSTEM',metadata:{eventId:event.id||null,dueAt:followUp.dueAt}});
  return {lead:updated,followUp,eventId:event.id||null,score,priority:priority(score)};
}

async function completeFollowUp(repo, leadId, outcome='CONTINUAR', metadata={}) {
  const lead=await repo.getLead(leadId); if(!lead) throw new Error('LEAD_NOT_FOUND');
  const value=String(outcome||'CONTINUAR').toUpperCase();
  const status=value==='CONVERTIDO'?'CONVERTIDO':value==='PERDIDO'?'PERDIDO':'QUALIFICANDO';
  const nextAction=status==='CONVERTIDO'?'REGISTRAR_CONVERSAO':status==='PERDIDO'?'ENCERRAR_OPORTUNIDADE':'CONTINUAR_QUALIFICACAO';
  const updated=await repo.updateLead(leadId,{status,nextAction});
  await repo.createEvent({lead_id:leadId,type:'FOLLOW_UP_COMPLETED',idempotency_key:metadata.idempotencyKey||null,payload:{outcome:value,nextAction,metadata}});
  await repo.createAudit({lead_id:leadId,action:'FOLLOW_UP_COMPLETED',from_status:lead.status||null,to_status:status,actor:metadata.actor||'SYSTEM',metadata:{outcome:value}});
  return {lead:updated,status,nextAction,score:scoreLead(updated),priority:priority(scoreLead(updated))};
}

module.exports={normalizeFollowUp,scheduleFollowUp,completeFollowUp};
