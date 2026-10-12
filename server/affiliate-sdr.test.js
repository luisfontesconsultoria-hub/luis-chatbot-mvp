const assert = require('assert');
const { createProductionSdrGateway, resolveSdrMode } = require('./production-sdr');
const { authorizeSaleWebhook, normalizeSalePayload, handleAffiliateSale } = require('../backend/affiliate/sale-webhook');

const PRODUCTS = JSON.stringify([{ code: 'PROD1', name: 'Curso Alfa', checkout_url: 'https://pay.exemplo.com/alfa', price: 'R$ 297 à vista', guarantee: '7 dias de garantia', includes: '12 aulas.' }]);
const LEAD_ID = '3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90';

function fakeRepo(initialLead = null) {
  const state = { updates: [], audits: [], events: [], messages: [], leads: new Map() };
  if (initialLead) state.leads.set(initialLead.id, { ...initialLead });
  state.repo = {
    async updateLead(id, patch) { state.updates.push({ id, patch }); const next = { ...(state.leads.get(id) || { id }), ...patch }; state.leads.set(id, next); return next; },
    async getLead(id) { return state.leads.get(id) || null; },
    async createMessage(row) { state.messages.push(row); return row; },
    async createAudit(row) { state.audits.push(row); return row; },
    async createEvent(row) { state.events.push(row); return row; },
    async listEvents({ leadId, type }) { return state.events.filter(e => e.lead_id === leadId && (!type || e.type === type)); },
    async listMessages() { return []; }
  };
  return state;
}

