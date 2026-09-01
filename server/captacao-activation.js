/** Activate a captured company into the CRM only by explicit user action. */
function activateCapturedCompany({repository, companyId, defaults={}}={}){
  return (async()=>{
    if(!repository)return{status:503,body:{error:'CAPTACAO_DATABASE_NOT_CONFIGURED'}};
    if(!companyId)return{status:400,body:{error:'COMPANY_ID_REQUIRED'}};
    if(typeof repository.getCapturedCompany!=='function'||typeof repository.updateCapturedCompany!=='function')return{status:503,body:{error:'CAPTACAO_REPOSITORY_INCOMPLETE'}};
    const company=await repository.getCapturedCompany(companyId);
    if(!company)return{status:404,body:{error:'CAPTURED_COMPANY_NOT_FOUND'}};
    if(company.lead_id||String(company.status||'').toUpperCase()==='ACTIVATED')return{status:409,body:{error:'CAPTURED_COMPANY_ALREADY_ACTIVATED',leadId:company.lead_id||null}};
    if(!company.phone)return{status:400,body:{error:'PHONE_REQUIRED'}};
    if(typeof repository.findOrCreateLeadByPhone!=='function')return{status:503,body:{error:'CRM_REPOSITORY_INCOMPLETE'}};
    const lead=await repository.findOrCreateLeadByPhone(company.phone,{name:company.name||null,source:defaults.source||'CAPTACAO'});
    const updated=await repository.updateCapturedCompany(companyId,{status:'ACTIVATED',lead_id:lead.id,activated_at:new Date().toISOString(),updated_at:new Date().toISOString()});
    if(typeof repository.createEvent==='function')await repository.createEvent({lead_id:lead.id,type:'CAPTURED_COMPANY_ACTIVATED',payload:{captured_company_id:company.id,source:company.source||null}});
    if(typeof repository.createAudit==='function')await repository.createAudit({lead_id:lead.id,action:'CAPTURED_COMPANY_ACTIVATED',actor:'LUIS',metadata:{captured_company_id:company.id}});
    return{status:200,body:{ok:true,company:updated,lead}};
  })();
}
module.exports={activateCapturedCompany};
