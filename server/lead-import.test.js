const { importLeads, normalizeLead } = require('./lead-import');

(async () => {
  const leads=[]; const events=[];
  const repository={
    async createLead(data){
      if(leads.some(x=>x.phone===data.phone)){const e=new Error('duplicate');e.code='23505';throw e}
      const lead={id:String(leads.length+1),...data};leads.push(lead);return lead;
    },
    async createEvent(event){events.push(event)}
  };
  const normalized=normalizeLead({name:'Empresa Teste',phone:'(51) 99999-0000',cnpj:'12.345.678/0001-90',monthlyRevenue:'12.345,67'});
  if(normalized.phone!=='51999990000')throw Error('IMPORT_NORMALIZE_PHONE_FAILED');
  if(normalized.cnpj!=='12345678000190')throw Error('IMPORT_NORMALIZE_CNPJ_FAILED');
  if(normalized.monthlyRevenue!==12345.67)throw Error('IMPORT_NORMALIZE_REVENUE_FAILED');
  const result=await importLeads({repository,rows:[normalized,{name:'Sem telefone'}]});
  if(result.status!==200)throw Error('IMPORT_STATUS_FAILED');
  if(result.body.summary.created!==1||result.body.summary.rejected!==1)throw Error('IMPORT_SUMMARY_FAILED');
  const duplicate=await importLeads({repository,rows:[normalized]});
  if(duplicate.body.summary.duplicate!==1)throw Error('IMPORT_DUPLICATE_FAILED');
  if(events.length!==1||events[0].type!=='LEAD_CREATED')throw Error('IMPORT_EVENT_FAILED');
  console.log('PASS lead import: normalization -> create -> event -> duplicate protection -> rejection');
})();
