/** CRM activity contract for follow-ups and audit-friendly actions. */
const TYPES = Object.freeze(['NOTE','FOLLOW_UP','STATUS_CHANGE','CALL','MEETING','MESSAGE']);
function buildActivity(input = {}) {
  const type = String(input.type || 'NOTE').toUpperCase();
  if (!TYPES.includes(type)) throw new Error('INVALID_ACTIVITY_TYPE');
  if (!input.leadId) throw new Error('LEAD_ID_REQUIRED');
  return { leadId: input.leadId, type, text: String(input.text || '').trim(), dueAt: input.dueAt || null, actor: input.actor || 'CRM_OWNER', createdAt: input.createdAt || new Date().toISOString() };
}
module.exports = { TYPES, buildActivity };
