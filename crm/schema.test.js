const { normalizeLeadForCrm, LEAD_STATUSES } = require('./schema');
const lead = normalizeLeadForCrm({id:'1',companyName:'XYZ',status:'PROPOSAL',score:'82',classification:'HOT',source:'LINKEDIN'});
if (lead.status !== 'PROPOSAL' || lead.score !== 82 || lead.source !== 'LINKEDIN') throw Error('CRM schema failed');
if (!LEAD_STATUSES.includes('WON') || normalizeLeadForCrm({status:'INVALID'}).status !== 'NEW') throw Error('CRM status guard failed');
console.log('PASS CRM schema');
