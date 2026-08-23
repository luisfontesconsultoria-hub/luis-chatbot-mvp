/** Maps the CRM model to the actual V1 Supabase lead schema. */
const LEAD_TO_DB = Object.freeze({
  id:'id', name:'name', companyName:'company_name', phone:'phone', cnpj:'cnpj',
  source:'source', campaign:'campaign', interest:'product_interest',
  bankCurrent:'bank_current', machineCurrent:'machine_current', monthlyRevenue:'monthly_revenue',
  painPoint:'pain_point', status:'status', owner:'owner', nextAction:'next_action',
  consentAt:'consent_at', address:'address', city:'city', state:'state', zipCode:'zip_code',
  latitude:'latitude', longitude:'longitude', locationSource:'location_source',
  createdAt:'created_at', updatedAt:'updated_at'
});
function toDbLead(input = {}) { const out={}; for(const [from,to] of Object.entries(LEAD_TO_DB)) if(input[from]!==undefined) out[to]=input[from]; return out; }
function fromDbLead(input = {}) { const reverse=Object.fromEntries(Object.entries(LEAD_TO_DB).map(([a,b])=>[b,a])); const out={}; for(const [from,to] of Object.entries(reverse)) if(input[from]!==undefined) out[to]=input[from]; return out; }
module.exports={LEAD_TO_DB,toDbLead,fromDbLead};
