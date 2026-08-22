/**
 * Meta WhatsApp Cloud API adapter.
 * Secrets are read only from server environment variables.
 */
function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_NOT_CONFIGURED`);
  return value;
}

function verifyWebhook({ mode, token, challenge }) {
  if (mode !== 'subscribe') return { ok: false, status: 403 };
  if (token !== env('WHATSAPP_VERIFY_TOKEN')) return { ok: false, status: 403 };
  return { ok: true, status: 200, challenge: String(challenge || '') };
}

async function sendText({ phone, text }) {
  const token = env('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = env('WHATSAPP_PHONE_NUMBER_ID');
  const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: String(text) } })
  });
  if (!response.ok) throw new Error(`WHATSAPP_SEND_HTTP_${response.status}`);
  return response.json();
}

function normalizeWebhook(body = {}) {
  const value = body.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  if (!message) return null;
  return {
    channel: 'WHATSAPP',
    externalMessageId: message.id,
    phone: message.from,
    text: message.text?.body || '',
    timestamp: message.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : new Date().toISOString(),
    metadata: { provider: 'META', phoneNumberId: value?.metadata?.phone_number_id || null }
  };
}

module.exports = { verifyWebhook, sendText, normalizeWebhook };
