const assert=require('assert');
const fs=require('fs');const os=require('os');const path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'wa-sess-'));
process.env.WHATSAPP_QR_SESSION_DIR=tmp;
const qr=require('./qr-manager');
assert.strictEqual(qr.BASE_DIR,tmp);
// credsAreRegistered: só considera pareado quem tem identidade (me.id) ou registered=true
assert.strictEqual(qr.credsAreRegistered(null),false);
assert.strictEqual(qr.credsAreRegistered({}),false);
assert.strictEqual(qr.credsAreRegistered({registered:false}),false);
assert.strictEqual(qr.credsAreRegistered({me:{id:'5551999999999:1@s.whatsapp.net'}}),true);
assert.strictEqual(qr.credsAreRegistered({registered:true}),true);
// hasSavedSession: lê creds.json do slot no disco
assert.strictEqual(qr.hasSavedSession(1),false,'sem pasta = sem sessão');
fs.mkdirSync(path.join(tmp,'slot-1'),{recursive:true});
fs.writeFileSync(path.join(tmp,'slot-1','creds.json'),JSON.stringify({noiseKey:{}}));
assert.strictEqual(qr.hasSavedSession(1),false,'creds sem pareamento não conta');
fs.writeFileSync(path.join(tmp,'slot-1','creds.json'),JSON.stringify({me:{id:'5551999999999:1@s.whatsapp.net'}}));
assert.strictEqual(qr.hasSavedSession(1),true,'creds pareadas no disco = sessão restaurável');
fs.writeFileSync(path.join(tmp,'slot-1','creds.json'),'{corrompido');
assert.strictEqual(qr.hasSavedSession(1),false,'json corrompido não derruba, só não restaura');
// nextQrRound: para de gerar QR sozinho após MAX_QR_ROUNDS rodadas sem leitura
assert.ok(qr.MAX_QR_ROUNDS>=2&&qr.MAX_QR_ROUNDS<=5);
qr.resetQrRounds(9);
let r;for(let i=1;i<qr.MAX_QR_ROUNDS;i++){r=qr.nextQrRound(9);assert.strictEqual(r.round,i);assert.strictEqual(r.exceeded,false)}
r=qr.nextQrRound(9);assert.strictEqual(r.exceeded,true,'última rodada precisa encerrar o loop');
qr.resetQrRounds(9);assert.strictEqual(qr.nextQrRound(9).round,1);
(async()=>{
  // restoreSavedSessions: sem repository ou com flag desligada não faz nada
  assert.deepStrictEqual(await qr.restoreSavedSessions({repository:null}),[]);
  assert.deepStrictEqual(await qr.restoreSavedSessions({repository:{},env:{WHATSAPP_AUTO_RESTORE:'false'}}),[]);
  // sem sessão salva em nenhum slot: não tenta conectar
  fs.rmSync(path.join(tmp,'slot-1'),{recursive:true,force:true});
  assert.deepStrictEqual(await qr.restoreSavedSessions({repository:{},env:{}}),[]);
  fs.rmSync(tmp,{recursive:true,force:true});
  console.log('qr-session-persistence tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
