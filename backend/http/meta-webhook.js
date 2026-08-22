const { verifyWebhook, normalizeWebhook } = require('../adapters/whatsapp-meta');
const { runInbound } = require('../core/pipeline');

function handleMetaGet(query) {
  return verifyWebhook({ mode: query['hub.mode'], token: query['hub.verify_token'], challenge: query['hub.challenge'] });
}

async function handleMetaPost({ body, repository, channel, ai }) {
  const event = normalizeWebhook(body);
  // Meta may deliver status/unsupported events without a customer message.
  if (!event) return { ok: true, ignored: true };
  return runInbound({ event, repository, channel, ai });
}

module.exports = { handleMetaGet, handleMetaPost };
