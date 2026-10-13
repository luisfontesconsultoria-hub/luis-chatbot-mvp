const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createProductionSdrGateway } = require('./production-sdr');
const { createSdrSettingsStore } = require('./sdr-settings');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdr-product-'));

function harness({ env = { AI_ASSIST_ENABLED: 'false' }, generateReply, slot = 2 } = {}) {
  const settings = createSdrSettingsStore({ file: path.join(dir, `s-${Math.random().toString(36).slice(2)}.json`) });
  const log = { updates: [], audits: [], events: [], sent: [], messages: [] };
  const repository = {
    async updateLead(id, patch) { log.updates.push({ id, patch }); return { id, ...patch }; },
    async createAudit(row) { log.audits.push(row); return row; },
    async createEvent(row) { log.events.push(row); return row; },
    async createMessage(row) { log.messages.unshift({ ...row }); return row; },
    async listMessages() { return log.messages; } // mais recente primeiro, como no adapter real
  };
  const sender = { provider: 'TEST', async sendText(payload) { log.sent.push(payload); return { messages: [{ id: `out.${log.sent.length}` }] }; } };
  const sdr = createProductionSdrGateway({ repository, sender, env, slot, settings, generateReply });
  let n = 0;
  // Simula o pipeline real: a mensagem recebida é gravada antes de o SDR rodar e o lead é atualizado depois.
  async function say(lead, text) {
    const id = `in.${++n}`;
    log.messages.unshift({ direction: 'INBOUND', external_message_id: id, text_content: text });
    const out = await sdr.process({ lead, message: { external_message_id: id, text } });
    const last = log.updates[log.updates.length - 1];
    if (last && last.id === lead.id) Object.assign(lead, last.patch);
    return out;
  }
  return { settings, log, sdr, say };
}
const lastSent = h => h.log.sent[h.log.sent.length - 1]?.text || null;

