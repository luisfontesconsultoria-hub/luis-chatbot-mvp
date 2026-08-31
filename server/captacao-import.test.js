const assert=require('assert');
const {importCompanies,normalizeCompany}=require('./captacao-import');

async function run(){
  assert.deepStrictEqual(normalizeCompany({name:'Empresa',phone:'(51) 99999-8888',whatsapp:'+55 (51) 98888-7777',cnpj:'12.345.678/0001-90'}),{name:'Empresa',phone:'51999998888',whatsapp:'5551988887777',cnpj:'12345678000190',address:null,city:null,state:null,segment:null,email:null,source:null});
  const rows=[]; const repo={
    async findDuplicateCompany(q){return rows.find(x=>(q.cnpj&&x.cnpj===q.cnpj)||(q.phone&&x.phone===q.phone)||(q.name&&q.address&&x.name===q.name&&x.address===q.address))||null},
    async createCapturedCompany(p){const x={id:String(rows.length+1),...p};rows.push(x);return x}
  };
  let r=await importCompanies({repository:repo,rows:[{name:'A',phone:'(51) 99999-0000',cnpj:'11.111.111/0001-11'}]});
  assert.equal(r.status,200); assert.equal(r.body.summary.created,1);
  r=await importCompanies({repository:repo,rows:[{name:'B',phone:'51999990000',cnpj:'22.222.222/0001-22'}]});
  assert.equal(r.body.summary.duplicate,1);
  r=await importCompanies({repository:repo,rows:[{name:'C',phone:'51999990001',cnpj:'11.111.111/0001-11'}]});
  assert.equal(r.body.summary.duplicate,1);
  r=await importCompanies({repository:repo,rows:[{name:'D',phone:'51999990002',address:'Rua X'},{name:'D',phone:'51999990003',address:'Rua X'}]});
  assert.equal(r.body.summary.created,1); assert.equal(r.body.summary.duplicate,1);
  r=await importCompanies({repository:repo,rows:[{phone:'51999990004'},{name:'E'}]});
  assert.equal(r.body.summary.rejected,2);
  console.log('captacao-import.test.js: PASS');
}
run().catch(e=>{console.error(e);process.exit(1)});
