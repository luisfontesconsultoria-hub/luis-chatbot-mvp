/** Audit/activity records for CRM changes. */
function buildActivity({ leadId, action, actor = 'SYSTEM', metadata = {} } = {}) {
  if (!leadId) throw new Error('LEAD_ID_REQUIRED');
  if (!action) throw new Error('ACTION_REQUIRED');
  return { leadId, action, actor, metadata, createdAt: new Date().toISOString() };
}
module.exports = { buildActivity };
