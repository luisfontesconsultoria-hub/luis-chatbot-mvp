/** Pure workflow reducer: translates commercial outcomes into deterministic next actions. */
const { appointmentToPipelineStatus, visitResultToStatus, scoreLead, priority } = require('./commercial-assistant');

function applyAppointmentOutcome(lead={}, appointment={}) {
  const status = appointmentToPipelineStatus({ confirmed: Boolean(appointment.confirmed), mode: appointment.mode || 'PRESENCIAL' });
  const next = { ...lead, status, stage: status };
  const score = scoreLead(next);
  return { lead: next, score, priority: priority(score), nextAction: appointment.confirmed ? 'REALIZAR_ATENDIMENTO' : 'AGUARDAR_CONFIRMACAO' };
}

function applyVisitOutcome(lead={}, result) {
  const stage = visitResultToStatus(result);
  if (!stage) return { lead: { ...lead }, changed: false, score: scoreLead(lead), priority: priority(scoreLead(lead)), nextAction: null };
  const next = { ...lead, stage };
  const score = scoreLead(next);
  const nextAction = stage === 'AGUARDANDO_RETORNO' ? 'FAZER_FOLLOW_UP' : stage === 'CONVERTIDO' ? 'REGISTRAR_CONVERSAO' : 'ENCERRAR_OPORTUNIDADE';
  return { lead: next, changed: true, score, priority: priority(score), nextAction };
}

function summarizeWorkflow(lead={}) {
  const score = scoreLead(lead);
  return { status: lead.status || 'NEW', stage: lead.stage || lead.status || 'NEW', score, priority: priority(score), nextAction: lead.nextAction || null, appointmentId: lead.appointmentId || null, routeId: lead.routeId || null };
}

module.exports = { applyAppointmentOutcome, applyVisitOutcome, summarizeWorkflow };
