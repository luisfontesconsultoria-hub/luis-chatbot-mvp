/**
 * Stable contract for future capture adapters.
 * Accepts imported/manual/API records without coupling the CRM to a provider.
 */
const REQUIRED = Object.freeze(['name']);
const OPTIONAL = Object.freeze(['phone','cnpj','address','city','state','zipCode','category','mapsUrl','campaign','placeId']);

function validateCaptureInput(record = {}) {
  const errors = [];
  for (const field of REQUIRED) if (!String(record[field] || '').trim()) errors.push(`MISSING_${field.toUpperCase()}`);
  const unknownFields = Object.keys(record).filter(key => !REQUIRED.includes(key) && !OPTIONAL.includes(key));
  return { valid: errors.length === 0, errors, unknownFields };
}

function normalizeCaptureEnvelope(input = {}, metadata = {}) {
  const records = Array.isArray(input) ? input : (Array.isArray(input.records) ? input.records : []);
  return {
    schemaVersion: 'google-maps-capture.v1',
    source: 'GOOGLE_MAPS',
    importedAt: metadata.importedAt || new Date().toISOString(),
    campaign: metadata.campaign || input.campaign || null,
    records,
  };
}

module.exports = { REQUIRED, OPTIONAL, validateCaptureInput, normalizeCaptureEnvelope };
