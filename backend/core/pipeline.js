/** V1 transactional inbound pipeline. Provider-neutral orchestration boundary. */
const { processEvent } = require('./orchestrator');
const { acquireEvent } = require('./idempotency');
const { normalizeDecision, assertTransition } = require('./decision-contract');
const { assertTransition: assertStateTransition } = require('./transition-guard');
const { assertSingleNumberPilot } = require('./pilot-gate');

async function runInbound({ event, repository, channel, ai = null, authorizedHumanRelease = false, pilotPhoneNumberId = null }) {
  if (!event || !event.externalMessageId || !event.phone) throw new Error('invalid_inbound_event');
  if (pilotPhoneNumberId) assertSingleNumberPilot(event, pilotPhoneNumberId);

  const acquired = await acquireEvent({ event, repository });
  if (!acquired.acquired) return { ok: true, duplicate: true, idempotencyKey: acquired.key };

  let lead = await repository.findLeadByPhone(event.phone);
  if (!lead) {
    const created = await repository.upsertLead({ phone: event.phone, source: event.source || 'WHATSAPP', status: 'NEW' });
    lead = created[0] || created;
  }

  await repository.saveMessage({ lead_id: lead.id, channel: event.channel || 'WHATSAPP', direction: 'INBOUND', external_message_id: event.externalMessageId, text_content: event.text || '', metadata: event.metadata || {} });

  const rawDecision = processEvent({ lead, text: event.text || '', externalMessageId: event.externalMessageId, authorizedHumanRelease });
  let decision = normalizeDecision(rawDecision);
  if (decision.status !== 'AGUARDANDO_RETORNO_DO_LUIS' && decision.status !== 'HUMAN_HANDOFF' && ai && decision.reply === null) {
    decision = normalizeDecision(await ai.generate({ lead, text: event.text || '', decision }));
  }

  assertTransition(lead.status || 'NEW', { ...decision, authorizedHumanRelease });
  assertStateTransition(lead.status || 'NEW', decision.status, authorizedHumanRelease);

  await repository.upsertLead({ id: lead.id, phone: lead.phone, status: decision.status, next_action: decision.nextAction, updated_at: new Date().toISOString() });
  await repository.saveAudit({ lead_id: lead.id, action: 'STATE_TRANSITION', from_status: lead.status || 'NEW', to_status: decision.status, actor: authorizedHumanRelease ? 'LUIS' : 'SYSTEM' });

  if (decision.reply) {
    await channel.sendText({ phone: event.phone, text: decision.reply });
    await repository.saveMessage({ lead_id: lead.id, channel: event.channel || 'WHATSAPP', direction: 'OUTBOUND', text_content: decision.reply, metadata: { generated_by: ai && rawDecision.reply === null ? 'AI' : 'SDR' } });
  }
  return { ok: true, duplicate: false, leadId: lead.id, status: decision.status, handoff: decision.handoff, replySent: Boolean(decision.reply) };
}
module.exports = { runInbound };
