const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createProductionSdrGateway, withinBusinessHours, localClock, awayText } = require('./production-sdr');
const { createSdrSettingsStore } = require('./sdr-settings');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdr-behavior-'));
const LEAD_UUID = '123e4567-e89b-12d3-a456-426614174000';
const TOKEN = 'L123e4567e89b12d3a456426614174000';

// Datas fixas em UTC; São Paulo = UTC-3 (sem horário de verão desde 2019).
const at = iso => new Date(iso);
const MON_10H = at('2026-10-12T13:00:00Z'); // segunda 10:00 em SP
const MON_22H = at('2026-10-13T01:00:00Z'); // segunda 22:00 em SP
const TUE_01H = at('2026-10-13T04:00:00Z'); // terça 01:00 em SP
const SUN_10H = at('2026-10-11T13:00:00Z'); // domingo 10:00 em SP

function harness({ env = { AI_ASSIST_ENABLED: 'false' }, generateReply, clock = MON_10H, random = () => 0.5 } = {}) {
  const settings = createSdrSettingsStore({ file: path.join(dir, `s-${Math.random().toString(36).slice(2)}.json`) });
  const log = { updates: [], audits: [], events: [], sent: [], messages: [], typing: [], waits: [] };
  const repository = {
    async updateLead(id, patch) { log.updates.push({ id, patch }); return { id, ...patch }; },
    async createAudit(row) { log.audits.push(row); return row; },
    async createEvent(row) { log.events.push(row); return row; },
    async listEvents({ leadId, type }) { return log.events.filter(e => e.lead_id === leadId && (!type || e.type === type)).reverse(); },
    async createMessage(row) { log.messages.unshift({ ...row }); return row; },
    async listMessages() { return log.messages; }
  };
  const sender = {
    provider: 'TEST',
    async sendText(payload) { log.sent.push(payload); return { messages: [{ id: `out.${log.sent.length}` }] }; },
    async sendTyping(payload) { log.typing.push(payload); return true; }
  };
  const state = { clock };
  const sdr = createProductionSdrGateway({
    repository, sender, env, slot: 1, settings, generateReply,
    now: () => state.clock, wait: async ms => { log.waits.push(ms); }, random
  });
  let n = 0;
  async function say(lead, text) {
    const id = `in.${++n}`;
    log.messages.unshift({ direction: 'INBOUND', external_message_id: id, text_content: text });
    const out = await sdr.process({ lead, message: { external_message_id: id, text } });
    const last = log.updates[log.updates.length - 1];
    if (last && last.id === lead.id) Object.assign(lead, last.patch);
    return out;
  }
  return { settings, log, say, state, sender };
}
const lastSent = h => h.log.sent[h.log.sent.length - 1]?.text || null;
const product = extra => ({ name: 'Método X', code: 'EMAG', link: 'https://pay.exemplo.com/metodo-x?ref=af1', price: 'R$ 197,00', pitch: 'Curso prático.', ...extra });

