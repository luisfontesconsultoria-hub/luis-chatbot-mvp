const assert = require('assert');
const { normalizePatch } = require('./crm-actions');
const { toDbLead, fromDbLead } = require('./../backend/persistence/crm-mapper');

const patch = normalizePatch({ stage:'negotiation', status:'CONVERTIDO' });
assert.equal(patch.stage, 'NEGOTIATION');
assert.equal(patch.status, undefined);

const db = toDbLead({ status:'QUALIFYING_REVENUE', stage:'OPPORTUNITY' });
assert.equal(db.status, 'QUALIFYING_REVENUE');
assert.equal(db.stage, 'OPPORTUNITY');

const crm = fromDbLead({ status:'HUMAN_HANDOFF', stage:'NEGOTIATION' });
assert.equal(crm.status, 'HUMAN_HANDOFF');
assert.equal(crm.stage, 'NEGOTIATION');

console.log('PASS CRM stage/status separation');
