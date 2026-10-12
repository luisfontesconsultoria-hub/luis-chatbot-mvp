const assert = require('assert');
delete process.env.AFFILIATE_WEBHOOK_SECRET;
const { routeRequest } = require('./routes');

(async () => {
  let r = await routeRequest({ method: 'POST', path: '/webhooks/affiliate-sale', body: { transaction_id: 'T', status: 'approved' }, headers: {}, query: {} });
  assert.equal(r.status, 503);
  assert.equal(r.body.error, 'AFFILIATE_WEBHOOK_NOT_CONFIGURED');
  process.env.AFFILIATE_WEBHOOK_SECRET = 'segredo-teste';
  r = await routeRequest({ method: 'POST', path: '/webhooks/affiliate-sale', body: {}, headers: {}, query: { token: 'errado' } });
  assert.equal(r.status, 401);
  r = await routeRequest({ method: 'POST', path: '/webhooks/affiliate-sale', body: { transaction_id: 'T', status: 'approved' }, headers: { 'x-affiliate-secret': 'segredo-teste' }, query: {} });
  assert.equal(r.status, 503, 'sem Supabase configurado responde 503, sem quebrar');
  delete process.env.AFFILIATE_WEBHOOK_SECRET;
  console.log('PASS affiliate sale route auth');
})().catch(error => { console.error(error); process.exit(1); });
