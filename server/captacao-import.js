function cleanDigits(v){return String(v??'').replace(/\D/g,'')}
function clean(v){return v===undefined||v===null||String(v).trim()===''?null:v}
function normalizeCompany(row={}){
  const p={...row};
  for(const k of ['name','phone','cnpj','address','city','state','segment','whatsapp','email','source']) p[k]=clean(p[k]);
  if(p.phone)p.phone=cleanDigits(p.phone);
  if(p.whatsapp)p.whatsapp=cleanDigits(p.whatsapp);
  if(p.cnpj)p.cnpj=cleanDigits(p.cnpj);
  return p;
}

async function importCompanies({repository,rows=[]}={}){
  if(!repository)return{status:503,body:{error:'CRM_DATABASE_NOT_CONFIGURED'}};
  if(!Array.isArray(rows))return{status:400,body:{error:'COMPANIES_ARRAY_REQUIRED'}};
  if(rows.length===0)return{status:400,body:{error:'COMPANIES_ARRAY_EMPTY'}};
  if(rows.length>500)return{status:413,body:{error:'CAPTACAO_IMPORT_LIMIT_EXCEEDED',max:500}};
  const results=[];
  for(let i=0;i<rows.length;i++){
    const payload=normalizeCompany(rows[i]);
    if(!payload.name){results.push({row:i+1,status:'rejected',error:'NAME_REQUIRED'});continue}
    if(!payload.phone){results.push({row:i+1,status:'rejected',error:'PHONE_REQUIRED'});continue}
    try{
      const duplicate=await repository.findDuplicateCompany({phone:payload.phone,cnpj:payload.cnpj,name:payload.name,address:payload.address});
      if(duplicate){results.push({row:i+1,status:'duplicate',companyId:duplicate.id,phone:payload.phone});continue}
      const company=await repository.createCapturedCompany({...payload,source:payload.source||'IMPORT'});
      results.push({row:i+1,status:'created',companyId:company.id,phone:company.phone});
    }catch(e){
      if(e?.code==='23505')results.push({row:i+1,status:'duplicate',error:'COMPANY_ALREADY_EXISTS',phone:payload.phone});
      else{console.error('CAPTACAO_IMPORT_CREATE_FAILED',e?.message||e);results.push({row:i+1,status:'error',error:'CAPTURED_COMPANY_CREATE_FAILED'});}
    }
  }
  const summary={total:rows.length,created:results.filter(x=>x.status==='created').length,duplicate:results.filter(x=>x.status==='duplicate').length,rejected:results.filter(x=>x.status==='rejected').length,errors:results.filter(x=>x.status==='error').length};
  return{status:summary.errors?207:200,body:{ok:summary.errors===0,summary,results}};
}
module.exports={importCompanies,normalizeCompany,cleanDigits};
