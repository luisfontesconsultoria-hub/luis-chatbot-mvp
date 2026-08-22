/**
 * V1 transactional pipeline. Provider-neutral orchestration boundary.
 * The caller injects repository and channel adapters.
 */
const { processEvent } = require('./orchestrator');
const { acquireEvent } = require('./idempotency');

async function runInbound({ event, repository, channel, ai = null }) {
  if (!event || !event.externalMessageId || !event.phone) throw new Error('invalid_inbound_event');

  const acquired = await acquireEvent({ event, repository });
  if (!acquired.acquired) return { ok: true, duplicate: true, idempotencyKey: acquired.key };

  let lead = await repository.findLeadByPhone(event.phone);
  if (!lead) {
    const created = await repository.upsertLead({ phone: event.phone, source: event.source || 'WHATSAPP', status: 'NEW' });
    lead = created[0] || created;
  }

  await repository.saveMessage({
    lead_id: lead.id,
    channel: event.channel || 'WHATSAPP',
    direction: 'INBOUND',
    external_message_id: event.externalMessageId,
    text_content: event.text || '',
    metadata: event.metadata || {}
  });

  const decision = processEvent({ lead, text: event.text || '', externalMessageId: event.externalMessageId });
  let finalDecision = decision;

  if (decision.status !== 'AGUARDANDO_RETORNO_DO_LUIS' && ai && decision.reply === null) {
    finalDecision = await ai.generate({ lead, text: event.text || '', decision });
  }

  await repository.upsertLead({ id: lead.id, phone: lead.phone, status: finalDecision.status, next_action: finalDecision.handoff ? 'LUIS' : null });
  await repository.saveAudit({ lead_id: lead.id, action: 'STATE_TRANSITION', from_status: lead.status, to_status: finalDecision.status, actor: 'SYSTEM' });

  if (finalDecision.reply) {
    await channel.sendText({ phone: event.phone, text: finalDecision.reply });
    await repository.saveMessage({ lead_id: lead.id, channel: event.channel || 'WHATSAPP', direction: 'OUTBOUND', text_content: finalDecision.reply, metadata: { generated_by: 'SDR' } });
  }

  return { ok: true, duplicate: false, leadId: lead.id, status: finalDecision.status, handoff: Boolean(finalDecision.handoff), replySent: Boolean(finalDecision.reply) };
}

module.exports = { runInbound };
