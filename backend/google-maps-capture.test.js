const { normalizePhone, normalizeCnpj, normalizePlace, buildCaptureBatch } = require('./google-maps-capture');

test('normalizes Maps phone and CNPJ', () => {
  expect(normalizePhone('+55 (51) 99999-0000')).toBe('5551999990000');
  expect(normalizeCnpj('12.345.678/0001-90')).toBe('12345678000190');
});

test('normalizes a place without touching the CRM persistence layer', () => {
  expect(normalizePlace({ name:'Empresa Exemplo', formatted_address:'Rua A, 10', phone:'(51) 3333-4444', type:'Restaurante' })).toMatchObject({
    name:'Empresa Exemplo', tradeName:'Empresa Exemplo', phone:'5133334444', address:'Rua A, 10', category:'Restaurante', source:'GOOGLE_MAPS'
  });
});

test('builds a clean capture batch and ignores empty records', () => {
  expect(buildCaptureBatch([{ name:'A' }, {}, { cnpj:'12.345.678/0001-90' }])).toHaveLength(2);
});
