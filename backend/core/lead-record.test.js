const { buildLeadRecord } = require('./lead-record');
const r = buildLeadRecord({source:'linkedin'},82,{queue:'PRIORITY',priority:'HIGH',reason:'HOT_LEAD'});
if(r.source!=='LINKEDIN'||r.score!==82||r.classification!=='HOT'||r.queue!=='PRIORITY') throw Error('lead record projection failed');
console.log('PASS lead record projection');
