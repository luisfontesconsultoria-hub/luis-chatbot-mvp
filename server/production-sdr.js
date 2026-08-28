const { processEvent, HUMAN, BLOCKED, SCHEDULE_GATE } = require('../backend/core/orchestrator');
const { createOutboundMessageHandler } = require('./outbound-message');
const { generate } = require('../backend/ai/provider');
const { getConfig } = require('./config');
const { calculateLeadScore } = require('../backend/sdr/scoring');

function createProductionSdrGateway({ repository, sender, env = process.env } = {}) {
  if (!repository || !sender) throw new Error('PRODUCTION_SDR_DEPENDENCIES_REQUIRED');
  const config = getConfig(env);
  const outbound = createOutboundMessageHandler({ repository, sender });
  const HUMAN_GATED = new Set([HUMAN, BLOCKED, SCHEDULE_GATE]);

  return {
    async process({ lead, message }) {
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
