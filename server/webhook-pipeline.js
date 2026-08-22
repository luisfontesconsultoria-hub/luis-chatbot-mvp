const { createIdempotencyGuard } = require('./security/idempotency');

function createWebhookPipeline({ repository, idempotency = createIdempotencyGuard(), sdrGateway = null, onMessage = async () => null }) {
  if (!repository) throw new Error('REPOSITORY_REQUIRED');
  return async function process(messages = []) {
    const results = [];
    for (const message of messages) {
      const key = message.external_message_id || `${message.phone}:${message.timestamp}:${message.text}`;
      if (!idempotency.mark(key)) { results.push({ status:'duplicate', key }); continue; }
      const lead = message.phone ? await repository.findOrCreateLeadByPhone(message.phone, { source: message.source }) : null;
      const saved = lead ? await repository.createMessage({ lead_id: lead.id, ...message }) : null;
      const outcome = sdrGateway ? await sdrGateway.process({ lead, message }) : await onMessage({ message, lead, saved });
      if (lead && typeof repository.createEvent === 'function') {
        await repository.createEvent({ lead_id: lead.id, event_type:'SDR_PROCESSED', metadata:{ external_message_id:key, status:outcome?.status || 'UNKNOWN' } });
      }
      results.push({ status:'processed', key, lead, saved, outcome });
    }
    return results;
  };
}
module.exports = { createWebhookPipeline };
