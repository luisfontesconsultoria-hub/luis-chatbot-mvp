const { handleMetaGet } = require('./meta-webhook');

process.env.WHATSAPP_VERIFY_TOKEN = 'v1-test';
const accepted = handleMetaGet({ 'hub.mode':'subscribe', 'hub.verify_token':'v1-test', 'hub.challenge':'challenge-1' });
if (!accepted.ok || accepted.challenge !== 'challenge-1') throw Error('GET verification failed');
const rejected = handleMetaGet({ 'hub.mode':'subscribe', 'hub.verify_token':'bad', 'hub.challenge':'challenge-1' });
if (rejected.ok || rejected.status !== 403) throw Error('invalid verification accepted');
console.log('PASS Meta webhook HTTP adapter');
