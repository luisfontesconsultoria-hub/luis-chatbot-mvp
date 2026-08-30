const assert = require('node:assert/strict');
const { runCaptureStation } = require('./google-maps-station');

const result = runCaptureStation([
  { name: 'Empresa Demo', phone: '(51) 99999-0000', city: 'Porto Alegre', category: 'Serviços' },
]);

assert.equal(result.summary.captured, 1);
assert.equal(result.summary.cnpjPending, 1);
assert.equal(result.readyForCrm.length, 0);
console.log('GOOGLE_MAPS_CAPTURE_SMOKE: PASS');