(async () => {
  try {
    // Relógio de São Paulo e horário de atendimento
    assert.deepEqual(localClock(MON_10H), { day: 1, minutes: 600, date: '2026-10-12' });
    assert.deepEqual(localClock(TUE_01H), { day: 2, minutes: 60, date: '2026-10-13' });
    const weekdays = { enabled: true, start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5] };
    assert.equal(withinBusinessHours(weekdays, MON_10H), true);
    assert.equal(withinBusinessHours(weekdays, MON_22H), false);
    assert.equal(withinBusinessHours(weekdays, SUN_10H), false, 'domingo fora dos dias marcados');
    assert.equal(withinBusinessHours({ ...weekdays, enabled: false }, SUN_10H), true, 'horário desligado = sempre aberto');
    const night = { enabled: true, start: '18:00', end: '02:00', days: [1] };
    assert.equal(withinBusinessHours(night, MON_22H), true);
    assert.equal(withinBusinessHours(night, TUE_01H), true, 'madrugada de terça conta como expediente de segunda');
    assert.equal(withinBusinessHours(night, MON_10H), false);
    assert.equal(awayText({ start: '09:00', end: '18:00', awayMessage: 'Abrimos {inicio}-{fim}.' }), 'Abrimos 09:00-18:00.');
    assert.ok(awayText({ start: '09:00', end: '18:00', awayMessage: '' }).includes('das 09:00 às 18:00'));

    // 1. Fora do horário com mensagem de ausência: uma vez por dia, lead não muda, robô não conduz
    {
      const h = harness({ clock: MON_22H });
      h.settings.saveProduct(product());
      h.settings.setSlot(1, { mode: 'PRODUCT', productId: 'metodo-x', hours: { ...weekdays, outside: 'AWAY', awayMessage: 'Voltamos às {inicio}.' } });
      const lead = { id: LEAD_UUID, phone: '5571999990001', status: 'NEW' };
      let out = await h.say(lead, 'oi (ref EMAG)');
      assert.deepEqual([out.outsideHours, out.replySent, out.status], [true, true, 'NEW']);
      assert.equal(lastSent(h), 'Voltamos às 09:00.');
      assert.equal(h.log.updates.length, 1, 'só a origem do anúncio é gravada');
      assert.deepEqual(h.log.updates[0].patch.campaign, 'EMAG');
      assert.equal(h.log.updates[0].patch.status, undefined, 'fora do horário o lead não muda de etapa');
      assert.equal(lead.status, 'NEW');
      out = await h.say(lead, 'alguém aí?');
      assert.equal(out.replySent, false, 'ausência não se repete no mesmo dia');
      assert.equal(h.log.sent.length, 1);
      assert.equal(h.log.events.filter(e => e.type === 'SDR_AWAY_MESSAGE').length, 1);

      // Abriu o expediente: o robô atende normalmente
      h.state.clock = at('2026-10-13T12:30:00Z'); // terça 09:30
      out = await h.say(lead, 'oi, voltei');
      assert.equal(out.status, 'PRODUCT_PRESENTED');
      assert.equal(out.productId, 'metodo-x', 'produto reconhecido pela campanha gravada fora do horário');
      assert.ok(lastSent(h).includes('Curso prático.'));
    }

    // 2. Fora do horário em silêncio; cliente com uma pessoa nunca recebe ausência
    {
      const h = harness({ clock: SUN_10H });
      h.settings.setSlot(1, { mode: 'CONTA_PJ', hours: { ...weekdays, outside: 'SILENT' } });
      let out = await h.say({ id: 'a1', phone: '5571999990002', status: 'NEW' }, 'Olá');
      assert.deepEqual([out.outsideHours, out.replySent], [true, false]);
      assert.equal(h.log.sent.length, 0);
      assert.equal(h.log.events[0].type, 'SDR_OUTSIDE_HOURS');

      h.settings.setSlot(1, { mode: 'CONTA_PJ', hours: { ...weekdays, outside: 'AWAY' } });
      out = await h.say({ id: 'a2', phone: '5571999990003', status: 'HUMAN_HANDOFF' }, 'oi');
      assert.equal(out.replySent, false);
      out = await h.say({ id: 'a3', phone: '5571999990004', status: 'LOST' }, 'oi');
      assert.equal(out.replySent, false);
      assert.equal(h.log.sent.length, 0);
    }

    // 3. Tempo de resposta: espera sorteada entre mínimo e máximo, com "digitando..."
    {
      const h = harness({ random: () => 0.5 });
      h.settings.setSlot(1, { mode: 'CONTA_PJ', delayMin: 4, delayMax: 10, typing: true });
      await h.say({ id: 'b1', phone: '5571999990005', status: 'NEW' }, 'Olá');
      assert.deepEqual(h.log.waits, [7000]);
      assert.equal(h.log.typing.length, 1);
      assert.equal(h.log.typing[0].to, '5571999990005');

      h.settings.setSlot(1, { mode: 'CONTA_PJ', delayMin: 0, delayMax: 0 });
      await h.say({ id: 'b2', phone: '5571999990006', status: 'NEW' }, 'Olá');
      assert.deepEqual(h.log.waits, [7000], 'sem espera configurada responde na hora');

      h.settings.setSlot(1, { mode: 'CONTA_PJ', delayMin: 2, delayMax: 2, typing: false });
      await h.say({ id: 'b3', phone: '5571999990007', status: 'NEW' }, 'Olá');
      assert.deepEqual(h.log.waits, [7000, 2000]);
      assert.equal(h.log.typing.length, 1, '"digitando..." desligado no painel');

      // Falha do aviso de digitação não impede a resposta
      h.settings.setSlot(1, { mode: 'CONTA_PJ', delayMin: 1, delayMax: 1, typing: true });
      h.sender.sendTyping = async () => { throw new Error('SOCKET_CLOSED'); };
      const original = console.warn; console.warn = () => {};
      let out;
      try { out = await h.say({ id: 'b4', phone: '5571999990008', status: 'NEW' }, 'Olá'); } finally { console.warn = original; }
      assert.equal(out.replySent, true);

      // Robô desligado não espera nem digita
      h.settings.setSlot(1, { mode: 'OFF', delayMin: 5, delayMax: 5 });
      const waits = h.log.waits.length;
      await h.say({ id: 'b5', phone: '5571999990009', status: 'NEW' }, 'Olá');
      assert.equal(h.log.waits.length, waits);
    }

    // 4. Link rastreado, objeções, limite por produto e venda aprovada
    {
      const h = harness();
      h.settings.saveProduct(product({ trackingParam: 'sck', maxReplies: 4, objections: 'sem tempo, nao tenho tempo => As aulas ficam gravadas, você assiste quando puder.' }));
      h.settings.setSlot(1, { mode: 'PRODUCT', productId: 'metodo-x' });
      const lead = { id: LEAD_UUID, phone: '5571999990010', status: 'NEW' };

      await h.say(lead, 'oi (ref EMAG)');
      let out = await h.say(lead, 'Não tenho tempo, é corrido');
      assert.equal(out.intent, 'OBJECTION');
      assert.equal(out.status, 'PRODUCT_PRESENTED');
      assert.equal(lastSent(h), 'As aulas ficam gravadas, você assiste quando puder.');

      out = await h.say(lead, 'quero comprar');
      assert.equal(out.linkSent, true);
      assert.ok(lastSent(h).includes(`https://pay.exemplo.com/metodo-x?ref=af1&sck=${TOKEN}`), 'link leva o token do lead');

      out = await h.say(lead, 'ok');
      // 4 respostas automáticas: a próxima mensagem vai para uma pessoa
      out = await h.say(lead, 'mais uma coisa');
      assert.equal(out.status, 'HUMAN_HANDOFF');
      assert.equal(out.intent, 'REPLY_LIMIT');
    }

    // 5. IA desligada no produto: dúvida não passa pela IA mesmo com a IA do servidor ligada
    {
      const calls = [];
      const h = harness({ env: { AI_ASSIST_ENABLED: 'true', AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'k' }, generateReply: async a => { calls.push(a); return { reply: 'resposta' }; } });
      h.settings.saveProduct(product({ aiEnabled: false, tone: 'DIRETO' }));
      h.settings.setSlot(1, { mode: 'PRODUCT', productId: 'metodo-x' });
      const lead = { id: 'c1', phone: '5571999990011', status: 'NEW' };
      await h.say(lead, 'oi');
      const out = await h.say(lead, 'funciona no celular?');
      assert.equal(calls.length, 0);
      assert.equal(out.aiAssist, false);

      // Com IA permitida, o tom escolhido vai no contexto
      h.settings.saveProduct({ ...product({ tone: 'DIRETO' }), id: 'metodo-x' });
      const lead2 = { id: 'c2', phone: '5571999990012', status: 'NEW' };
      await h.say(lead2, 'oi');
      await h.say(lead2, 'funciona no celular?');
      assert.equal(calls.length, 1);
      assert.ok(calls[0].context.includes('Tom direto e objetivo'));
    }

    // 6. Venda aprovada: o robô para de falar com o cliente
    {
      const h = harness();
      h.settings.saveProduct(product());
      h.settings.setSlot(1, { mode: 'PRODUCT', productId: 'metodo-x' });
      const out = await h.say({ id: 'd1', phone: '5571999990013', status: 'PRODUCT_SOLD' }, 'oi, já comprei');
      assert.equal(out.replySent, false);
      assert.equal(h.log.sent.length, 0);
    }

    console.log('PASS SDR behavior: business hours, reply delay, tracked link, objections, reply limit, AI per product');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exit(1); });
