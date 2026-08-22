const { scoreLead, classifyScore } = require('./lead-scoring');
const hot = scoreLead({companyActive:true,companyType:'LTDA',hasCnpj:true,interestAccount:true,interestCardMachine:true,acceptsCommercialContact:true,source:'LINKEDIN'});
if (hot !== 100 || classifyScore(hot) !== 'HOT') throw Error('hot scoring failed');
if (classifyScore(scoreLead({})) !== 'COLD') throw Error('cold scoring failed');
console.log('PASS lead scoring');
