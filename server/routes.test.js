const { routeRequest } = require('./routes');
const health = routeRequest({method:'GET',path:'/health'});
if (health.status !== 200 || health.body.status !== 'ok') throw Error('HEALTH_ROUTE_FAILED');
const crm = routeRequest({method:'GET',path:'/api/crm/leads'});
if (crm.status !== 401) throw Error('CRM_ROUTE_NOT_PROTECTED');
const meta = routeRequest({method:'POST',path:'/webhooks/meta'});
if (meta.status !== 501 || meta.body.error !== 'META_WEBHOOK_BINDING_PENDING') throw Error('META_ROUTE_STATE_UNEXPECTED');
console.log('PASS production route contract');
