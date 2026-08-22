/** Read-only V1 CRM API contract. Transport/framework remains replaceable. */
const { normalizeLeadForCrm } = require('./schema');

async function listLeads({ repository, limit = 50, source, status } = {}) {
  if (!repository || typeof repository.listLeads !== 'function') throw new Error('CRM_LIST_NOT_CONFIGURED');
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const rows = await repository.listLeads({ limit: safeLimit, source, status });
  return rows.map(normalizeLeadForCrm);
}

async function getLead({ repository, leadId } = {}) {
  if (!leadId) throw new Error('LEAD_ID_REQUIRED');
  if (!repository || typeof repository.getLead !== 'function') throw new Error('CRM_GET_NOT_CONFIGURED');
  const row = await repository.getLead(leadId);
  return row ? normalizeLeadForCrm(row) : null;
}

module.exports = { listLeads, getLead };
