/** Persistence-aware commercial workflow orchestration. */
const { applyAppointmentOutcome, applyVisitOutcome } = require('../commercial-workflow');

async function recordAppointmentOutcome(repo, leadId, appointment) {
  const lead = await repo.getLead(leadId);
  if (!lead) throw new Error('LEAD_NOT_FOUND');
  const result = applyAppointmentOutcome(lead, appointment);
  const updated = await repo.updateLead(leadId, { status: result.lead.status, nextAction: result.nextAction });
  await repo.createEvent({ lead_id: leadId, type: 'APPOINTMENT_OUTCOME', idempotency_key: appointment.idempotencyKey || null, payload: { appointmentId: appointment.id || null, confirmed: Boolean(appointment.confirmed), mode: appointment.mode || 'PRESENCIAL', nextAction: result.nextAction } });
  await repo.createAudit({ lead_id: leadId, action: 'APPOINTMENT_OUTCOME', from_status: lead.status || null, to_status: result.lead.status, actor: 'SYSTEM', metadata: { appointmentId: appointment.id || null } });
  return { lead: updated, score: result.score, priority: result.priority, nextAction: result.nextAction };
}

async function recordVisitOutcome(repo, leadId, resultValue, metadata={}) {
  const lead = await repo.getLead(leadId);
  if (!lead) throw new Error('LEAD_NOT_FOUND');
  const result = applyVisitOutcome(lead, resultValue);
  if (!result.changed) return result;
  const updated = await repo.updateLead(leadId, { status: result.lead.status, nextAction: result.nextAction });
  await repo.createEvent({ lead_id: leadId, type: 'VISIT_OUTCOME', idempotency_key: metadata.idempotencyKey || null, payload: { result: resultValue, nextAction: result.nextAction, ...metadata } });
  await repo.createAudit({ lead_id: leadId, action: 'VISIT_OUTCOME', from_status: lead.status || null, to_status: result.lead.status, actor: metadata.actor || 'SYSTEM', metadata: { result: resultValue } });
  return { lead: updated, score: result.score, priority: result.priority, nextAction: result.nextAction, changed: true };
}

module.exports = { recordAppointmentOutcome, recordVisitOutcome };
