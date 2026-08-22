/**
 * Provider-neutral WhatsApp adapter contract.
 * Provider-specific signature verification and API calls are injected.
 */
function normalizeWebhook(payload = {}) {
  const message = payload.message || payload.messages?.[0] || payload;
  return {
    channel: 'WHATSAPP',
    externalMessageId: String(message.id || message.message_id || payload.id || ''),
    phone: String(message.from || message.phone || payload.from || ''),
    text: String(message.text?.body || message.body || message.text || ''),
    timestamp: message.timestamp || payload.timestamp || new Date().toISOString(),
    metadata: payload
  };
}

async function sendText({ phone, text, provider }) {
  if (!phone || !text) throw new Error('whatsapp_send_arguments_required');
  if (!provider || typeof provider.sendText !== 'function') throw new Error('whatsapp_provider_not_configured');
  return provider.sendText({ phone, text });
}

module.exports = { normalizeWebhook, sendText };
