const {
  normalizeUrl,
  isValidCnpj,
  buildDedupeKeys,
  qualifyPlace,
  deduplicatePlaces,
  processCaptureBatch,
} = require('./google-maps-pipeline');

test('normalizes Maps URLs deterministically', () => {
  expect(normalizeUrl('HTTPS://Google.com/maps/place/Test/?utm_source=x#section'))
    .toBe('https://google.com/maps/place/test');
});

test('validates CNPJ check digits', () => {
  expect(isValidCnpj('04.252.011/0001-10')).toBe(true);
  expect(isValidCnpj('04.252.011/0001-11')).toBe(false);
  expect(isValidCnpj('11.111.111/1111-11')).toBe(false);
});

test('qualifies a usable Maps record for the CNPJ stage', () => {
  expect(qualifyPlace({ name: 'Empresa Exemplo', phone: '(51) 3333-4444', type: 'Restaurante' }))
    .toMatchObject({
      name: 'Empresa Exemplo',
      phone: '5133334444',
      source: 'GOOGLE_MAPS',
      qualification: 'READY_FOR_CNPJ',
      qualificationReasons: [],
    });
});

test('marks incomplete records for review instead of dropping them silently', () => {
  expect(qualifyPlace({ address: 'Rua A, 10' })).toMatchObject({
    qualification: 'REVIEW',
    qualificationReasons: ['MISSING_NAME', 'MISSING_CONTACT_OR_CNPJ'],
  });
});

test('deduplicates by CNPJ, phone, Maps URL and name+address', () => {
  const first = qualifyPlace({ name: 'A', phone: '(51) 99999-0000', address: 'Rua A, 10' });
  const second = qualifyPlace({ name: 'A', phone: '(51) 99999-0000', address: 'Rua A, 10' });
  const result = deduplicatePlaces([first, second]);

  expect(result.accepted).toHaveLength(1);
  expect(result.duplicates).toHaveLength(1);
  expect(buildDedupeKeys(first)).toContain('phone:51999990000');
});

test('can compare a capture batch against existing CRM candidates without writing to CRM', () => {
  const result = processCaptureBatch(
    [
      { name: 'Novo', phone: '(51) 3333-4444' },
      { name: 'Existente', phone: '(51) 99999-0000' },
    ],
    [{ name: 'Existente', phone: '51999990000' }],
  );

  expect(result.total).toBe(2);
  expect(result.acceptedCount).toBe(1);
  expect(result.duplicateCount).toBe(1);
  expect(result.accepted[0].name).toBe('Novo');
});
