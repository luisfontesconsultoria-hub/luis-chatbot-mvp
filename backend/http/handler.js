/**
 * Framework-neutral HTTP adapter for the V1 orchestrator.
 * The hosting platform supplies req/res (or an equivalent adapter).
 * Secrets and provider SDKs stay outside this module.
 */

const { processEvent } = require('../core/orchestrator');

function normalizeIncoming(payload = {}) {
  return {
    channel: 'WHATSAPP',
    externalMessageId: String(payload.external_message_id || payload.id || ''),
    phone: String(payload.phone || payload.from || ''),
    text: String(payload.text || payload.body || ''),
    timestamp: payload.timestamp || new Date().toISOString(),
    metadata: payload.metadata || {}
  };
}

function validateEvent(event) {
  if (!event.externalMessageId) return 'external_message_id_required';
  if (!event.phone) return 'phone_required';
  if (!event.text) return 'text_required';
  return null;
}

async function handleWebhook({ payload, findLead, saveInbound, saveDecision, sendReply }) {
  const event = normalizeIncoming(payload);
  const validationError = validateEvent(event);
  if (validationError) return { ok: false, status: 400, error: validationError };

  const lead = await findLead(event.phone);
  const decision = processEvent({ lead: lead || { status: 'NEW' }, text: event.text, externalMessageId: event.externalMessageId });

  // Persistence and delivery are injected so this module remains provider-neutral.
  await saveInbound({ event, lead });
  await saveDecision({ event, lead, decision });

  if (decision.reply) await sendReply({ phone: event.phone, text: decision.reply });

  return {
    ok: true,
    status: 200,
    leadId: lead && lead.id ? lead.id : null,
    nextStatus: decision.status,
    handoff: Boolean(decision.handoff)
  };
}

module.exports = { normalizeIncoming, validateEvent, handleWebhook };
