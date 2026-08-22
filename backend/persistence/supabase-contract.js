/** Supabase repository contract aligned with the existing V1 schema. Credentials/client stay server-side. */
const TABLES = Object.freeze({ leads:'leads', messages:'messages', events:'events', audit:'audit_log' });
function assertRepository(repo) {
  const required = ['createLead','updateLead','getLead','listLeads','createMessage','listMessages','createEvent','createAudit'];
  if (!repo || required.some(name => typeof repo[name] !== 'function')) throw new Error('SUPABASE_REPOSITORY_INCOMPLETE');
  return repo;
}
module.exports = { TABLES, assertRepository };
