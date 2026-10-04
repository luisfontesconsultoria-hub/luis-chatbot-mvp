const { processEvent, HUMAN, BLOCKED, SCHEDULE_GATE } = require('../backend/core/orchestrator');
const { createOutboundMessageHandler } = require('./outbound-message');
const { generate } = require('../backend/ai/provider');
const { getConfig } = require('./config');
const { calculateLeadScore } = require('../backend/sdr/scoring');
const { getSdrSettingsStore } = require('./sdr-settings');
const { resolveProduct, nextProductStep, buildAiContext, sanitizeAiReply, PRODUCT_FLOW_STATES } = require('../backend/sdr/product-playbook');

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
function createProductionSdrGateway({ repository, sender, env = process.env, slot = null, settings = null, generateReply = generate } = {}) {
  if (!repository || !sender) throw new Error('PRODUCTION_SDR_DEPENDENCIES_REQUIRED');
  const config = getConfig(env);
  const outbound = createOutboundMessageHandler({ repository, sender });
  const HUMAN_GATED = new Set([HUMAN, BLOCKED, SCHEDULE_GATE]);
  const store = slot === null || slot === undefined ? null : (settings || getSdrSettingsStore(env));

  async function processProduct({ lead, message, slotConfig }) {
    const text = message.text || '';
    const current = String(lead.status || '').toUpperCase();
    const resolved = resolveProduct({ text, lead, products: slotConfig.products, slotProductId: slotConfig.productId });
    if (!resolved.product) {
      console.warn('SDR_PRODUCT_NOT_CONFIGURED', { slot });
      return { status: lead.status || 'NEW', handoff: false, replySent: false, mode: 'PRODUCT', skipped: 'PRODUCT_NOT_CONFIGURED' };
    }
    const product = resolved.product;

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

    if (step.aiEligible && config.aiAssistEnabled) {
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
    if (final.reply) await outbound({ lead, text: final.reply });
    if (final.linkSent && typeof repository.createEvent === 'function') {
      await repository.createEvent({ lead_id: lead.id, type: 'PRODUCT_LINK_SENT', idempotency_key: `PRODUCT_LINK_SENT:${key}`, payload: { productId: product.id, campaign: resolved.ref || product.code || null, slot } });
    }

    return { status: final.status, handoff: Boolean(final.handoff), replySent: Boolean(final.reply), aiAssist, mode: 'PRODUCT', productId: product.id, intent: final.intent, linkSent: Boolean(final.linkSent) };
  }

  return {
    async process({ lead, message }) {
      if (store) {
        const slotConfig = store.slotConfig(slot);
        if (slotConfig.mode === 'OFF') return { status: lead.status || 'NEW', handoff: false, replySent: false, mode: 'OFF' };
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

      if (finalDecision.reply && finalDecision.status !== HUMAN) await outbound({ lead, text: finalDecision.reply });

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

module.exports = { createProductionSdrGateway };
