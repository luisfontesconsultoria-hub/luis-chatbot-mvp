/** Persistence boundary for manually created CRM leads. */
const { validateManualLead } = require('./manual-lead');

async function createManualLead({ repository, input, tenantId = 'owner' } = {}) {
  if (!repository || typeof repository.createLead !== 'function') throw new Error('CRM_CREATE_NOT_CONFIGURED');
  const lead = validateManualLead(input);
  if (!tenantId) throw new Error('TENANT_ID_REQUIRED');
  return repository.createLead({ ...lead, tenantId, createdBy: 'CRM_OWNER', status: 'NEW' });
}

async function updateManualLead({ repository, leadId, patch } = {}) {
  if (!repository || typeof repository.updateLead !== 'function') throw new Error('CRM_UPDATE_NOT_CONFIGURED');
  if (!leadId) throw new Error('LEAD_ID_REQUIRED');
  const allowed = ['companyName','contactName','phone','email','cnpj','source','interest','notes','status','nextAction'];
  const safePatch = Object.fromEntries(Object.entries(patch || {}).filter(([key]) => allowed.includes(key)));
  return repository.updateLead(leadId, safePatch);
}

module.exports = { createManualLead, updateManualLead };
