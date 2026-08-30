const assert = require('node:assert/strict');
const { runGoogleMapsCapture, runSpreadsheetCapture } = require('./capture-station-runner');

const places = [
  { name: 'Empresa A', phone: '(51) 99999-0001', city: 'Porto Alegre', category: 'Comércio', address: 'Rua A, 10' },
  { name: 'Empresa A', phone: '(51) 99999-0001', city: 'Porto Alegre', category: 'Comércio', address: 'Rua A, 10' },
  { name: 'Empresa B', phone: '(51) 99999-0002', city: 'Porto Alegre', category: 'Serviços', address: 'Rua B, 20' },
];

const maps = runGoogleMapsCapture(places, { filters: { minScore: 0 }, eligibility: { excludeMei: true } });
assert.equal(maps.summary.captured, 3);
assert.equal(maps.summary.duplicates, 1);
assert.equal(maps.summary.processed, 2);
assert.equal(maps.summary.cnpjPending, 2);
assert.equal(maps.readyForCrm.length, 0);

const sheet = runSpreadsheetCapture([
  { 'Nome Fantasia': 'Empresa C', Telefone: '(51) 99999-0003', Município: 'Porto Alegre', UF: 'RS' },
  { 'Nome Fantasia': 'Empresa C', Telefone: '(51) 99999-0003', Município: 'Porto Alegre', UF: 'RS' },
], { filters: { minScore: 0 } });
assert.equal(sheet.summary.captured, 2);
assert.equal(sheet.summary.duplicates, 1);
assert.equal(sheet.summary.processed, 1);

console.log('capture-e2e-runner: PASS');
