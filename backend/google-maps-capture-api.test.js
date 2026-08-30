const { handleCaptureRequest } = require('./google-maps-capture-api');

test('rejects malformed capture requests', () => {
  expect(handleCaptureRequest({}).statusCode).toBe(400);
});

test('processes a capture batch without CRM persistence', () => {
  const response = handleCaptureRequest({
    places: [{ name: 'Empresa', phone: '(51) 3333-4444' }],
  }, { CAPTURE_MIN_SCORE: '0', CAPTURE_EXCLUDE_MEI: 'true' });

  expect(response.statusCode).toBe(200);
  expect(response.body.summary.captured).toBe(1);
  expect(Array.isArray(response.body.leads)).toBe(true);
  expect(response.body.readyForCrm).toBeDefined();
});
