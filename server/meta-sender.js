const { getConfig } = require('./config');

function createMetaSender(env = process.env) {
  const config = getConfig(env);
  return {
    async sendText({ to, text }) {
      if (!to) throw new Error('WHATSAPP_RECIPIENT_REQUIRED');
      if (!text) throw new Error('WHATSAPP_TEXT_REQUIRED');
      if (!config.metaAccessToken || !config.metaPhoneNumberId) {
        throw new Error('WHATSAPP_NOT_CONFIGURED');
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(
          `https://graph.facebook.com/${config.metaGraphApiVersion}/${config.metaPhoneNumberId}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.metaAccessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: String(to).replace(/\D/g, ''),
              type: 'text',
              text: { body: String(text).slice(0, 4096) }
            }),
            signal: controller.signal
          }
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(`WHATSAPP_SEND_HTTP_${response.status}`);
        return data;
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}

module.exports = { createMetaSender };
