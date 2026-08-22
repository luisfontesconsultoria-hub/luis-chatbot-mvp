const { handleMetaPost } = require('../http/meta-webhook');

(async () => {
  const state = { leads:[], messages:[], audits:[], events:[] };
  const repository = {
    async findLeadByPhone(phone){ return state.leads.find(x=>x.phone===phone)||null; },
    async upsertLead(data){ let x=state.leads.find(y=>y.id===data.id||y.phone===data.phone); if(x)Object.assign(x,data); else {x={id:`lead-${state.leads.length+1}`,...data};state.leads.push(x);} return [x]; },
    async saveEvent(data){ state.events.push(data); return [data]; },
    async saveMessage(data){ state.messages.push(data); return [data]; },
    async saveAudit(data){ state.audits.push(data); return [data]; }
  };
  const sent=[];
  const channel={async sendText(x){sent.push(x);}};
  const body={entry:[{changes:[{value:{metadata:{phone_number_id:'pilot-1'},messages:[{id:'wamid-e2e-1',from:'5551990000000',timestamp:'1724328000',text:{body:'Olá'}}]}}]}]};
  const result=await handleMetaPost({body,repository,channel});
  if(!result.ok||!result.leadId||state.leads.length!==1||state.messages.length!==2||state.audits.length!==1||sent.length!==1) throw Error('E2E contract failed');
  console.log('PASS Meta webhook -> pipeline -> persistence -> response contract');
})();
