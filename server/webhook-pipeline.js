const { createIdempotencyGuard } = require('./security/idempotency');

function createWebhookPipeline({ repository, idempotency = createIdempotencyGuard(), onMessage = async () => null }) {
  if (!repository) throw new Error('REPOSITORY_REQUIRED');
  return async function process(messages = []) {
    const results = [];
    for (const message of messages) {
      const key = message.external_message_id || `${message.phone}:${message.timestamp}:${message.text}`;
      if (!idempotency.mark(key)) { results.push({ status:'duplicate', key }); continue; }
      const lead = message.phone ? await repository.findOrCreateLeadByPhone(message.phone, { source: message.source }) : null;
      const saved = lead ? await repository.createMessage({ lead_id: lead.id, ...message }) : null;
      const outcome = await onMessage({ message, lead, saved });
      results.push({ status:'processed', key, lead, saved, outcome });
    }
    return results;
  };
}
module.exports = { createWebhookPipeline };
