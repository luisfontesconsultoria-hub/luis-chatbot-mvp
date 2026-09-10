const { routeRequest } = require('./routes');
(async () => {
  const health = await routeRequest({method:'GET',path:'/health'});
  if (health.status !== 200 || health.body.status !== 'ok') throw Error('HEALTH_ROUTE_FAILED');
  const crm = await routeRequest({method:'GET',path:'/api/crm/leads'});
  if (crm.status !== 401) throw Error('CRM_ROUTE_NOT_PROTECTED');
  const meta = await routeRequest({method:'POST',path:'/webhooks/meta'});
  if (meta.status !== 401 || meta.body.error !== 'META_SIGNATURE_INVALID') throw Error('META_ROUTE_STATE_UNEXPECTED');
  console.log('PASS production route contract');
})().catch(e => { console.error(e); process.exit(1); });
