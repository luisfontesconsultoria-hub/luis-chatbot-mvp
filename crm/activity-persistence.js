/** Persistence boundary for CRM activities/follow-ups. */
const { buildActivity } = require('./activity-model');
async function createActivity({ repository, input } = {}) {
  if (!repository || typeof repository.createActivity !== 'function') throw new Error('CRM_ACTIVITY_CREATE_NOT_CONFIGURED');
  return repository.createActivity(buildActivity(input));
}
async function listActivities({ repository, leadId, limit = 100 } = {}) {
  if (!repository || typeof repository.listActivities !== 'function') throw new Error('CRM_ACTIVITY_LIST_NOT_CONFIGURED');
  if (!leadId) throw new Error('LEAD_ID_REQUIRED');
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 100);
  return repository.listActivities({ leadId, limit: safeLimit });
}
module.exports = { createActivity, listActivities };
