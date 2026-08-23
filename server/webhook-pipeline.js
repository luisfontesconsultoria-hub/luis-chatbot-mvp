const { createIdempotencyGuard } = require('./security/idempotency');

function isDuplicateError(error) {
  const code = error?.code || '';
  const message = String(error?.message || '').toLowerCase();
  return code === '23505' || message.includes('duplicate') || message.includes('unique') || message.includes('idempot');
}

function createWebhookPipeline({ repository, idempotency = createIdempotencyGuard(), sdrGateway = null, onMessage = async () => null }) {
  if (!repository) throw new Error('REPOSITORY_REQUIRED');

  return async function process(messages = []) {
    const results = [];

    for (const message of messages) {
      if (!message?.phone) {
        results.push({ status:'ignored', reason:'PHONE_REQUIRED' });
        continue;
      }

      const key = message.external_message_id || `${message.phone}:${message.timestamp}:${message.text || ''}`;
      // Local cache is only a fast path. The database unique constraint is authoritative.
      if (idempotency.has(key)) {
        results.push({ status:'duplicate', key });
        continue;
      }

      try {
        const lead = await repository.findOrCreateLeadByPhone(message.phone, { source: message.source || 'WHATSAPP' });

        try {
          await repository.createEvent({
            lead_id: lead.id,
            type:'WHATSAPP_INBOUND',
            idempotency_key:key,
            payload:{ external_message_id:key, type:message.type || 'text', timestamp:message.timestamp || null }
          });
          // Only cache after durable acquisition succeeds. Failed processing can be retried.
          idempotency.mark(key);
        } catch (error) {
          if (isDuplicateError(error)) {
            idempotency.mark(key);
            results.push({ status:'duplicate', key, lead_id:lead.id });
            continue;
          }
          throw error;
        }

        let saved = null;
        try {
          saved = await repository.createMessage({
            lead_id: lead.id,
            channel: message.channel || 'WHATSAPP',
            direction: 'INBOUND',
            external_message_id: message.external_message_id || key,
            text_content: message.text || '',
            transcript: message.transcript || null,
            metadata: {
              type: message.type || 'text',
              media_url: message.media_url || null,
              source: message.source || 'WHATSAPP',
              campaign: message.campaign || null,
              timestamp: message.timestamp || null
            }
          });
        } catch (error) {
          if (!isDuplicateError(error)) throw error;
          results.push({ status:'duplicate', key, lead_id:lead.id });
          continue;
        }

        const outcome = sdrGateway
          ? await sdrGateway.process({ lead, message, saved })
          : await onMessage({ message, lead, saved });

        await repository.createEvent({
          lead_id: lead.id,
          type:'SDR_PROCESSED',
          idempotency_key:`sdr:${key}`,
          payload:{ external_message_id:key, status:outcome?.status || 'UNKNOWN' }
        });

        results.push({ status:'processed', key, lead, saved, outcome });
      } catch (error) {
        results.push({ status:'error', key, error: error?.message || 'PROCESSING_ERROR' });
      }
    }

    return results;
  };
}

module.exports = { createWebhookPipeline, isDuplicateError };
