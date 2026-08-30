const { STAGES, createCaptureBatch, runQualification, applyCnpjResults, finalizeForCrm } = require('./google-maps-batch');

test('creates a deterministic capture batch without persistence', () => {
  const batch = createCaptureBatch([{ name: 'Empresa A', phone: '(51) 3333-4444' }], { batchId: 'GM-TEST-001', capturedAt: '2026-08-30T00:00:00.000Z' });
  expect(batch).toMatchObject({ batchId: 'GM-TEST-001', source: 'GOOGLE_MAPS' });
  expect(batch.records[0]).toMatchObject({ recordId: 'GM-TEST-001-0001', stage: STAGES.CAPTURED });
});

test('moves a qualified record to CNPJ pending', () => {
  const batch = createCaptureBatch([{ name: 'Empresa A', phone: '(51) 3333-4444' }], { batchId: 'GM-TEST-002' });
  const result = runQualification(batch);
  expect(result.records[0].stage).toBe(STAGES.CNPJ_PENDING);
});

test('applies a CNPJ response and produces an eligible record', () => {
  const batch = runQualification(createCaptureBatch([{ name: 'Empresa A', phone: '(51) 3333-4444' }], { batchId: 'GM-TEST-003' }));
  const prepared = { ...batch, records: [{ ...batch.records[0], cnpj: '04252011000110' }] };
  const enriched = applyCnpjResults(prepared, {
    '04252011000110': { ni: '04252011000110', nomeEmpresarial: 'EMPRESA A LTDA', situacaoCadastral: { codigo: '2', motivo: 'ATIVA' } },
  });
  expect(enriched.records[0].stage).toBe(STAGES.ELIGIBLE);
});

test('finalizes only eligible records as READY_FOR_CRM', () => {
  const batch = {
    batchId: 'GM-TEST-004',
    records: [
      { stage: STAGES.ELIGIBLE, companyName: 'Empresa A', cnpj: '04252011000110', phone: '5133334444' },
      { stage: STAGES.REJECTED, companyName: 'Empresa B' },
    ],
  };
  const result = finalizeForCrm(batch);
  expect(result.readyForCrm).toHaveLength(1);
  expect(result.records[0].stage).toBe(STAGES.READY_FOR_CRM);
  expect(result.records[1].stage).toBe(STAGES.REJECTED);
});
