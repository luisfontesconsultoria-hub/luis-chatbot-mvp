/** Minimal production health response. Never expose secrets or dependency credentials. */
function healthResponse({ version = 'v1', now = new Date().toISOString() } = {}) {
  return { status: 'ok', service: 'luis-chatbot-mvp', version, timestamp: now };
}
module.exports = { healthResponse };
