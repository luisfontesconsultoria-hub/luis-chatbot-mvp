const {activateCapturedCompany}=require('./captacao-activation');
(async()=>{
  const companies=[{id:'c1',name:'Empresa Teste',phone:'51999990000',source:'CSV',status:'CAPTURED',lead_id:null}];
  const leads=[];const events=[];const audits=[];
  const repository={
    async getCapturedCompany(id){return companies.find(c=>c.id===id)||null},
    async updateCapturedCompany(id,patch){const c=companies.find(c=>c.id===id);Object.assign(c,patch);return c},
    async findOrCreateLeadByPhone(phone,defaults={}){let l=leads.find(x=>x.phone===phone);if(!l){l={id:'l1',phone,name:defaults.name||null,source:defaults.source||'CAPTACAO',status:'NEW'};leads.push(l)}return l},
    async createEvent(e){events.push(e);return e},
    async createAudit(a){audits.push(a);return a}
  };
  let r=await activateCapturedCompany({repository,companyId:'c1'});
  if(r.status!==200||r.body.lead.id!=='l1')throw Error('CAPTACAO_ACTIVATION_FAILED');
  if(companies[0].status!=='ACTIVATED'||companies[0].lead_id!=='l1')throw Error('CAPTACAO_ACTIVATION_LINK_FAILED');
  if(events.length!==1||audits.length!==1)throw Error('CAPTACAO_ACTIVATION_AUDIT_FAILED');
  r=await activateCapturedCompany({repository,companyId:'c1'});
  if(r.status!==409)throw Error('CAPTACAO_ACTIVATION_DUP_FAILED');
  r=await activateCapturedCompany({repository,companyId:'missing'});
  if(r.status!==404)throw Error('CAPTACAO_ACTIVATION_NOT_FOUND_FAILED');
  console.log('PASS captacao activation: captured_company -> lead -> event/audit -> duplicate guard');
})();
