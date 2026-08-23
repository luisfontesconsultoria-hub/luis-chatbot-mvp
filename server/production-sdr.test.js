const assert = require('assert');
const { createProductionSdrGateway } = require('./production-sdr');

(async () => {
  const lead = { id:'1', phone:'5551999999999', status:'NEW' };
  const updates=[]; const messages=[]; const audits=[]; const events=[]; const sent=[];
  const repository = {
    async updateLead(id, patch){ updates.push({id, patch}); return { ...lead, ...patch }; },
    async createMessage(row){ messages.push(row); return row; },
    async createAudit(row){ audits.push(row); return row; },
    async createEvent(row){ events.push(row); return row; }
  };
  const sender = { async sendText(payload){ sent.push(payload); return { messages:[{id:'wamid.out.test'}] }; } };
  const sdr = createProductionSdrGateway({ repository, sender, env:{ AI_ASSIST_ENABLED:'false' } });
  const result = await sdr.process({ lead, message:{ external_message_id:'wamid.in.test', text:'Quero abrir conta PJ' } });
  assert.equal(result.status, 'IDENTIFYING');
  assert.equal(result.replySent, true);
  assert.equal(sent.length, 1);
  assert.equal(messages.length, 1);
  assert.equal(audits.length, 1);
  assert.equal(events.length, 1);
  assert.equal(updates[0].patch.status, 'IDENTIFYING');
  console.log('PASS production SDR gateway');
})();
