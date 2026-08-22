const { createSupabaseRepository } = require('./supabase-adapter');

function makeQuery(data, error = null) {
  const q = { data, error, select(){return this}, limit(){return this}, eq(){return this}, order(){return this}, single(){return Promise.resolve(this)} };
  return q;
}
const rows = [{ id:'1', company_name:'Empresa Teste', name:'Ana', status:'NEW', product_interest:'CONTA_PJ' }];
const calls = [];
const client = { from(table){ calls.push(table); return makeQuery(rows); } };
(async () => {
  const repo = createSupabaseRepository(client);
  const leads = await repo.listLeads({limit:10});
  if (leads[0].companyName !== 'Empresa Teste' || leads[0].name !== 'Ana' || leads[0].interest !== 'CONTA_PJ') throw Error('SUPABASE_READ_MAPPING_FAILED');
  if (!calls.includes('leads')) throw Error('SUPABASE_LEADS_TABLE_NOT_USED');
  console.log('PASS Supabase adapter integration contract');
})();
