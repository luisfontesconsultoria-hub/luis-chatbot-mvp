const assert = require('assert');
const { nextStep, validCnpj, BLOCKED, SCHEDULE_GATE } = require('./orchestrator');

const base = { id: 'lead-1' };

assert.equal(nextStep({ ...base, status: 'NEW' }, 'Olá').status, 'IDENTIFYING');
assert.equal(nextStep({ ...base, status: 'CNPJ_PENDING' }, '11.222.333/0001-81').status, BLOCKED);
assert.equal(nextStep({ ...base, status: BLOCKED }, 'Ainda aguardando?').status, BLOCKED);
assert.equal(nextStep({ ...base, status: BLOCKED }, 'Ainda aguardando?').reply, null);
assert.equal(nextStep({ ...base, status: 'SCHEDULING' }, 'terça às 14h').status, SCHEDULE_GATE);
assert.equal(nextStep({ ...base, status: SCHEDULE_GATE }, 'Pode confirmar?').status, SCHEDULE_GATE);
assert.equal(nextStep({ ...base, status: SCHEDULE_GATE }, 'Pode confirmar?').reply, null);
assert.equal(validCnpj('11.222.333/0001-81'), true);
assert.equal(validCnpj('11.111.111/1111-11'), false);

console.log('orchestrator tests passed');
