/** Maps the CRM's camelCase model to the existing Supabase snake_case V1 schema. */
const LEAD_TO_DB = Object.freeze({
  id:'id', companyName:'company_name', contactName:'contact_name', phone:'phone', email:'email',
  cnpj:'cnpj', source:'source', interest:'product_interest', notes:'notes', status:'status',
  score:'score', classification:'classification', queue:'queue', priority:'priority',
  nextAction:'next_action', createdAt:'created_at', updatedAt:'updated_at', tenantId:'tenant_id'
});
function toDbLead(input = {}) {
  const out = {};
  for (const [from,to] of Object.entries(LEAD_TO_DB)) if (input[from] !== undefined) out[to] = input[from];
  return out;
}
function fromDbLead(input = {}) {
  const reverse = Object.fromEntries(Object.entries(LEAD_TO_DB).map(([a,b]) => [b,a]));
  const out = {};
  for (const [from,to] of Object.entries(reverse)) if (input[from] !== undefined) out[to] = input[from];
  return out;
}
module.exports = { LEAD_TO_DB, toDbLead, fromDbLead };
