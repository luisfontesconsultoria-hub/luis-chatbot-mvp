const assert=require('assert');const {jidToPhone,extractInboundPhone,slotId,isSessionStale,STALE_SESSION_TIMEOUT_MS,backoffDelay,MAX_AUTO_RECONNECT_ATTEMPTS,nextReconnectAttempt,resetReconnectAttempts}=require('./qr-manager');
assert.strictEqual(slotId(1),1);assert.strictEqual(slotId('4'),4);assert.throws(()=>slotId(0),/INVALID_SLOT/);assert.throws(()=>slotId(5),/INVALID_SLOT/);
assert.strictEqual(jidToPhone('5511999999999@s.whatsapp.net'),'5511999999999');
assert.strictEqual(jidToPhone('123456@lid'),null);
assert.strictEqual(extractInboundPhone({remoteJid:'12345@lid',remoteJidAlt:'5511999999999@s.whatsapp.net'}),'5511999999999');
assert.strictEqual(extractInboundPhone({remoteJid:'5511888888888@s.whatsapp.net'}),'5511888888888');
assert.strictEqual(extractInboundPhone({remoteJid:'12345@lid'}),null);
const now=Date.now();
assert.strictEqual(isSessionStale(null,now),false);
assert.strictEqual(isSessionStale({status:'CONNECTED',startedAt:now-999999},now),false);
assert.strictEqual(isSessionStale({status:'DISCONNECTED',startedAt:now-999999},now),false);
assert.strictEqual(isSessionStale({status:'CONNECTING',startedAt:now-1000},now),false);
assert.strictEqual(isSessionStale({status:'CONNECTING',startedAt:now-(STALE_SESSION_TIMEOUT_MS+1)},now),true);
assert.strictEqual(isSessionStale({status:'QR_READY',startedAt:now-(STALE_SESSION_TIMEOUT_MS+1)},now),true);
assert.strictEqual(isSessionStale({status:'QR_READY',startedAt:now-1},now),false);
assert.strictEqual(backoffDelay(1),5000);
assert.strictEqual(backoffDelay(2),10000);
assert.strictEqual(backoffDelay(3),20000);
assert.strictEqual(backoffDelay(6),60000);
assert.strictEqual(backoffDelay(20),60000);
assert.ok(MAX_AUTO_RECONNECT_ATTEMPTS>=1&&MAX_AUTO_RECONNECT_ATTEMPTS<=10);
// BUG REAL DE PRODUÇÃO (31/08): connect() recria a sessão do zero a cada tentativa, então
// guardar o contador dentro do objeto de sessão sempre voltava pra 0 — o backoff nunca
// crescia (ficava travado em ~5s pra sempre, confirmado nos logs do Render) e nunca
// desistia. Corrigido guardando o contador num Map à parte que sobrevive à recriação
// da sessão. Este teste reproduz exatamente a sequência de "connection.update close"
// que aconteceu em loop real.
const slot='qr-manager-test-slot';
resetReconnectAttempts(slot);
let r=nextReconnectAttempt(slot);
assert.strictEqual(r.attempt,1);assert.strictEqual(r.delay,5000);assert.strictEqual(r.exceeded,false);
r=nextReconnectAttempt(slot);
assert.strictEqual(r.attempt,2,'precisa CRESCER pra 2, não voltar pra 1 como acontecia no bug real');
assert.strictEqual(r.delay,10000);
r=nextReconnectAttempt(slot);assert.strictEqual(r.attempt,3);assert.strictEqual(r.delay,20000);
r=nextReconnectAttempt(slot);assert.strictEqual(r.attempt,4);assert.strictEqual(r.delay,40000);
r=nextReconnectAttempt(slot);assert.strictEqual(r.attempt,5);assert.strictEqual(r.delay,60000);
r=nextReconnectAttempt(slot);assert.strictEqual(r.attempt,6);assert.strictEqual(r.exceeded,false,'na 6ª tentativa ainda não excedeu');
r=nextReconnectAttempt(slot);assert.strictEqual(r.attempt,7);assert.strictEqual(r.exceeded,true,'na 7ª, já passou do limite de 6 — precisa parar de tentar sozinho');
resetReconnectAttempts(slot);
r=nextReconnectAttempt(slot);
assert.strictEqual(r.attempt,1,'depois de um reset (sucesso real: QR emitido ou conexão aberta), volta pro início');
console.log('qr-manager tests passed');
