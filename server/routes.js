/** Production route contract. Framework binding is intentionally separate from business logic. */
const { healthResponse } = require('./health');
const crypto = require('crypto');

function verifyMetaWebhook(query = {}) {
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];
  if (mode === 'subscribe' && token && token === process.env.META_VERIFY_TOKEN && challenge) {
    return { status: 200, body: challenge, text: true };
  }
  return { status: 403, body: { error: 'META_WEBHOOK_VERIFICATION_FAILED' } };
}

function normalizeMetaWebhook(payload = {}) {
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  const messages = [];
  for (const entry of entries) {
    for (const change of (entry.changes || [])) {
      const value = change.value || {};
      for (const message of (value.messages || [])) {
        messages.push({
          channel: 'WHATSAPP',
          external_message_id: message.id || null,
          phone: message.from || null,
          timestamp: message.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : new Date().toISOString(),
          type: message.type || 'other',
          text: message.text?.body || '',
          media_url: null,
          source: 'WHATSAPP',
          campaign: null
        });
      }
    }
  }
  return messages;
}

function timingSafeEqualString(a, b) {
  if (!a || !b) return false;
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function routeRequest({ method, path, query = {}, body = {} } = {}) {
  if (method === 'GET' && path === '/health') return { status:200, body:healthResponse() };
  if (method === 'GET' && path === '/webhooks/meta') return verifyMetaWebhook(query);
  if (method === 'POST' && path === '/webhooks/meta') {
    const appSecret = process.env.META_APP_SECRET;
    const signature = body?._meta_signature || null;
    if (appSecret && signature && !timingSafeEqualString(signature, appSecret)) {
      return { status:401, body:{ error:'META_SIGNATURE_INVALID' } };
    }
    return { status:200, body:{ received:true, messages:normalizeMetaWebhook(body) } };
  }
  if (path.startsWith('/api/crm')) return { status:401, body:{ error:'CRM_AUTH_REQUIRED' } };
  return { status:404, body:{ error:'NOT_FOUND' } };
}
module.exports = { routeRequest, normalizeMetaWebhook, verifyMetaWebhook };
