/** Pure filtering rules for the capture station. */
function filterCapturedCompanies(companies=[],filters={}){
  const q=String(filters.q||'').trim().toLowerCase();
  const status=filters.status?String(filters.status).toUpperCase():null;
  const source=filters.source?String(filters.source).toUpperCase():null;
  return companies.filter(c=>{
    if(status&&String(c.status||'').toUpperCase()!==status)return false;
    if(source&&String(c.source||'').toUpperCase()!==source)return false;
    if(q){const hay=[c.name,c.phone,c.cnpj,c.address,c.city,c.state,c.segment,c.email].map(v=>String(v||'').toLowerCase()).join(' ');if(!hay.includes(q))return false}
    return true;
  });
}
module.exports={filterCapturedCompanies};
