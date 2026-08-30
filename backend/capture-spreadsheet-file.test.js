const XLSX = require('xlsx');
const { parseSpreadsheetBuffer } = require('./capture-spreadsheet-file');

const workbook = XLSX.utils.book_new();
const sheet = XLSX.utils.json_to_sheet([
  { 'Nome Fantasia': 'Empresa Teste', 'Telefone': '(51) 99999-1111', 'Município': 'Porto Alegre', 'CNPJ': '12.345.678/0001-90' },
]);
XLSX.utils.book_append_sheet(workbook, sheet, 'Empresas');
const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

const result = parseSpreadsheetBuffer(buffer, 'empresas.xlsx');
if (result.sheetName !== 'Empresas') throw new Error('Unexpected sheet name');
if (result.leads.length !== 1) throw new Error('Expected one mapped lead');
if (result.leads[0].name !== 'Empresa Teste') throw new Error('Name mapping failed');
if (result.leads[0].phone !== '(51) 99999-1111') throw new Error('Phone mapping failed');
if (result.leads[0].city !== 'Porto Alegre') throw new Error('City mapping failed');

console.log('capture-spreadsheet-file: PASS');
