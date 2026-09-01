/** Supabase repository contract aligned with the existing V1 schema. */
const TABLES = Object.freeze({ leads:'leads', messages:'messages', events:'events', audit:'audit_log', capturedCompanies:'captured_companies' });
function assertRepository(repo) {
  const required = ['createLead','updateLead','getLead','listLeads','findOrCreateLeadByPhone','createMessage','listMessages','createEvent','listEvents','createAudit','createCapturedCompany','findDuplicateCompany','getCapturedCompany','updateCapturedCompany'];
  if (!repo || required.some(name => typeof repo[name] !== 'function')) throw new Error('SUPABASE_REPOSITORY_INCOMPLETE');
  return repo;
}
module.exports = { TABLES, assertRepository };
