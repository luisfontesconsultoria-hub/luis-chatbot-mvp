const {filterCapturedCompanies}=require('./captacao-filter');
const rows=[{id:'1',name:'Padaria Sul',phone:'51999990000',city:'Porto Alegre',state:'RS',source:'GOOGLE_MAPS',status:'CAPTURED'},{id:'2',name:'Mercado Norte',phone:'51988880000',city:'Canoas',state:'RS',source:'CSV',status:'ACTIVATED'}];
if(filterCapturedCompanies(rows,{q:'padaria'}).length!==1)throw Error('CAPTACAO_FILTER_Q_FAILED');
if(filterCapturedCompanies(rows,{status:'CAPTURED'}).length!==1)throw Error('CAPTACAO_FILTER_STATUS_FAILED');
if(filterCapturedCompanies(rows,{source:'CSV'}).length!==1)throw Error('CAPTACAO_FILTER_SOURCE_FAILED');
console.log('PASS captacao filter: query/status/source');
