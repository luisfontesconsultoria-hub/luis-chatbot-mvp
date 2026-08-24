/** Deterministic next-action helpers for CRM follow-up. */
const { scoreLead, priority } = require('../commercial-assistant');

const ACTIONS = Object.freeze({
  REALIZAR_ATENDIMENTO: 'REALIZAR_ATENDIMENTO',
  AGUARDAR_CONFIRMACAO: 'AGUARDAR_CONFIRMACAO',
  FAZER_FOLLOW_UP: 'FAZER_FOLLOW_UP',
  REGISTRAR_CONVERSAO: 'REGISTRAR_CONVERSAO',
  ENCERRAR_OPORTUNIDADE: 'ENCERRAR_OPORTUNIDADE'
});

function buildNextAction(lead={}, context={}) {
  const status=String(lead.status||'NEW').toUpperCase();
  if (status==='MEETING_MODE') return {action:ACTIONS.REALIZAR_ATENDIMENTO,reason:'VISITA_CONFIRMADA'};
  if (status==='SCHEDULING') return {action:ACTIONS.AGUARDAR_CONFIRMACAO,reason:'AGENDAMENTO_PENDENTE'};
  if (status==='AGUARDANDO_RETORNO') return {action:ACTIONS.FAZER_FOLLOW_UP,reason:'RETORNO_PENDENTE'};
  if (status==='CONVERTIDO') return {action:ACTIONS.REGISTRAR_CONVERSAO,reason:'NEGOCIO_CONVERTIDO'};
  if (status==='PERDIDO') return {action:ACTIONS.ENCERRAR_OPORTUNIDADE,reason:'OPORTUNIDADE_ENCERRADA'};
  if (context.explicitNextAction) return {action:String(context.explicitNextAction),reason:'ACAO_EXPLICITA'};
  const score=scoreLead(lead); return {action:score>=85?'PRIORIZAR_CONTATO':'CONTINUAR_QUALIFICACAO',reason:'ESTADO_COMERCIAL',score,priority:priority(score)};
}

async function refreshLeadNextAction(repo, leadId, context={}) {
  const lead=await repo.getLead(leadId); if(!lead) throw new Error('LEAD_NOT_FOUND');
  const next=buildNextAction(lead,context);
  const updated=await repo.updateLead(leadId,{nextAction:next.action});
  await repo.createEvent({lead_id:leadId,type:'NEXT_ACTION_REFRESHED',idempotency_key:context.idempotencyKey||null,payload:{action:next.action,reason:next.reason,score:next.score||scoreLead(lead),priority:next.priority||priority(scoreLead(lead))}});
  return {lead:updated,nextAction:next};
}

module.exports={ACTIONS,buildNextAction,refreshLeadNextAction};
