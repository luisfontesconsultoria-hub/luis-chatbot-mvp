const assert = require('assert');
const { createProductionSdrGateway } = require('./production-sdr');

(async () => {
  const updates=[]; const messages=[]; const audits=[]; const events=[]; const sent=[];
  const repository = {
    async updateLead(id, patch){ updates.push({id, patch}); return { id, ...patch }; },
    async createMessage(row){ messages.push(row); return row; },
    async createAudit(row){ audits.push(row); return row; },
    async createEvent(row){ events.push(row); return row; },
    async listMessages(){ return []; }
  };
  const sender = { async sendText(payload){ sent.push(payload); return { messages:[{id:'wamid.out.test'}] }; } };
  const sdr = createProductionSdrGateway({ repository, sender, env:{ AI_ASSIST_ENABLED:'false' } });

  const firstLead = { id:'1', phone:'5551999999999', status:'NEW' };
  const first = await sdr.process({ lead:firstLead, message:{ external_message_id:'wamid.in.test.1', text:'Olá' } });
  assert.equal(first.status, 'IDENTIFYING');
  assert.equal(first.replySent, true);

  const cnpjLead = { id:'2', phone:'5551999999998', status:'CNPJ_PENDING' };
  const cnpj = await sdr.process({ lead:cnpjLead, message:{ external_message_id:'wamid.in.test.2', text:'11.222.333/0001-81' } });
  assert.equal(cnpj.status, 'AGUARDANDO_RETORNO_DO_LUIS');
  assert.equal(cnpj.replySent, true);
  const sentBeforeGate = sent.length;
  const blockedCnpj = await sdr.process({ lead:{...cnpjLead,status:'AGUARDANDO_RETORNO_DO_LUIS'}, message:{ external_message_id:'wamid.in.test.3', text:'Ainda aguardando?' } });
  assert.equal(blockedCnpj.status, 'AGUARDANDO_RETORNO_DO_LUIS');
  assert.equal(blockedCnpj.replySent, false);
  assert.equal(sent.length, sentBeforeGate);

  const scheduleLead = { id:'3', phone:'5551999999997', status:'SCHEDULING' };
  const schedule = await sdr.process({ lead:scheduleLead, message:{ external_message_id:'wamid.in.test.4', text:'terça às 14h' } });
  assert.equal(schedule.status, 'AGUARDANDO_CONFIRMACAO_AGENDA');
  assert.equal(schedule.replySent, true);
  const sentBeforeScheduleGate = sent.length;
  const blockedSchedule = await sdr.process({ lead:{...scheduleLead,status:'AGUARDANDO_CONFIRMACAO_AGENDA'}, message:{ external_message_id:'wamid.in.test.5', text:'Pode confirmar?' } });
  assert.equal(blockedSchedule.status, 'AGUARDANDO_CONFIRMACAO_AGENDA');
  assert.equal(blockedSchedule.replySent, false);
  assert.equal(sent.length, sentBeforeScheduleGate);

  assert.ok(updates.some(x=>x.patch.status==='AGUARDANDO_RETORNO_DO_LUIS'));
  assert.ok(updates.some(x=>x.patch.status==='AGUARDANDO_CONFIRMACAO_AGENDA'));
  assert.ok(audits.some(x=>x.metadata?.humanGate===true));
  assert.ok(events.length >= 4);
  assert.equal(messages.length, 3);
  console.log('PASS production SDR gateway and human gates');
})();
