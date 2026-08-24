const assert=require('assert');const {jidToPhone,extractInboundPhone}=require('./qr-manager');
assert.strictEqual(jidToPhone('5511999999999@s.whatsapp.net'),'5511999999999');
assert.strictEqual(jidToPhone('123456@lid'),null);
assert.strictEqual(extractInboundPhone({remoteJid:'12345@lid',remoteJidAlt:'5511999999999@s.whatsapp.net'}),'5511999999999');
assert.strictEqual(extractInboundPhone({remoteJid:'5511888888888@s.whatsapp.net'}),'5511888888888');
assert.strictEqual(extractInboundPhone({remoteJid:'12345@lid'}),null);
console.log('qr-manager tests passed');
