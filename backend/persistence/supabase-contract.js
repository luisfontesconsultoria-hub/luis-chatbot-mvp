/** Supabase repository contract. Concrete credentials/client stay in deployment environment. */
const TABLES = Object.freeze({ leads:'crm_leads', activities:'crm_activities', messages:'crm_messages', audit:'crm_audit' });
function assertRepository(repo) {
  if (!repo || typeof repo.createLead !== 'function' || typeof repo.updateLead !== 'function' || typeof repo.getLead !== 'function' || typeof repo.listLeads !== 'function') throw new Error('SUPABASE_REPOSITORY_INCOMPLETE');
  return repo;
}
module.exports = { TABLES, assertRepository };
