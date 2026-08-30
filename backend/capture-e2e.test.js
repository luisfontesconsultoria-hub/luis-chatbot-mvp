const { runCaptureStation } = require('./google-maps-station');

const places = [
  { name: 'Empresa A', phone: '(51) 99999-0001', city: 'Porto Alegre', category: 'Comércio', address: 'Rua A, 10' },
  { name: 'Empresa A', phone: '(51) 99999-0001', city: 'Porto Alegre', category: 'Comércio', address: 'Rua A, 10' },
  { name: 'Empresa B', phone: '(51) 99999-0002', city: 'Porto Alegre', category: 'Serviços', address: 'Rua B, 20' },
];

const result = runCaptureStation(places, {
  existing: [],
  filters: { minScore: 0 },
  eligibility: { excludeMei: true },
});

if (result.summary.captured !== 3) throw new Error(`Expected 3 captured, got ${result.summary.captured}`);
if (result.summary.duplicates !== 1) throw new Error(`Expected 1 duplicate, got ${result.summary.duplicates}`);
if (result.summary.processed !== 2) throw new Error(`Expected 2 processed, got ${result.summary.processed}`);
if (result.summary.cnpjPending !== 2) throw new Error(`Expected 2 CNPJ-pending leads, got ${result.summary.cnpjPending}`);
if (result.readyForCrm.length !== 0) throw new Error('CNPJ-pending leads must not be exported as CRM-ready');

console.log('capture-e2e: PASS');