(async () => {
  // ---- seleção de modo
  assert.equal(resolveSdrMode({}), 'PJ');
  assert.equal(resolveSdrMode({ SDR_MODE: 'afiliado' }), 'AFILIADO');
  assert.equal(resolveSdrMode({ SDR_MODE: 'PJ', SDR_MODE_SLOT_2: 'AFILIADO' }, 2), 'AFILIADO');
  assert.equal(resolveSdrMode({ SDR_MODE: 'PJ', SDR_MODE_SLOT_2: 'AFILIADO' }, 1), 'PJ');
  assert.equal(resolveSdrMode({ SDR_MODE: 'qualquer' }), 'PJ');
  console.log('PASS sdr mode resolution');

  // ---- PJ continua idêntico quando nada é configurado
  {
    const s = fakeRepo(); const sent = [];
    const sdr = createProductionSdrGateway({ repository: s.repo, sender: { async sendText(p) { sent.push(p); return { messages: [{ id: 'out1' }] }; } }, env: { AI_ASSIST_ENABLED: 'false' } });
    const r = await sdr.process({ lead: { id: '1', phone: '5551999999999', status: 'NEW' }, message: { external_message_id: 'in1', text: 'Olá' } });
    assert.equal(r.status, 'IDENTIFYING');
    assert.equal(r.mode, 'PJ');
    assert.equal(s.updates[0].patch.stage, undefined, 'modo PJ não mexe na etapa comercial');
    assert.match(sent[0].text, /com quem eu estou falando/);
  }
  console.log('PASS PJ mode unchanged');

  // ---- afiliado ponta a ponta no gateway
  {
    const s = fakeRepo(); const sent = [];
    const sender = { async sendText(p) { sent.push(p); return { messages: [{ id: `out${sent.length}` }] }; } };
    // IA "ligada" com chave falsa: respostas travadas (link/preço) não podem passar pela IA.
    const sdr = createProductionSdrGateway({ repository: s.repo, sender, mode: 'AFILIADO', env: { AI_ASSIST_ENABLED: 'false', AFFILIATE_PRODUCTS: PRODUCTS } });
    let lead = { id: LEAD_ID, phone: '5571999999999', status: 'NEW' };
    let r = await sdr.process({ lead, message: { external_message_id: 'a1', text: 'oi #G-PROD1-K03' } });
    assert.equal(r.status, 'AF_DIAGNOSING');
    assert.equal(r.mode, 'AFILIADO');
    const first = s.updates.at(-1).patch;
    assert.equal(first.stage, 'QUALIFYING');
    assert.equal(first.productInterest, 'PROD1');
    assert.equal(first.campaign, 'G-PROD1-K03');
    assert.equal(first.source, 'GOOGLE_ADS');

    lead = { ...lead, ...first, status: 'AF_DECIDING', stage: 'QUALIFIED' };
    r = await sdr.process({ lead, message: { external_message_id: 'a2', text: 'me manda o link' } });
    assert.equal(r.status, 'AF_LINK_SENT');
    assert.ok(sent.at(-1).text.includes('sck=L3f2a9c1e5b7d4e8a9c217d4e5f6a8b90'));
    assert.ok(s.events.some(e => e.type === 'AFFILIATE_LINK_SENT' && e.idempotency_key === 'AFFILIATE_LINK_SENT:a2'));
    const audit = s.audits.at(-1);
    assert.equal(audit.from_stage, 'QUALIFIED');
    assert.equal(audit.to_stage, 'NEGOTIATION');
    assert.equal(audit.metadata.mode, 'AFILIADO');
  }
  console.log('PASS affiliate gateway flow');

  // ---- IA não reescreve resposta travada (link); stub de fetch garante que nem é chamada
  {
    const s = fakeRepo(); const sent = []; let aiCalls = 0;
    const realFetch = global.fetch;
    global.fetch = async () => { aiCalls++; return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'TEXTO DA IA' }] } }] }) }; };
    process.env.AI_ASSIST_ENABLED = 'true'; process.env.AI_PROVIDER = 'gemini'; process.env.GEMINI_API_KEY = 'test-key';
    try {
      const sdr = createProductionSdrGateway({ repository: s.repo, sender: { async sendText(p) { sent.push(p); return { messages: [{ id: 'o' }] }; } }, mode: 'AFILIADO', env: { AI_ASSIST_ENABLED: 'true', AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key', AFFILIATE_PRODUCTS: PRODUCTS } });
      await sdr.process({ lead: { id: LEAD_ID, phone: '5571', status: 'AF_DECIDING', productInterest: 'PROD1' }, message: { external_message_id: 'b1', text: 'quero comprar' } });
      assert.equal(aiCalls, 0);
      assert.ok(sent[0].text.includes('https://pay.exemplo.com/alfa'));
      // resposta sem fatos (diagnóstico) pode ser reescrita pela IA
      await sdr.process({ lead: { id: LEAD_ID, phone: '5571', status: 'NEW' }, message: { external_message_id: 'b2', text: 'oi' } });
      assert.equal(aiCalls, 1);
      assert.equal(sent[1].text, 'TEXTO DA IA');
    } finally {
      global.fetch = realFetch; delete process.env.AI_ASSIST_ENABLED; delete process.env.AI_PROVIDER; delete process.env.GEMINI_API_KEY;
    }
  }
  console.log('PASS AI never rewrites locked replies');

  // ---- ficha inválida não derruba o WhatsApp: lead vai para o Luís
  {
    const s = fakeRepo();
    const sdr = createProductionSdrGateway({ repository: s.repo, sender: { async sendText() { return { messages: [{ id: 'o' }] }; } }, mode: 'AFILIADO', env: { AI_ASSIST_ENABLED: 'false', AFFILIATE_PRODUCTS: '{quebrado' } });
    const r = await sdr.process({ lead: { id: 'z', phone: '5571', status: 'NEW' }, message: { external_message_id: 'c1', text: 'oi' } });
    assert.equal(r.status, 'AGUARDANDO_RETORNO_DO_LUIS');
    assert.equal(r.handoff, true);
  }
  console.log('PASS invalid product sheet is safe');

  // ---- webhook de venda
  assert.equal(authorizeSaleWebhook({ secret: '', headers: {}, query: {} }).status, 503);
  assert.equal(authorizeSaleWebhook({ secret: 's3cr3t', headers: {}, query: { token: 'errado' } }).status, 401);
  assert.equal(authorizeSaleWebhook({ secret: 's3cr3t', headers: { 'x-affiliate-secret': 's3cr3t' }, query: {} }).ok, true);
  assert.equal(authorizeSaleWebhook({ secret: 's3cr3t', headers: {}, query: { token: 's3cr3t' } }).ok, true);

  const nested = normalizeSalePayload({ event: 'PURCHASE_APPROVED', data: { purchase: { transaction: 'HP123', status: 'APPROVED', origin: { sck: 'L3f2a9c1e5b7d4e8a9c217d4e5f6a8b90' } }, commissions: [{ value: '97,50' }] } });
  assert.equal(nested.transactionId, 'HP123');
  assert.equal(nested.kind, 'APPROVED');
  assert.equal(nested.leadId, LEAD_ID);
  assert.equal(nested.commission, 97.5);
  const deep = normalizeSalePayload({ order_id: 'K9', status: 'paid', custom: { foo: ['x', 'utm=L3f2a9c1e5b7d4e8a9c217d4e5f6a8b90'] } });
  assert.equal(deep.leadId, LEAD_ID);
  assert.equal(normalizeSalePayload({ transaction_id: 'T', status: 'refunded' }).kind, 'REFUNDED');
  assert.equal(normalizeSalePayload({ transaction_id: 'T', status: 'chargeback' }).kind, 'REFUNDED');
  assert.equal(normalizeSalePayload({ transaction_id: 'T', status: 'waiting_payment' }).kind, 'OTHER');

  {
    const s = fakeRepo({ id: LEAD_ID, status: 'AF_LINK_SENT', stage: 'NEGOTIATION' });
    const body = { transaction_id: 'TX1', status: 'approved', sck: 'L3f2a9c1e5b7d4e8a9c217d4e5f6a8b90', commission: 120, buyer_email: 'cliente@exemplo.com' };
    let r = await handleAffiliateSale({ repository: s.repo, body, platform: 'teste' });
    assert.deepEqual(r.body, { received: true, matched: true, applied: true, kind: 'APPROVED' });
    assert.equal(s.leads.get(LEAD_ID).stage, 'CONVERTIDO');
    assert.equal(s.leads.get(LEAD_ID).status, 'AF_SOLD');
    assert.equal(s.audits.at(-1).to_stage, 'CONVERTIDO');
    assert.ok(!JSON.stringify(s.events).includes('cliente@exemplo.com'), 'e-mail do comprador não é persistido');
    r = await handleAffiliateSale({ repository: s.repo, body });
    assert.equal(r.body.duplicate, true, 'mesma transação não é aplicada duas vezes');
    assert.equal(s.audits.length, 1);
    r = await handleAffiliateSale({ repository: s.repo, body: { ...body, status: 'refunded' } });
    assert.equal(r.body.kind, 'REFUNDED');
    assert.equal(s.leads.get(LEAD_ID).stage, 'REEMBOLSADO');

    r = await handleAffiliateSale({ repository: s.repo, body: { transaction_id: 'TX2', status: 'approved' } });
    assert.equal(r.status, 202);
    assert.equal(r.body.matched, false);
    assert.ok(s.events.some(e => e.type === 'AFFILIATE_SALE_UNMATCHED' && e.lead_id === null));

    r = await handleAffiliateSale({ repository: s.repo, body: { status: 'approved' } });
    assert.equal(r.status, 400);
  }
  console.log('PASS affiliate sale webhook');
})().catch(error => { console.error(error); process.exit(1); });
