const assert = require('assert');
const { createProductionRepository } = require('./supabase-runtime');
assert.equal(createProductionRepository({}), null);
assert.equal(typeof createProductionRepository({SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-key'}).createLead, 'function');
console.log('PASS Supabase production bootstrap contract');
