const { processEvent } = require('./orchestrator');
const { eventKey } = require('./idempotency');

function assert(condition, message) { if (!condition) throw new Error(message); }

const cases = [
  { name: 'requires external id', fn: () => { let ok=false; try { processEvent({ lead:{status:'NEW'}, text:'oi' }); } catch(e) { ok=e.message==='external_message_id_required'; } assert(ok,'missing id must fail'); } },
  { name: 'blocked state stays blocked', fn: () => { const r=processEvent({lead:{status:'AGUARDANDO_RETORNO_DO_LUIS'},text:'oi',externalMessageId:'1'}); assert(r.status==='AGUARDANDO_RETORNO_DO_LUIS'&&r.handoff,'blocked state released'); } },
  { name: 'invalid cnpj does not call tool', fn: () => { const r=processEvent({lead:{status:'CNPJ_PENDING'},text:'123',externalMessageId:'2'}); assert(r.status==='CNPJ_PENDING'&&!r.tool,'invalid CNPJ advanced'); } },
  { name: 'valid cnpj blocks for human', fn: () => { const r=processEvent({lead:{status:'CNPJ_PENDING'},text:'11.444.777/0001-61',externalMessageId:'3'}); assert(r.status==='AGUARDANDO_RETORNO_DO_LUIS'&&r.tool,'valid CNPJ did not block'); } },
  { name: 'credit is not approval', fn: () => { const r=processEvent({lead:{status:'QUALIFYING'},text:'quero crédito',externalMessageId:'4'}); assert(/análise|aprov/i.test(r.reply)&&r.status==='CNPJ_PENDING','credit rule failed'); } },
  { name: 'idempotency key stable', fn: () => assert(eventKey({channel:'WHATSAPP',externalMessageId:'abc'})==='WHATSAPP:abc','key mismatch') }
];

for (const test of cases) { test.fn(); console.log(`PASS ${test.name}`); }
console.log(`PASS ${cases.length} regression checks`);
