/**
 * Google Maps capture pipeline - isolated V1.
 *
 * Responsibilities:
 * 1. normalize imported Maps places using the existing capture foundation;
 * 2. qualify records that are usable for the CNPJ stage;
 * 3. deduplicate the batch without touching CRM persistence;
 * 4. expose deterministic keys so a future CRM adapter can compare against
 *    existing leads safely.
 *
 * This module intentionally has no Supabase, WhatsApp or CRM write side effects.
 */

const { normalizePlace, normalizePhone, normalizeCnpj } = require('./google-maps-capture');

function normalizeText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return raw.toLowerCase().replace(/\/$/, '');
  }
}

function isValidCnpj(value) {
  const digits = normalizeCnpj(value);
  if (!digits || digits.length !== 14 || /^([0-9])\1+$/.test(digits)) return false;

  const calculateDigit = (base) => {
    let factor = base.length - 5;
    let sum = 0;
    for (const char of base) {
      sum += Number(char) * factor;
      factor -= 1;
      if (factor < 2) factor = 9;
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const first = calculateDigit(digits.slice(0, 12));
  const second = calculateDigit(digits.slice(0, 12) + first);
  return digits === digits.slice(0, 12) + String(first) + String(second);
}

function buildDedupeKeys(place) {
  const keys = [];
  const cnpj = normalizeCnpj(place.cnpj);
  const phone = normalizePhone(place.phone);
  const mapsUrl = normalizeUrl(place.mapsUrl);
  const name = normalizeText(place.name);
  const address = normalizeText(place.address);

  if (cnpj) keys.push(`cnpj:${cnpj}`);
  if (phone) keys.push(`phone:${phone}`);
  if (mapsUrl) keys.push(`maps:${mapsUrl}`);
  if (name && address) keys.push(`name-address:${name}|${address}`);
  return keys;
}

function qualifyPlace(place) {
  const normalized = normalizePlace(place);
  const reasons = [];

  if (!normalized.name) reasons.push('MISSING_NAME');
  if (!normalized.phone && !normalized.cnpj) reasons.push('MISSING_CONTACT_OR_CNPJ');

  return {
    ...normalized,
    qualification: reasons.length ? 'REVIEW' : 'READY_FOR_CNPJ',
    qualificationReasons: reasons,
    cnpjValid: normalized.cnpj ? isValidCnpj(normalized.cnpj) : null,
    dedupeKeys: buildDedupeKeys(normalized),
  };
}

function deduplicatePlaces(places = [], existing = []) {
  const seen = new Set();
  const existingKeys = new Set(existing.flatMap(buildDedupeKeys));
  const accepted = [];
  const duplicates = [];

  for (const place of places) {
    const keys = buildDedupeKeys(place);
    const repeated = keys.some(key => seen.has(key) || existingKeys.has(key));

    if (repeated) {
      duplicates.push({ ...place, dedupeKeys: keys, duplicate: true });
      continue;
    }

    keys.forEach(key => seen.add(key));
    accepted.push(place);
  }

  return { accepted, duplicates };
}

function processCaptureBatch(places = [], existing = []) {
  const qualified = places.filter(Boolean).map(qualifyPlace);
  const { accepted, duplicates } = deduplicatePlaces(qualified, existing);

  return {
    total: qualified.length,
    acceptedCount: accepted.length,
    duplicateCount: duplicates.length,
    accepted,
    duplicates,
  };
}

module.exports = {
  normalizeText,
  normalizeUrl,
  isValidCnpj,
  buildDedupeKeys,
  qualifyPlace,
  deduplicatePlaces,
  processCaptureBatch,
};
