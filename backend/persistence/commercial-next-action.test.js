const assert=require('assert');const{buildNextAction}=require('./commercial-next-action');
assert.equal(buildNextAction({status:'MEETING_MODE'}).action,'REALIZAR_ATENDIMENTO');
assert.equal(buildNextAction({status:'SCHEDULING'}).action,'AGUARDAR_CONFIRMACAO');
assert.equal(buildNextAction({status:'AGUARDANDO_RETORNO'}).action,'FAZER_FOLLOW_UP');
assert.equal(buildNextAction({status:'CONVERTIDO'}).action,'REGISTRAR_CONVERSAO');
assert.equal(buildNextAction({status:'PERDIDO'}).action,'ENCERRAR_OPORTUNIDADE');
assert.equal(buildNextAction({status:'QUALIFIED',interest:true}).action,'PRIORIZAR_CONTATO');
assert.equal(buildNextAction({status:'NEW'}).action,'CONTINUAR_QUALIFICACAO');
console.log('commercial-next-action.test.js: ok');
