/** Maps the CRM model to the real V1 Supabase leads schema used in production. */
const LEAD_TO_DB = Object.freeze({
  id:'id', name:'nome', companyName:'nome_da_empresa', phone:'telefone', cnpj:'cnpj',
  source:'fonte', campaign:'campanha', interest:'interesse_no_produto', productInterest:'interesse_no_produto',
  bankCurrent:'corrente_bancaria', machineCurrent:'corrente_da_maquina', monthlyRevenue:'receita_mensal',
  painPoint:'ponto_de_dor', status:'status', owner:'owner', nextAction:'próxima_ação',
  updatedAt:'atualizado_em', companyStatus:'status_da_empresa', tradeName:'nome_comercial',
  neighborhood:'vizinhança', addressNumber:'número_do_endereço', address:'address', city:'city',
  state:'state', zipCode:'zip_code'
});
const DB_TO_CRM = Object.freeze(Object.entries(LEAD_TO_DB).reduce((out,[from,to])=>{ if(out[to]===undefined) out[to]=from; return out; },{}));
// Keep canonical V1 names when two CRM aliases point to the same DB column.
DB_TO_CRM['interesse_no_produto']='interest';
function toDbLead(input = {}) { const out={}; for(const [from,to] of Object.entries(LEAD_TO_DB)) if(input[from]!==undefined && out[to]===undefined) out[to]=input[from]; return out; }
function fromDbLead(input = {}) { const out={}; for(const [from,to] of Object.entries(DB_TO_CRM)) if(input[from]!==undefined) out[to]=input[from]; if(out.interest!==undefined && out.productInterest===undefined) out.productInterest=out.interest; return out; }
module.exports={LEAD_TO_DB,DB_TO_CRM,toDbLead,fromDbLead};
