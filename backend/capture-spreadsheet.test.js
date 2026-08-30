const { normalizeHeader, mapSpreadsheetRow, mapSpreadsheetRows } = require('./capture-spreadsheet');

test('normalizes spreadsheet headers', () => {
  expect(normalizeHeader('Razão Social')).toBe('razao social');
});

test('maps common Casa dos Dados-style columns into capture fields', () => {
  expect(mapSpreadsheetRow({
    'Nome Fantasia': 'Empresa Exemplo',
    'Telefone': '(51) 99999-0000',
    'Endereço': 'Rua A, 10',
    'Município': 'Porto Alegre',
    'UF': 'RS',
    'CNPJ': '04.252.011/0001-10',
    'CNAE Principal': '1234-5/67',
    'E-mail': 'contato@empresa.com',
  })).toMatchObject({
    name: 'Empresa Exemplo',
    phone: '(51) 99999-0000',
    address: 'Rua A, 10',
    city: 'Porto Alegre',
    state: 'RS',
    cnpj: '04.252.011/0001-10',
    cnae: '1234-5/67',
    email: 'contato@empresa.com',
  });
});

test('maps multiple rows and ignores empty rows', () => {
  expect(mapSpreadsheetRows([{ Nome: 'A' }, null, { Nome: 'B' }])).toHaveLength(2);
});
