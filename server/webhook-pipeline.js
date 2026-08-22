const { createIdempotencyGuard } = require('./security/idempotency');

function createWebhookPipeline({ repository, idempotency = createIdempotencyGuard(), sdrGateway = null, onMessage = async () => null }) {
  if (!repository) throw new Error('REPOSITORY_REQUIRED');
  return async function process(messages = []) {
    const results = [];
    for (const message of messages) {
      const key = message.external_message_id || `${message.phone}:${message.timestamp}:${message.text}`;
      if (!idempotency.mark(key)) { results.push({ status:'duplicate', key }); continue; }
      const lead = message.phone ? await repository.findOrCreateLeadByPhone(message.phone, { source: message.source }) : null;
      const saved = lead ? await repository.createMessage({
        lead_id: lead.id,
        channel: message.channel || 'WHATSAPP',
        direction: 'INBOUND',
        external_message_id: message.external_message_id || key,
        text_content: message.text || '',
        transcript: message.transcript || null,
        metadata: { type: message.type || 'text', media_url: message.media_url || null, source: message.source || 'WHATSAPP', campaign: message.campaign || null, timestamp: message.timestamp || null }
      }) : null;
      const outcome = sdrGateway ? await sdrGateway.process({ lead, message, saved }) : await onMessage({ message, lead, saved });
      if (lead && typeof repository.createEvent === 'function') {
        await repository.createEvent({ lead_id: lead.id, type:'SDR_PROCESSED', idempotency_key:`sdr:${key}`, payload:{ external_message_id:key, status:outcome?.status || 'UNKNOWN' } });
      }
      results.push({ status:'processed', key, lead, saved, outcome });
    }
    return results;
  };
}
module.exports = { createWebhookPipeline };
