const { validateCaptureInput, normalizeCaptureEnvelope } = require('./google-maps-capture-contract');

test('accepts a minimum Maps capture record', () => {
  expect(validateCaptureInput({ name: 'Empresa A', phone: '5133334444' })).toMatchObject({ valid: true, errors: [] });
});

test('rejects records without a business name', () => {
  expect(validateCaptureInput({ phone: '5133334444' })).toMatchObject({ valid: false, errors: ['MISSING_NAME'] });
});

test('creates a versioned import envelope', () => {
  expect(normalizeCaptureEnvelope([{ name: 'A' }], { campaign: 'POA-REST-001', importedAt: '2026-08-30T00:00:00.000Z' })).toMatchObject({
    schemaVersion: 'google-maps-capture.v1', source: 'GOOGLE_MAPS', campaign: 'POA-REST-001', records: [{ name: 'A' }],
  });
});
