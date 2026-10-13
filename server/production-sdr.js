const { processEvent, HUMAN, BLOCKED, SCHEDULE_GATE } = require('../backend/core/orchestrator');
const { createOutboundMessageHandler } = require('./outbound-message');
const { generate } = require('../backend/ai/provider');
const { getConfig } = require('./config');
const { calculateLeadScore } = require('../backend/sdr/scoring');
const { getSdrSettingsStore, DEFAULT_AWAY_MESSAGE } = require('./sdr-settings');
const { resolveProduct, nextProductStep, buildAiContext, sanitizeAiReply, PRODUCT_FLOW_STATES, HUMAN_GATES } = require('../backend/sdr/product-playbook');
const { buildTrackedLink } = require('../backend/affiliate/tracking');

const TIME_ZONE = 'America/Sao_Paulo';
const WEEKDAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Dia da semana (0 = domingo), minutos desde 00:00 e data (AAAA-MM-DD) no fuso de São Paulo. */
function localClock(date = new Date(), timeZone = TIME_ZONE) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).map(p => [p.type, p.value]));
  return { day: WEEKDAY[parts.weekday], minutes: Number(parts.hour) * 60 + Number(parts.minute), date: `${parts.year}-${parts.month}-${parts.day}` };
}

const toMinutes = hhmm => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };

/**
 * true quando o horário de atendimento está aberto.
 * Aceita expediente que atravessa a meia-noite (ex.: 18:00 às 02:00): a madrugada
 * conta como parte do dia em que o expediente começou.
 */
function withinBusinessHours(hours, date = new Date()) {
  if (!hours || !hours.enabled) return true;
  const { day, minutes } = localClock(date);
  const start = toMinutes(hours.start), end = toMinutes(hours.end);
  const days = new Set(hours.days || []);
  if (start < end) return days.has(day) && minutes >= start && minutes < end;
  if (minutes >= start) return days.has(day);
  if (minutes < end) return days.has((day + 6) % 7);
  return false;
}

