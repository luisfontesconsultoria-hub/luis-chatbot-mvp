/** Maps the CRM model to the real V1 Supabase leads schema used in production. */
const LEAD_TO_DB = Object.freeze({
  id:'id', name:'nome', companyName:'nome_da_empresa', phone:'telefone', cnpj:'cnpj',
  source:'fonte', campaign:'campanha', interest:'interesse_no_produto',
  bankCurrent:'corrente_bancaria', machineCurrent:'corrente_da_maquina', monthlyRevenue:'receita_mensal',
  painPoint:'ponto_de_dor', status:'status', owner:'owner', nextAction:'próxima_ação',
  updatedAt:'atualizado_em', companyStatus:'status_da_empresa', tradeName:'nome_comercial',
  neighborhood:'vizinhança', addressNumber:'número_do_endereço', address:'address', city:'city',
  state:'state', zipCode:'zip_code'
});
function toDbLead(input = {}) { const out={}; for(const [from,to] of Object.entries(LEAD_TO_DB)) if(input[from]!==undefined) out[to]=input[from]; return out; }
function fromDbLead(input = {}) { const reverse=Object.fromEntries(Object.entries(LEAD_TO_DB).map(([a,b])=>[b,a])); const out={}; for(const [from,to] of Object.entries(reverse)) if(input[from]!==undefined) out[to]=input[from]; return out; }
module.exports={LEAD_TO_DB,toDbLead,fromDbLead};
