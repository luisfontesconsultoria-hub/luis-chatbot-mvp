/**
 * Spreadsheet/CSV boundary for the capture station.
 * Parsing binary XLSX/CSV is intentionally left to the host/UI layer; this
 * module maps rows into the same capture contract used by Google Maps.
 */

const ALIASES = {
  name: ['nome', 'nome fantasia', 'empresa', 'razao social', 'razão social', 'name', 'company'],
  phone: ['telefone', 'tel', 'celular', 'phone', 'whatsapp'],
  address: ['endereco', 'endereço', 'logradouro', 'address'],
  city: ['cidade', 'municipio', 'município', 'city'],
  state: ['uf', 'estado', 'state'],
  cnpj: ['cnpj'],
  cnae: ['cnae', 'cnae principal'],
  email: ['email', 'e-mail'],
  mapsUrl: ['google maps', 'maps url', 'maps', 'url maps', 'google maps url'],
  category: ['categoria', 'segmento', 'atividade', 'category'],
};

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function findValue(row, aliases) {
  const entries = Object.entries(row || {});
  const match = entries.find(([key]) => aliases.includes(normalizeHeader(key)));
  return match ? match[1] : null;
}

function mapSpreadsheetRow(row = {}) {
  return Object.fromEntries(Object.entries(ALIASES).map(([field, aliases]) => [field, findValue(row, aliases)]));
}

function mapSpreadsheetRows(rows = []) {
  return rows.filter(Boolean).map(mapSpreadsheetRow);
}

module.exports = { normalizeHeader, mapSpreadsheetRow, mapSpreadsheetRows, ALIASES };
