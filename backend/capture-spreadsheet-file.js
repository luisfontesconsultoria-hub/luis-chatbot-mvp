const XLSX = require('xlsx');
const { mapSpreadsheetRows } = require('./capture-spreadsheet');

function parseSpreadsheetBuffer(buffer, filename = '') {
  if (!Buffer.isBuffer(buffer)) throw new TypeError('SPREADSHEET_BUFFER_REQUIRED');
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { sheetName: null, rows: [], leads: [] };
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  return { filename, sheetName, rows, leads: mapSpreadsheetRows(rows) };
}

module.exports = { parseSpreadsheetBuffer };
