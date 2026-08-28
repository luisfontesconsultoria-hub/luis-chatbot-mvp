/** Maps the CRM model to the real V1 Supabase leads schema used in production.
 * IMPORTANT: these DB column names were verified directly against the live
 * `public.leads` table (information_schema.columns) on 2026-08-28. Do not
 * rename these without checking the live schema first.
 */
const LEAD_TO_DB = Object.freeze({
  id:'id', name:'name', companyName:'company_name', phone:'phone', cnpj:'cnpj',
  source:'source', campaign:'campaign', interest:'product_interest', productInterest:'product_interest',
  bankCurrent:'bank_current', machineCurrent:'machine_current', monthlyRevenue:'monthly_revenue',
  painPoint:'pain_point', status:'status', owner:'owner', nextAction:'next_action',
  updatedAt:'updated_at', companyStatus:'company_status', tradeName:'trade_name',
  neighborhood:'neighborhood', addressNumber:'address_number', address:'address', city:'city',
  state:'state', zipCode:'zip_code'
});
const DB_TO_CRM = Object.freeze(Object.entries(LEAD_TO_DB).reduce((out,[from,to])=>{ if(out[to]===undefined) out[to]=from; return out; },{}));
DB_TO_CRM['product_interest']='interest';
function toDbLead(input = {}) { const out={}; for(const [from,to] of Object.entries(LEAD_TO_DB)) if(input[from]!==undefined && out[to]===undefined) out[to]=input[from]; return out; }
function fromDbLead(input = {}) { const out={}; for(const [from,to] of Object.entries(DB_TO_CRM)) if(input[from]!==undefined) out[to]=input[from]; if(out.interest!==undefined && out.productInterest===undefined) out.productInterest=out.interest; return out; }
module.exports={LEAD_TO_DB,DB_TO_CRM,toDbLead,fromDbLead};
