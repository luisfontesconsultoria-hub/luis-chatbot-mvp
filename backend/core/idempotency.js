/**
 * Idempotency guard for inbound provider events.
 * The database unique constraint is the final authority; this helper keeps
 * duplicate processing out of the orchestration path.
 */
function eventKey(event = {}) {
  const channel = String(event.channel || 'WHATSAPP').toUpperCase();
  const id = String(event.externalMessageId || '').trim();
  if (!id) throw new Error('external_message_id_required');
  return `${channel}:${id}`;
}

async function acquireEvent({ event, repository }) {
  const key = eventKey(event);
  try {
    const rows = await repository.saveEvent({
      type: 'INBOUND_RECEIVED',
      idempotency_key: key,
      payload: { channel: event.channel, external_message_id: event.externalMessageId },
      lead_id: event.leadId || null
    });
    return { acquired: true, key, event: rows && rows[0] ? rows[0] : null };
  } catch (error) {
    if (String(error.message || '').includes('409') || String(error.message || '').includes('23505')) {
      return { acquired: false, key, duplicate: true };
    }
    throw error;
  }
}

module.exports = { eventKey, acquireEvent };
