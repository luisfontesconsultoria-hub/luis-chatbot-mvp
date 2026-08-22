/** Normalize acquisition attribution before it reaches CRM. Never trust arbitrary keys. */
const ALLOWED = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid'];
function normalizeAttribution(input = {}) {
  const out = {};
  for (const key of ALLOWED) {
    if (typeof input[key] === 'string' && input[key].length <= 300) out[key] = input[key];
  }
  return out;
}
function sourceFromAttribution(a = {}) {
  if (a.utm_source) return a.utm_source.toUpperCase();
  if (a.gclid) return 'GOOGLE_ADS';
  if (a.fbclid) return 'META_ADS';
  return 'DIRECT';
}
module.exports = { normalizeAttribution, sourceFromAttribution, ALLOWED };
