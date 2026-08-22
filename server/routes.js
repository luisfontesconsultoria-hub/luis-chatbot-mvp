/** Production route contract. Framework binding is intentionally separate from business logic. */
const { healthResponse } = require('./health');
function routeRequest({ method, path } = {}) {
  if (method === 'GET' && path === '/health') return { status:200, body:healthResponse() };
  if (path === '/webhooks/meta') return { status:501, body:{ error:'META_WEBHOOK_BINDING_PENDING' } };
  if (path.startsWith('/api/crm')) return { status:401, body:{ error:'CRM_AUTH_REQUIRED' } };
  return { status:404, body:{ error:'NOT_FOUND' } };
}
module.exports = { routeRequest };
