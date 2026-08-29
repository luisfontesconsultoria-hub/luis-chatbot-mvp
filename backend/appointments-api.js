const { normalize, eventFor, fromEvents } = require('./persistence/appointments');

async function appointmentsRoute({ method, path, query = {}, body = {}, runtime }) {
  if (!runtime?.repository) return { status: 503, body: { error: 'CRM_DATABASE_NOT_CONFIGURED' } };
  if (method === 'GET' && path === '/api/crm/appointments') {
    const events = await runtime.repository.listEvents({ limit: 500 });
    let appointments = fromEvents(events);
    if (query.date) appointments = appointments.filter(a => a.date === String(query.date).slice(0,10));
    if (query.status) appointments = appointments.filter(a => a.status === String(query.status).toUpperCase());
    return { status: 200, body: { appointments } };
  }
  if (method === 'POST' && path === '/api/crm/appointments') {
    const a = normalize(body);
    if (!a.clientName || !a.date || !a.time) return { status: 400, body: { error: 'APPOINTMENT_REQUIRED_FIELDS' } };
    const events = await runtime.repository.listEvents({ limit: 500 });
    const existing = fromEvents(events).find(x => x.date === a.date && x.time === a.time && ['PENDING_CONFIRMATION','CONFIRMED'].includes(x.status));
    if (existing) return { status: 409, body: { error: 'APPOINTMENT_SLOT_TAKEN', appointment: existing } };
    await runtime.repository.createEvent(eventFor(a, 'LUIS'));
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
    await runtime.repository.createEvent(eventFor(next, 'LUIS'));
    return { status: 200, body: { appointment: next } };
  }
  return { status: 404, body: { error: 'APPOINTMENT_ROUTE_NOT_FOUND' } };
}
module.exports = { appointmentsRoute };
