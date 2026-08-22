const { runInbound } = require('./pipeline');

function fakeRepo() {
  const state = { leads: [], events: [], messages: [], audits: [] };
  return {
    state,
    async findLeadByPhone(phone) { return state.leads.find(x => x.phone === phone) || null; },
    async upsertLead(data) {
      const existing = state.leads.find(x => x.id === data.id || x.phone === data.phone);
      if (existing) Object.assign(existing, data);
      else state.leads.push({ id: `lead-${state.leads.length + 1}`, ...data });
      return [existing || state.leads[state.leads.length - 1]];
    },
    async saveEvent(data) {
      if (state.events.some(x => x.idempotency_key === data.idempotency_key)) throw new Error('23505 duplicate');
      state.events.push(data); return [data];
    },
    async saveMessage(data) { state.messages.push(data); return [data]; },
    async saveAudit(data) { state.audits.push(data); return [data]; }
  };
}

(async () => {
  const repo = fakeRepo();
  const sent = [];
  const channel = { async sendText(x) { sent.push(x); } };

  const event = { channel:'WHATSAPP', externalMessageId:'m-1', phone:'+5551999999999', text:'Olá' };
  const first = await runInbound({ event, repository:repo, channel });
  if (!first.ok || first.duplicate || sent.length !== 1) throw Error('first inbound failed');

  const duplicate = await runInbound({ event, repository:repo, channel });
  if (!duplicate.ok || !duplicate.duplicate || sent.length !== 1) throw Error('duplicate was processed twice');

  const blockedLead = { id:'lead-blocked', phone:'+5551888888888', status:'AGUARDANDO_RETORNO_DO_LUIS' };
  repo.state.leads.push(blockedLead);
  const blocked = await runInbound({ event:{...event, externalMessageId:'m-2', phone:blockedLead.phone, text:'Quero continuar'}, repository:repo, channel });
  if (blocked.status !== 'AGUARDANDO_RETORNO_DO_LUIS' || !blocked.handoff) throw Error('blocked flow failed');

  console.log('PASS integration: inbound persistence, idempotency and human block');
})();