(async () => {
  try {
    // 1. Número sem configuração: o CRM só observa. Não responde nem mexe no lead.
    {
      const h = harness();
      const lead = { id: 'a', phone: '5551999990001', status: 'NEW' };
      const out = await h.say(lead, 'Olá, quero abrir conta');
      assert.deepEqual(out, { status: 'NEW', handoff: false, replySent: false, mode: 'OFF' });
      assert.equal(h.log.sent.length + h.log.updates.length + h.log.audits.length + h.log.events.length, 0);
    }

    // 2. Modo Conta PJ: roteiro original intacto
    {
      const h = harness();
      h.settings.setSlot(2, { mode: 'CONTA_PJ' });
      const out = await h.say({ id: 'b', phone: '5551999990002', status: 'NEW' }, 'Olá');
      assert.equal(out.status, 'IDENTIFYING');
      assert.equal(out.replySent, true);
      assert.equal(out.mode, undefined);
    }

    // 3. Sem slot (webhook oficial / chamadas antigas): comportamento original
    {
      const h = harness({ slot: null });
      const out = await h.say({ id: 'c', phone: '5551999990003', status: 'NEW' }, 'Olá');
      assert.equal(out.status, 'IDENTIFYING');
    }

    // 4. Venda de produto de ponta a ponta, sem IA
    {
      const h = harness();
      h.settings.saveProduct({ name: 'Método X', code: 'EMAG', link: 'https://exemplo.com/metodo-x', price: 'R$ 197,00', pitch: 'Curso prático em vídeo.', knowledge: 'Acesso por 12 meses.' });
      h.settings.saveProduct({ name: 'Guia Y', code: 'GUIA', link: 'https://exemplo.com/guia-y', source: 'META_ADS' });
      h.settings.setSlot(2, { mode: 'PRODUCT', productId: 'metodo-x' });
      const lead = { id: 'd', phone: '5551999990004', status: 'NEW', source: 'WHATSAPP_QR_SLOT_2' };

      let out = await h.say(lead, 'Olá! Quero saber mais (ref EMAG-G1)');
      assert.equal(out.status, 'PRODUCT_PRESENTED');
      assert.equal(out.mode, 'PRODUCT');
      assert.ok(lastSent(h).includes('Curso prático em vídeo.'));
      // Origem gravada no lead no primeiro contato
      assert.deepEqual({ interest: lead.interest, campaign: lead.campaign, source: lead.source }, { interest: 'Método X', campaign: 'EMAG-G1', source: 'GOOGLE_ADS' });
      assert.equal(h.log.audits[0].metadata.mode, 'PRODUCT');
      assert.equal(h.log.audits[0].metadata.campaign, 'EMAG-G1');

      out = await h.say(lead, 'sim');
      assert.equal(out.status, 'PRODUCT_LINK_SENT');
      assert.equal(out.linkSent, true);
      assert.ok(lastSent(h).includes('https://exemplo.com/metodo-x') && lastSent(h).includes('R$ 197,00'));
      const linkEvents = h.log.events.filter(e => e.type === 'PRODUCT_LINK_SENT');
      assert.equal(linkEvents.length, 1);
      assert.deepEqual(linkEvents[0].payload, { productId: 'metodo-x', campaign: 'EMAG-G1', slot: 2 });
      assert.equal(lead.campaign, 'EMAG-G1', 'mensagens seguintes não sobrescrevem a campanha');

      out = await h.say(lead, 'obrigado');
      assert.equal(out.status, 'PRODUCT_LINK_SENT');
      assert.equal(out.replySent, true);

      // Dúvida depois do link, sem IA: passa para uma pessoa e avisa o lead
      out = await h.say(lead, 'tem certificado?');
      assert.equal(out.status, 'HUMAN_HANDOFF');
      assert.equal(out.handoff, true);
      assert.ok(lastSent(h).includes('pessoa da equipe'));
      assert.equal(h.log.events.filter(e => e.type === 'SDR_HUMAN_GATE').length, 1);

      // Depois do repasse o robô fica em silêncio e não toca mais no lead
      const before = { sent: h.log.sent.length, updates: h.log.updates.length, audits: h.log.audits.length };
      out = await h.say(lead, 'quero comprar');
      assert.equal(out.replySent, false);
      assert.equal(out.status, 'HUMAN_HANDOFF');
      assert.deepEqual({ sent: h.log.sent.length, updates: h.log.updates.length, audits: h.log.audits.length }, before);

      // Toda resposta saiu pelo número que recebeu e foi gravada como OUTBOUND
      assert.ok(h.log.sent.every(m => m.to === '5551999990004'));
      assert.equal(h.log.messages.filter(m => m.direction === 'OUTBOUND').length, h.log.sent.length);

      // Outro lead, sem código: usa o produto do número e não inventa origem de anúncio
      const plain = { id: 'e', phone: '5551999990005', status: 'NEW', source: 'WHATSAPP_QR_SLOT_2' };
      await h.say(plain, 'oi');
      assert.deepEqual({ interest: plain.interest, campaign: plain.campaign, source: plain.source }, { interest: 'Método X', campaign: 'EMAG', source: 'WHATSAPP_QR_SLOT_2' });

      // Código de outro produto no mesmo número: atende pelo produto do código
      const cross = { id: 'f', phone: '5551999990006', status: 'NEW' };
      out = await h.say(cross, 'Oi (ref GUIA)');
      assert.equal(out.productId, 'guia-y');
      assert.equal(cross.source, 'META_ADS');

      // Lead em andamento que chega pelo anúncio de outro produto recomeça nesse produto
      out = await h.say(plain, 'Vi outro anúncio (ref GUIA-B2)');
      assert.equal(out.status, 'PRODUCT_PRESENTED');
      assert.equal(out.productId, 'guia-y');
      assert.equal(plain.campaign, 'GUIA-B2');

      // Cliente em outro estágio (ex.: roteiro Conta PJ) não é abordado
      const old = { id: 'g', phone: '5551999990007', status: 'QUALIFYING' };
      const sentBefore = h.log.sent.length;
      out = await h.say(old, 'bom dia');
      assert.equal(out.replySent, false);
      assert.equal(out.intent, 'OUT_OF_FLOW');
      assert.equal(h.log.sent.length, sentBefore);
      assert.equal(old.interest, undefined);

      // Pedido de saída: uma confirmação e depois silêncio
      const quitter = { id: 'h', phone: '5551999990008', status: 'NEW' };
      await h.say(quitter, 'oi');
      out = await h.say(quitter, 'não tenho interesse');
      assert.equal(out.status, 'LOST');
      assert.equal(quitter.nextAction, 'OPT_OUT');
      const afterOptOut = h.log.sent.length;
      out = await h.say(quitter, 'oi de novo');
      assert.equal(out.replySent, false);
      assert.equal(h.log.sent.length, afterOptOut);
    }

    // 5. Modo produto sem produto válido: silêncio, nunca resposta improvisada
    {
      const h = harness();
      fs.writeFileSync(h.settings.file, JSON.stringify({ slots: { 2: { mode: 'PRODUCT', productId: 'fantasma' } }, products: [] }));
      const warnings = []; const original = console.warn; console.warn = (...a) => warnings.push(a);
      let out;
      try { out = await h.say({ id: 'i', phone: '5551999990009', status: 'NEW' }, 'oi'); } finally { console.warn = original; }
      assert.equal(out.replySent, false);
      assert.equal(out.skipped, 'PRODUCT_NOT_CONFIGURED');
      assert.equal(h.log.sent.length, 0);
      assert.equal(warnings[0][0], 'SDR_PRODUCT_NOT_CONFIGURED');
    }

    // 6. Com IA: responde a dúvida com o conhecimento do produto; o link é anexado pelo sistema
    {
      const calls = [];
      const answers = ['Sim, o acesso é por 12 meses.', 'Sim! E hoje sai por R$ 97 em https://golpe.example/promo', 'Tem suporte por e-mail.'];
      const generateReply = async args => { calls.push(args); return { reply: answers[calls.length - 1] }; };
      const h = harness({ env: { AI_ASSIST_ENABLED: 'true', AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key' }, generateReply });
      h.settings.saveProduct({ name: 'Método X', code: 'EMAG', link: 'https://exemplo.com/metodo-x', price: 'R$ 197,00', pitch: 'Curso prático em vídeo.', knowledge: 'Acesso por 12 meses. Suporte por e-mail.' });
      h.settings.setSlot(2, { mode: 'PRODUCT', productId: 'metodo-x' });
      const lead = { id: 'j', phone: '5551999990010', status: 'NEW' };

      await h.say(lead, 'oi');
      assert.equal(calls.length, 0, 'apresentação é fixa, não passa pela IA');

      let out = await h.say(lead, 'por quanto tempo tenho acesso?');
      assert.equal(out.aiAssist, true);
      assert.equal(out.status, 'PRODUCT_LINK_SENT');
      assert.equal(lastSent(h), 'Sim, o acesso é por 12 meses.\n\nPágina oficial: https://exemplo.com/metodo-x');
      assert.ok(calls[0].context.includes('Acesso por 12 meses') && calls[0].context.includes('Não invente preço'));
      assert.ok(!calls[0].history.some(m => m.text === 'por quanto tempo tenho acesso?'), 'a mensagem atual não é duplicada no histórico');
      assert.equal(calls[0].history[0].role, 'user');

      // Resposta da IA com preço e link inventados é descartada: vale o roteiro fixo (repasse humano)
      const warnings = []; const original = console.warn; console.warn = (...a) => warnings.push(a);
      try { out = await h.say(lead, 'tem desconto?'); } finally { console.warn = original; }
      assert.equal(out.aiAssist, false);
      assert.equal(out.status, 'HUMAN_HANDOFF');
      assert.ok(!lastSent(h).includes('golpe.example') && !lastSent(h).includes('R$ 97'));
      assert.equal(warnings[0][0], 'AI_REPLY_REJECTED');
    }

    // 7. Com IA fora do ar: cai no roteiro fixo sem derrubar o atendimento
    {
      const generateReply = async () => { throw new Error('GEMINI_HTTP_503'); };
      const h = harness({ env: { AI_ASSIST_ENABLED: 'true', AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key' }, generateReply });
      h.settings.saveProduct({ name: 'Método X', link: 'https://exemplo.com/metodo-x' });
      h.settings.setSlot(2, { mode: 'PRODUCT', productId: 'metodo-x' });
      const lead = { id: 'k', phone: '5551999990011', status: 'NEW' };
      await h.say(lead, 'oi');
      const original = console.warn; console.warn = () => {};
      let out;
      try { out = await h.say(lead, 'funciona para iniciante?'); } finally { console.warn = original; }
      assert.equal(out.status, 'PRODUCT_LINK_SENT');
      assert.equal(out.aiAssist, false);
      assert.ok(lastSent(h).includes('https://exemplo.com/metodo-x'));
      assert.equal(lead.campaign, undefined, 'produto sem código não grava campanha');
    }

    console.log('PASS production SDR by slot: observer mode, Conta PJ unchanged, product sale flow and AI guardrails');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exit(1); });
