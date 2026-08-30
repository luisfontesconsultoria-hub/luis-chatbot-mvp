/**
 * Google Maps capture - isolated V1 foundation.
 * This module intentionally does not alter the existing WhatsApp/SDR pipeline.
 * It normalizes manually/imported Maps results into the CRM lead shape.
 */

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits || null;
}

function normalizeCnpj(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits || null;
}

function normalizePlace(place = {}) {
  const name = String(place.name || place.business_name || '').trim() || null;
  const phone = normalizePhone(place.phone || place.international_phone_number || place.national_phone_number);
  const cnpj = normalizeCnpj(place.cnpj);
  return {
    name,
    tradeName: name,
    phone,
    cnpj,
    address: String(place.address || place.formatted_address || '').trim() || null,
    city: String(place.city || '').trim() || null,
    state: String(place.state || '').trim().toUpperCase().slice(0, 2) || null,
    zipCode: String(place.zipCode || place.postal_code || '').trim() || null,
    source: 'GOOGLE_MAPS',
    campaign: String(place.campaign || '').trim() || null,
    category: String(place.category || place.type || '').trim() || null,
    mapsUrl: String(place.mapsUrl || place.google_maps_url || place.url || '').trim() || null,
  };
}

function buildCaptureBatch(places = []) {
  return places
    .filter(Boolean)
    .map(normalizePlace)
    .filter(place => place.name || place.phone || place.cnpj);
}

module.exports = { normalizePhone, normalizeCnpj, normalizePlace, buildCaptureBatch };
