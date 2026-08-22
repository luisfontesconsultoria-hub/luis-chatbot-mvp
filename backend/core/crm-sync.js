/** Adapter contract for persisting the canonical lead projection in CRM repositories. */
const { buildLeadRecord } = require('./lead-record');

async function syncLeadToCrm({ repository, leadId, input, score, route }) {
  if (!repository || typeof repository.updateLead !== 'function') {
    throw new Error('CRM_REPOSITORY_UPDATE_NOT_CONFIGURED');
  }
  if (!leadId) throw new Error('LEAD_ID_REQUIRED');
  const projection = buildLeadRecord(input, score, route);
  await repository.updateLead(leadId, projection);
  return projection;
}

module.exports = { syncLeadToCrm };