function awayText(hours) {
  const template = String(hours?.awayMessage || '').trim() || DEFAULT_AWAY_MESSAGE;
  return template.replace(/\{inicio\}/g, hours.start).replace(/\{fim\}/g, hours.end);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Gateway do SDR.
 *
 * `slot` identifica o número de WhatsApp que recebeu a mensagem. Quando informado,
 * o modo do robô vem da configuração daquele número (ver server/sdr-settings.js):
 *   OFF       não responde nem altera o lead (o CRM só registra a conversa);
 *   PRODUCT   roteiro de venda de produto;
 *   CONTA_PJ  roteiro original.
 * Sem `slot` (webhook oficial da Meta, testes antigos) o comportamento original é mantido.
 */
function createProductionSdrGateway({ repository, sender, env = process.env, slot = null, settings = null, generateReply = generate, now = () => new Date(), wait = sleep, random = Math.random } = {}) {
  if (!repository || !sender) throw new Error('PRODUCTION_SDR_DEPENDENCIES_REQUIRED');
  const config = getConfig(env);
  const outbound = createOutboundMessageHandler({ repository, sender });
  const HUMAN_GATED = new Set([HUMAN, BLOCKED, SCHEDULE_GATE]);
  const store = slot === null || slot === undefined ? null : (settings || getSdrSettingsStore(env));

  /**
   * Espera configurada no número antes de responder, com "digitando..." quando o
   * canal suporta. Nunca impede o envio: falha no aviso de digitação é ignorada.
   */
  async function humanPause(slotConfig, lead) {
    const min = Number(slotConfig?.delayMin) || 0;
    const max = Math.max(min, Number(slotConfig?.delayMax) || 0);
    if (max <= 0) return 0;
    const ms = Math.round((min + random() * (max - min)) * 1000);
    if (slotConfig.typing !== false && typeof sender.sendTyping === 'function') {
      try { await sender.sendTyping({ to: lead.phone || null, jid: lead.whatsappJid || lead.whatsapp_jid || null }); }
      catch (error) { console.warn('SDR_TYPING_FAILED', error?.message || 'TYPING_ERROR'); }
    }
    await wait(ms);
    return ms;
  }

  /** Fora do horário: mensagem de ausência (uma vez por dia por lead) ou silêncio. O lead não muda. */
  async function outsideHours({ lead, message, slotConfig }) {
    const status = String(lead.status || '').toUpperCase();
    const base = { status: lead.status || 'NEW', handoff: false, replySent: false, mode: slotConfig.mode, outsideHours: true };
    // Conversa com uma pessoa ou cliente que pediu para sair: o robô não interfere.
    if (HUMAN_GATES.has(status) || status === 'LOST') return base;
    // Lead que chega por anúncio fora do horário: a origem é gravada agora, para o
    // robô saber o produto quando o cliente voltar a escrever sem o código.
    if (slotConfig.mode === 'PRODUCT') {
      const resolved = resolveProduct({ text: message.text || '', lead, products: slotConfig.products, slotProductId: slotConfig.productId });
      if (resolved.product && resolved.via === 'CODE' && String(lead.campaign || '').toUpperCase() !== resolved.ref) {
        await repository.updateLead(lead.id, { interest: resolved.product.name, campaign: resolved.ref, source: resolved.product.source, updatedAt: new Date().toISOString() });
      }
    }
    const key = message.external_message_id || `${lead.id}:${Date.now()}`;
    if (slotConfig.hours.outside === 'SILENT') {
      if (typeof repository.createEvent === 'function') await repository.createEvent({ lead_id: lead.id, type: 'SDR_OUTSIDE_HOURS', idempotency_key: `SDR_OUTSIDE_HOURS:${key}`, payload: { slot, mode: slotConfig.mode } });
      return base;
    }
    const { date } = localClock(now());
    if (typeof repository.listEvents === 'function') {
      try {
        const rows = await repository.listEvents({ leadId: lead.id, type: 'SDR_AWAY_MESSAGE', limit: 5 });
        if ((rows || []).some(row => row?.payload?.date === date)) return base;
      } catch (error) { console.warn('SDR_AWAY_LOOKUP_FAILED', error?.message || 'LOOKUP_ERROR'); return base; }
    }
    await outbound({ lead, text: awayText(slotConfig.hours) });
    if (typeof repository.createEvent === 'function') await repository.createEvent({ lead_id: lead.id, type: 'SDR_AWAY_MESSAGE', idempotency_key: `SDR_AWAY_MESSAGE:${lead.id}:${date}`, payload: { slot, date } });
    return { ...base, replySent: true };
  }

  async function processProduct({ lead, message, slotConfig }) {
    const text = message.text || '';
    const current = String(lead.status || '').toUpperCase();
    const resolved = resolveProduct({ text, lead, products: slotConfig.products, slotProductId: slotConfig.productId });
    if (!resolved.product) {
      console.warn('SDR_PRODUCT_NOT_CONFIGURED', { slot });
      return { status: lead.status || 'NEW', handoff: false, replySent: false, mode: 'PRODUCT', skipped: 'PRODUCT_NOT_CONFIGURED' };
    }
    // O link enviado leva o token do lead quando o produto tem parâmetro de rastreio:
    // é assim que o webhook de venda encontra o lead depois da compra.
    let product = resolved.product;
    try { product = { ...product, link: buildTrackedLink(product, lead.id) }; }
    catch (error) { console.warn('SDR_TRACKING_LINK_FAILED', error?.message || 'TRACKING_ERROR'); }

    let rows = [];
    if (typeof repository.listMessages === 'function') {
      try { rows = await repository.listMessages({ leadId: lead.id, limit: 40 }); }
      catch (error) { console.warn('SDR_HISTORY_FALLBACK', error?.message || 'HISTORY_ERROR'); }
    }
    const botReplies = rows.filter(row => row.direction === 'OUTBOUND').length;
    const history = rows.filter(row => row.external_message_id !== message.external_message_id).slice(0, 12).reverse()
      .map(row => ({ role: row.direction === 'OUTBOUND' ? 'assistant' : 'user', text: row.text_content || '' }));

    // Lead que chega pelo anúncio de um produto recomeça o roteiro nesse produto,
    // a menos que já esteja nele.
    const leadCode = String(lead.campaign || '').toUpperCase().split('-')[0];
    const sameProduct = Boolean(product.code) && leadCode === String(product.code).toUpperCase();
    const restart = resolved.via === 'CODE' && !(sameProduct && PRODUCT_FLOW_STATES.has(current));

    const step = nextProductStep({ lead, text, product, botReplies, restart });
    let final = step;
    let aiAssist = false;

    if (step.aiEligible && config.aiAssistEnabled && product.aiEnabled !== false) {
      try {
        const decision = { status: step.aiStatus, nextAction: 'RESPONDER_DUVIDA_SOBRE_O_PRODUTO', reply: null };
        const generated = await generateReply({ lead, text, decision, history, context: buildAiContext(product) });
        const answer = sanitizeAiReply(generated?.reply, product);
        if (answer) {
          aiAssist = true;
          final = {
            ...step, status: step.aiStatus, nextAction: step.aiNextAction, handoff: false,
            linkSent: Boolean(step.appendLink),
            reply: step.appendLink ? `${answer}\n\nPágina oficial: ${product.link}` : answer
          };
        } else if (generated?.reply) console.warn('AI_REPLY_REJECTED', { slot, productId: product.id });
      } catch (error) { console.warn('AI_ASSIST_FALLBACK', error?.message || 'AI_ERROR'); }
    }

    // Sem resposta e sem mudança de estado (portão humano, lead fora do roteiro): não toca no lead.
    const silent = !final.reply && final.status === current;
    if (!silent) {
      const patch = { status: final.status, nextAction: final.nextAction || null, updatedAt: new Date().toISOString() };
      // Origem do lead gravada no primeiro contato do roteiro (ou na troca de produto).
      if (final.intent === 'START' || restart || !PRODUCT_FLOW_STATES.has(current)) {
        patch.interest = product.name;
        if (resolved.ref || product.code) patch.campaign = resolved.ref || product.code;
        if (resolved.via === 'CODE') patch.source = product.source;
      }
      await repository.updateLead(lead.id, patch);
      await repository.createAudit({
        lead_id: lead.id, action: 'SDR_DECISION', from_status: lead.status || 'NEW', to_status: final.status, actor: 'SDR_AI',
        metadata: { mode: 'PRODUCT', slot, productId: product.id, campaign: resolved.ref || null, intent: final.intent, handoff: Boolean(final.handoff), linkSent: Boolean(final.linkSent), aiAssist }
      });
    }

    const key = message.external_message_id || `${lead.id}:${final.status}:${Date.now()}`;
    if (final.handoff && final.reply && typeof repository.createEvent === 'function') {
      await repository.createEvent({ lead_id: lead.id, type: 'SDR_HUMAN_GATE', idempotency_key: `SDR_HUMAN_GATE:${key}`, payload: { status: final.status, nextAction: final.nextAction || null, handoff: true, mode: 'PRODUCT', productId: product.id, reason: final.intent } });
    }
    if (final.reply) {
      await humanPause(slotConfig, lead);
      await outbound({ lead, text: final.reply });
    }
    if (final.linkSent && typeof repository.createEvent === 'function') {
      await repository.createEvent({ lead_id: lead.id, type: 'PRODUCT_LINK_SENT', idempotency_key: `PRODUCT_LINK_SENT:${key}`, payload: { productId: product.id, campaign: resolved.ref || product.code || null, slot } });
    }

    return { status: final.status, handoff: Boolean(final.handoff), replySent: Boolean(final.reply), aiAssist, mode: 'PRODUCT', productId: product.id, intent: final.intent, linkSent: Boolean(final.linkSent) };
  }

  return {
    async process({ lead, message }) {
      let slotConfig = null;
      if (store) {
        slotConfig = store.slotConfig(slot);
        if (slotConfig.mode === 'OFF') return { status: lead.status || 'NEW', handoff: false, replySent: false, mode: 'OFF' };
        if (slotConfig.hours?.enabled && !withinBusinessHours(slotConfig.hours, now())) return outsideHours({ lead, message, slotConfig });
        if (slotConfig.mode === 'PRODUCT') return processProduct({ lead, message, slotConfig });
      }
      const decision = processEvent({ lead, text: message.text || '', externalMessageId: message.external_message_id });
      let finalDecision = decision;
      const score = calculateLeadScore(lead);
      let history = [];
      if (typeof repository.listMessages === 'function') {
        try {
          const rows = await repository.listMessages({ leadId: lead.id, limit: 12 });
          history = rows.slice().reverse().map(row => ({ role: row.direction === 'OUTBOUND' ? 'assistant' : 'user', text: row.text_content || '' }));
        } catch (error) { console.warn('SDR_HISTORY_FALLBACK', error?.message || 'HISTORY_ERROR'); }
      }
      const context = String(env.CRM_KNOWLEDGE_BASE || '').slice(0, 12000);

      // Human gates are authoritative. The generative model cannot rewrite their wording,
      // status or next action, and cannot resume a gated conversation by itself.
      if (config.aiAssistEnabled && !HUMAN_GATED.has(decision.status) && decision.reply) {
        try {
          const aiDecision = await generate({ lead, text: message.text || '', decision, history, context });
          const candidate = String(aiDecision?.reply || '').trim();
          if (candidate && candidate.length <= 1000) finalDecision = { ...decision, reply: candidate };
        } catch (error) { console.warn('AI_ASSIST_FALLBACK', error?.message || 'AI_ERROR'); }
      }

      await repository.updateLead(lead.id, {
        status: finalDecision.status,
        nextAction: finalDecision.nextAction || null,
        updatedAt: new Date().toISOString()
      });

      await repository.createAudit({
        lead_id: lead.id,
        action: 'SDR_DECISION',
        from_status: lead.status || 'NEW',
        to_status: finalDecision.status,
        actor: 'SDR_AI',
        metadata: {
          handoff: Boolean(finalDecision.handoff),
          tool: finalDecision.tool || null,
          score: score.total,
          temperature: score.temperature,
          readyForSales: score.readyForSales,
          humanGate: HUMAN_GATED.has(finalDecision.status)
        }
      });

      // Persist the two human-pause states as events so they are visible in the CRM history.
      if (HUMAN_GATED.has(finalDecision.status) && typeof repository.createEvent === 'function') {
        const key = message.external_message_id || `${lead.id}:${finalDecision.status}:${Date.now()}`;
        await repository.createEvent({
          lead_id: lead.id,
          type: 'SDR_HUMAN_GATE',
          idempotency_key: `SDR_HUMAN_GATE:${key}`,
          payload: {
            status: finalDecision.status,
            nextAction: finalDecision.nextAction || null,
            handoff: Boolean(finalDecision.handoff)
          }
        });
      }

      if (finalDecision.reply && finalDecision.status !== HUMAN) {
        if (slotConfig) await humanPause(slotConfig, lead);
        await outbound({ lead, text: finalDecision.reply });
      }

      return {
        status: finalDecision.status,
        handoff: Boolean(finalDecision.handoff),
        replySent: Boolean(finalDecision.reply && finalDecision.status !== HUMAN),
        aiAssist: Boolean(config.aiAssistEnabled && finalDecision.reply && finalDecision.reply !== decision.reply),
        score: score.total,
        temperature: score.temperature,
        readyForSales: score.readyForSales
      };
    }
  };
}

module.exports = { createProductionSdrGateway, withinBusinessHours, localClock, awayText };
