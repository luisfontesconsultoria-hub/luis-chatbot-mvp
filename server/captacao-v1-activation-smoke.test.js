const {filterCapturedCompanies}=require('./captacao-filter');
const {activateCapturedCompany}=require('./captacao-activation');
(async()=>{
 const companies=[{id:'c1',name:'Empresa Demo',phone:'51999990000',source:'CSV',status:'CAPTURED',lead_id:null}];const leads=[];
 const repository={
  async getCapturedCompany(id){return companies.find(c=>c.id===id)||null},
  async updateCapturedCompany(id,p){const c=companies.find(c=>c.id===id);Object.assign(c,p);return c},
  async findOrCreateLeadByPhone(phone,d={}){let l=leads.find(x=>x.phone===phone);if(!l){l={id:'l1',phone,name:d.name,source:d.source,status:'NEW'};leads.push(l)}return l},
  async createEvent(){return{}},async createAudit(){return{}}
 };
 if(filterCapturedCompanies(companies,{q:'demo'}).length!==1)throw Error('FILTER_FAILED');
 const r=await activateCapturedCompany({repository,companyId:'c1'});if(r.status!==200||companies[0].lead_id!=='l1')throw Error('ACTIVATE_FAILED');
 console.log('PASS captacao V1 filter + activation smoke');
})();
