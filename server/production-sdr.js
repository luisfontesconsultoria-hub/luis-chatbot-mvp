const { processEvent, HUMAN, BLOCKED } = require('../backend/core/orchestrator');
const { createOutboundMessageHandler } = require('./outbound-message');
const { generate } = require('../backend/ai/provider');
const { getConfig } = require('./config');

function createProductionSdrGateway({ repository, sender, env = process.env } = {}) {
  if (!repository || !sender) throw new Error('PRODUCTION_SDR_DEPENDENCIES_REQUIRED');
  const config = getConfig(env);
  const outbound = createOutboundMessageHandler({ repository, sender });

  return {
    async process({ lead, message }) {
      const decision = processEvent({
        lead,
        text: message.text || '',
        externalMessageId: message.external_message_id
      });

      let finalDecision = decision;
      if (config.aiAssistEnabled && decision.status !== HUMAN && decision.status !== BLOCKED && decision.reply) {
        try {
          const aiDecision = await generate({ lead, text: message.text || '', decision });
          const candidate = String(aiDecision?.reply || '').trim();
          if (candidate && candidate.length <= 1000) finalDecision = { ...decision, reply: candidate };
        } catch (error) {
          // AI is an assistive layer only; deterministic SDR response remains the fallback.
          console.warn('AI_ASSIST_FALLBACK', error?.message || 'AI_ERROR');
        }
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
        metadata: { handoff: Boolean(finalDecision.handoff), tool: finalDecision.tool || null }
      });

      if (finalDecision.reply && finalDecision.status !== HUMAN) {
        await outbound({ lead, text: finalDecision.reply });
      }

      return {
        status: finalDecision.status,
        handoff: Boolean(finalDecision.handoff),
        replySent: Boolean(finalDecision.reply && finalDecision.status !== HUMAN),
        aiAssist: Boolean(config.aiAssistEnabled && finalDecision.reply && finalDecision.reply !== decision.reply)
      };
    }
  };
}

module.exports = { createProductionSdrGateway };
