const assert = require('assert');
const { verifyMetaWebhook, normalizeMetaWebhook } = require('./routes');

process.env.META_VERIFY_TOKEN='test-token';
const ok=verifyMetaWebhook({'hub.mode':'subscribe','hub.verify_token':'test-token','hub.challenge':'abc'});
assert.equal(ok.status,200); assert.equal(ok.body,'abc');
const bad=verifyMetaWebhook({'hub.mode':'subscribe','hub.verify_token':'wrong','hub.challenge':'abc'});
assert.equal(bad.status,403);
const messages=normalizeMetaWebhook({entry:[{changes:[{value:{messages:[{id:'m1',from:'5511999999999',timestamp:'1787400000',type:'text',text:{body:'Olá'}}]}}]}]});
assert.equal(messages.length,1); assert.equal(messages[0].external_message_id,'m1'); assert.equal(messages[0].text,'Olá');
console.log('PASS Meta webhook contract');
