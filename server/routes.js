/** Production route contract. */
const { healthResponse } = require('./health');
const { verifyMetaSignature } = require('./security/meta-signature');
const { createProductionRuntime } = require('./runtime');

const runtime = createProductionRuntime();

function verifyMetaWebhook(query = {}) {
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];
  if (mode === 'subscribe' && token && token === process.env.META_VERIFY_TOKEN && challenge) return { status:200, body:challenge, text:true };
  return { status:403, body:{ error:'META_WEBHOOK_VERIFICATION_FAILED' } };
}
function normalizeMetaWebhook(payload = {}) {
  const messages=[];
  for (const entry of (Array.isArray(payload.entry) ? payload.entry : [])) for (const change of (entry.changes || [])) for (const message of ((change.value || {}).messages || [])) {
    messages.push({ channel:'WHATSAPP', external_message_id:message.id || null, phone:message.from || null, timestamp:message.timestamp ? new Date(Number(message.timestamp)*1000).toISOString() : new Date().toISOString(), type:message.type || 'other', text:message.text?.body || '', media_url:null, source:'WHATSAPP', campaign:null });
  }
  return messages;
}
function routeRequest({ method, path, query={}, body={}, rawBody='', signatureHeader='' } = {}) {
  if (method==='GET' && path==='/health') return { status:200, body:healthResponse() };
  if (method==='GET' && path==='/webhooks/meta') return verifyMetaWebhook(query);
  if (method==='POST' && path==='/webhooks/meta') {
    const secret=process.env.META_APP_SECRET;
    if (!secret || !verifyMetaSignature(rawBody, signatureHeader, secret)) return { status:401, body:{ error:'META_SIGNATURE_INVALID' } };
    if (!runtime.pipeline) return { status:503, body:{ error:'PERSISTENCE_NOT_CONFIGURED' } };
    return { status:200, body:{ received:true, messages:normalizeMetaWebhook(body) } };
  }
  if (path.startsWith('/api/crm')) return { status:401, body:{ error:'CRM_AUTH_REQUIRED' } };
  return { status:404, body:{ error:'NOT_FOUND' } };
}
module.exports={ routeRequest, normalizeMetaWebhook, verifyMetaWebhook };
