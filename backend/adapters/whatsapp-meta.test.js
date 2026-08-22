const { normalizeWebhook, verifyWebhook } = require('./whatsapp-meta');

const body = { entry:[{ changes:[{ value:{ metadata:{phone_number_id:'123'}, messages:[{ id:'wamid-1', from:'5551999999999', timestamp:'1724328000', text:{body:'Olá'} }] } }]}] };
const event = normalizeWebhook(body);
if (!event || event.externalMessageId !== 'wamid-1' || event.phone !== '5551999999999' || event.text !== 'Olá') throw Error('Meta webhook normalization failed');

process.env.WHATSAPP_VERIFY_TOKEN = 'test-token';
const ok = verifyWebhook({ mode:'subscribe', token:'test-token', challenge:'abc' });
if (!ok.ok || ok.challenge !== 'abc') throw Error('Meta webhook verification failed');
const denied = verifyWebhook({ mode:'subscribe', token:'wrong', challenge:'abc' });
if (denied.ok || denied.status !== 403) throw Error('invalid verification token accepted');

console.log('PASS Meta WhatsApp adapter');
