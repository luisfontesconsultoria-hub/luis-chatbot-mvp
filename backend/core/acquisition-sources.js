/** Canonical acquisition sources for CRM attribution. */
const SOURCES = Object.freeze([
  'GOOGLE_ADS','META_ADS','INSTAGRAM','WEBSITE','LINKEDIN','WHATSAPP','REFERRAL','FIELD_PROSPECTING','DIRECT'
]);
function normalizeSource(value) {
  const source = String(value || '').trim().toUpperCase();
  return SOURCES.includes(source) ? source : 'DIRECT';
}
module.exports = { SOURCES, normalizeSource };
