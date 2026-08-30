function cleanDigits(v){return String(v??'').replace(/\D/g,'')}
function clean(v){return v===undefined||v===null||String(v).trim()===''?null:v}
function normalizeLead(row={}){
  const p={...row};
  for(const k of ['name','phone','cnpj','companyName','tradeName','source','campaign','interest','bankCurrent','machineCurrent','monthlyRevenue','painPoint','owner','nextAction','address','city','state','zipCode','companyStatus','neighborhood','addressNumber','ddd']) p[k]=clean(p[k]);
  if(p.phone)p.phone=cleanDigits(p.phone);
  if(p.cnpj)p.cnpj=cleanDigits(p.cnpj);
  if(p.zipCode)p.zipCode=cleanDigits(p.zipCode);
  if(p.monthlyRevenue!==null){const n=Number(String(p.monthlyRevenue).replace(',','.'));p.monthlyRevenue=Number.isFinite(n)?n:null}
  return p
}

async function importLeads({repository, rows=[]}={}){
  if(!repository) return {status:503,body:{error:'CRM_DATABASE_NOT_CONFIGURED'}};
  if(!Array.isArray(rows)) return {status:400,body:{error:'LEADS_ARRAY_REQUIRED'}};
  if(rows.length===0) return {status:400,body:{error:'LEADS_ARRAY_EMPTY'}};
  if(rows.length>500) return {status:413,body:{error:'LEADS_IMPORT_LIMIT_EXCEEDED',max:500}};
  const results=[];
  for(let i=0;i<rows.length;i++){
    const payload=normalizeLead(rows[i]);
    if(!payload.phone){results.push({row:i+1,status:'rejected',error:'PHONE_REQUIRED'});continue}
    try{
      const lead=await repository.createLead({...payload,source:payload.source||'IMPORT'});
      try{await repository.createEvent({lead_id:lead.id,type:'LEAD_CREATED',payload:{source:lead.source,imported:true,row:i+1}})}catch(e){console.error('LEAD_IMPORT_EVENT_FAILED',e?.message||e)}
      results.push({row:i+1,status:'created',leadId:lead.id,phone:lead.phone});
    }catch(e){
      if(e?.code==='23505') results.push({row:i+1,status:'duplicate',error:'LEAD_ALREADY_EXISTS',phone:payload.phone});
      else {console.error('LEAD_IMPORT_CREATE_FAILED',e?.message||e);results.push({row:i+1,status:'error',error:'LEAD_CREATE_FAILED'});}
    }
  }
  const summary={total:rows.length,created:results.filter(x=>x.status==='created').length,duplicate:results.filter(x=>x.status==='duplicate').length,rejected:results.filter(x=>x.status==='rejected').length,errors:results.filter(x=>x.status==='error').length};
  return {status:summary.errors?207:200,body:{ok:summary.errors===0,summary,results}};
}
module.exports={importLeads,normalizeLead};
