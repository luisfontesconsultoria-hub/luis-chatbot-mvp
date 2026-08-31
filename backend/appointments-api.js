const { normalize, eventFor, fromEvents } = require('./persistence/appointments');
const { applyAppointmentOutcome, applyVisitOutcome } = require('./commercial-workflow');

const ACTIVE_APPOINTMENT_STATUSES = new Set(['PENDING_CONFIRMATION', 'CONFIRMED']);

async function syncLeadFromAppointment(runtime, appointment, previous = {}) {
  if (!runtime?.repository || !appointment?.leadId) return null;
  const lead = await runtime.repository.getLead(appointment.leadId);
  if (!lead) return null;
  let outcome;
  if (appointment.status === 'REALIZADO') {
    outcome = applyVisitOutcome(lead, appointment.visitResult || appointment.result || null);
  } else {
    outcome = applyAppointmentOutcome(lead, { confirmed: appointment.status === 'CONFIRMED', mode: appointment.type || appointment.mode || 'PRESENCIAL' });
  }
  const fields = { status: outcome.lead.status, stage: outcome.lead.stage, appointmentId: appointment.appointmentId, nextAction: outcome.nextAction, updatedAt: new Date().toISOString() };
  const updated = await runtime.repository.updateLead(appointment.leadId, fields);
  try {
    await runtime.repository.createAudit({ lead_id: appointment.leadId, action: 'APPOINTMENT_SYNC', from_status: previous.status || lead.status || 'NEW', to_status: updated.status, from_stage: previous.stage || lead.stage || lead.status || 'NEW', to_stage: updated.stage, actor: 'LUIS', metadata: { appointmentId: appointment.appointmentId, appointmentStatus: appointment.status, visitResult: appointment.visitResult || appointment.result || null, nextAction: outcome.nextAction } });
  } catch (e) { console.error('APPOINTMENT_SYNC_AUDIT_FAILED', e?.message || e); }
  return updated;
}

async function appointmentsRoute({ method, path, query = {}, body = {}, runtime }) {
  if (!runtime?.repository) return { status: 503, body: { error: 'CRM_DATABASE_NOT_CONFIGURED' } };
  if (method === 'GET' && path === '/api/crm/appointments') {
    const events = await runtime.repository.listEvents({ limit: 500 });
    let appointments = fromEvents(events).filter(a => ACTIVE_APPOINTMENT_STATUSES.has(a.status));
    if (query.date) appointments = appointments.filter(a => a.date === String(query.date).slice(0, 10));
    if (query.status) appointments = appointments.filter(a => a.status === String(query.status).toUpperCase());
    return { status: 200, body: { appointments } };
  }
  if (method === 'POST' && path === '/api/crm/appointments') {
    const a = normalize(body);
    if (!a.clientName || !a.date || !a.time) return { status: 400, body: { error: 'APPOINTMENT_REQUIRED_FIELDS' } };
    if (a.leadId && !(await runtime.repository.getLead(a.leadId))) return { status: 404, body: { error: 'LEAD_NOT_FOUND' } };
    const events = await runtime.repository.listEvents({ limit: 500 });
    const existing = fromEvents(events).find(x => x.date === a.date && x.time === a.time && ACTIVE_APPOINTMENT_STATUSES.has(x.status));
    if (existing) return { status: 409, body: { error: 'APPOINTMENT_SLOT_TAKEN', appointment: existing } };
    await runtime.repository.createEvent(eventFor(a, 'LUIS'));
    if (a.leadId) await syncLeadFromAppointment(runtime, a);
    return { status: 201, body: { appointment: a } };
  }
  const m = path.match(/^\/api\/crm\/appointments\/([^/]+)$/);
  if (m && method === 'PATCH') {
    const appointmentId = decodeURIComponent(m[1]);
    const events = await runtime.repository.listEvents({ limit: 500 });
    const current = fromEvents(events).find(x => x.appointmentId === appointmentId);
    if (!current) return { status: 404, body: { error: 'APPOINTMENT_NOT_FOUND' } };
    const next = normalize({ ...current, ...body, appointmentId });
    if (!next.clientName || !next.date || !next.time) return { status: 400, body: { error: 'APPOINTMENT_REQUIRED_FIELDS' } };
    if (next.leadId && !(await runtime.repository.getLead(next.leadId))) return { status: 404, body: { error: 'LEAD_NOT_FOUND' } };
    const movedSlot = current.date !== next.date || current.time !== next.time;
    const active = ACTIVE_APPOINTMENT_STATUSES.has(next.status);
    if (movedSlot || next.status !== current.status) {
      const conflict = fromEvents(events).find(x => x.appointmentId !== appointmentId && x.date === next.date && x.time === next.time && ACTIVE_APPOINTMENT_STATUSES.has(x.status));
      if (conflict && active) return { status: 409, body: { error: 'APPOINTMENT_SLOT_TAKEN', appointment: conflict } };
    }
    await runtime.repository.createEvent(eventFor(next, 'LUIS'));
    const lead = next.leadId ? await syncLeadFromAppointment(runtime, next, current) : null;
    return { status: 200, body: { appointment: next, lead } };
  }
  return { status: 404, body: { error: 'APPOINTMENT_ROUTE_NOT_FOUND' } };
}
module.exports = { appointmentsRoute, syncLeadFromAppointment, ACTIVE_APPOINTMENT_STATUSES };
