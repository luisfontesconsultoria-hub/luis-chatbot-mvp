const { processEvent, HUMAN, BLOCKED, SCHEDULE_GATE } = require('../backend/core/orchestrator');
const { createOutboundMessageHandler } = require('./outbound-message');
const { generate } = require('../backend/ai/provider');
const { getConfig } = require('./config');
const { calculateLeadScore } = require('../backend/sdr/scoring');
const { processAffiliateEvent } = require('../backend/affiliate/orchestrator');
const { loadProducts, findProductByCode, productContext } = require('../backend/affiliate/products');

const SDR_MODES = new Set(['PJ', 'AFILIADO']);

/** Modo do SDR: SDR_MODE_SLOT_<n> (por número de WhatsApp) > SDR_MODE > 'PJ'. */
function resolveSdrMode(env = process.env, slot = null) {
  const raw = String((slot ? env[`SDR_MODE_SLOT_${slot}`] : '') || env.SDR_MODE || 'PJ').trim().toUpperCase();
  if (SDR_MODES.has(raw)) return raw;
  console.warn('SDR_MODE_INVALID_FALLBACK_PJ', { slot, value: raw.slice(0, 20) });
  return 'PJ';
}

function safeLoadProducts(env) {
  try { return loadProducts(env); } catch (error) {
    // Ficha inválida nunca derruba o WhatsApp: sem produtos, todo lead vai para o Luís.
    console.error('AFFILIATE_PRODUCTS_INVALID', error?.message || 'INVALID');
    return [];
  }
}

function createProductionSdrGateway({ repository, sender, env = process.env, mode = null } = {}) {
  if (!repository || !sender) throw new Error('PRODUCTION_SDR_DEPENDENCIES_REQUIRED');
  const config = getConfig(env);
  const sdrMode = mode ? resolveSdrMode({ SDR_MODE: mode }) : resolveSdrMode(env);
  const affiliate = sdrMode === 'AFILIADO';
  const products = affiliate ? safeLoadProducts(env) : [];
  const outbound = createOutboundMessageHandler({ repository, sender });
  const HUMAN_GATED = new Set([HUMAN, BLOCKED, SCHEDULE_GATE]);

  return {
    async process({ lead, message }) {
      const decision = affiliate
        ? processAffiliateEvent({ lead, text: message.text || '', externalMessageId: message.external_message_id, products })
        : processEvent({ lead, text: message.text || '', externalMessageId: message.external_message_id });
      let finalDecision = decision;
      const score = calculateLeadScore(lead);
      let history = [];
      if (typeof repository.listMessages === 'function') {
        try {
          const rows = await repository.listMessages({ leadId: lead.id, limit: 12 });
          history = rows.slice().reverse().map(row => ({ role: row.direction === 'OUTBOUND' ? 'assistant' : 'user', text: row.text_content || '' }));
        } catch (error) { console.warn('SDR_HISTORY_FALLBACK', error?.message || 'HISTORY_ERROR'); }
      }
      const context = affiliate
        ? productContext(findProductByCode(products, decision.productCode || lead.productInterest || lead.interest))
        : String(env.CRM_KNOWLEDGE_BASE || '').slice(0, 12000);

      // Human gates are authoritative. The generative model cannot rewrite their wording,
      // status or next action, and cannot resume a gated conversation by itself.
      // lockReply: respostas com fatos da ficha (preço, garantia, link...) nunca são reescritas pela IA.
      if (config.aiAssistEnabled && !HUMAN_GATED.has(decision.status) && decision.reply && !decision.lockReply) {
        try {
          const aiDecision = await generate({ lead, text: message.text || '', decision, history, context });
          const candidate = String(aiDecision?.reply || '').trim();
          if (candidate && candidate.length <= 1000) finalDecision = { ...decision, reply: candidate };
        } catch (error) { console.warn('AI_ASSIST_FALLBACK', error?.message || 'AI_ERROR'); }
      }

      const leadUpdate = {
        status: finalDecision.status,
        nextAction: finalDecision.nextAction || null,
        updatedAt: new Date().toISOString()
      };
      if (affiliate) {
        Object.assign(leadUpdate, finalDecision.leadPatch || {});
        if (finalDecision.stage) leadUpdate.stage = finalDecision.stage;
      }
      await repository.updateLead(lead.id, leadUpdate);

      await repository.createAudit({
        lead_id: lead.id,
        action: 'SDR_DECISION',
        from_status: lead.status || 'NEW',
        to_status: finalDecision.status,
        ...(affiliate && finalDecision.stage && finalDecision.stage !== lead.stage ? { from_stage: lead.stage || null, to_stage: finalDecision.stage } : {}),
        actor: 'SDR_AI',
        metadata: {
          mode: sdrMode,
          productCode: affiliate ? (finalDecision.productCode || null) : undefined,
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

      if (finalDecision.event && typeof repository.createEvent === 'function') {
        await repository.createEvent({
          lead_id: lead.id,
          type: finalDecision.event.type,
          idempotency_key: `${finalDecision.event.type}:${message.external_message_id}`,
          payload: finalDecision.event.payload || {}
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
        readyForSales: score.readyForSales,
        mode: sdrMode
      };
    }
  };
}

module.exports = { createProductionSdrGateway, resolveSdrMode };
