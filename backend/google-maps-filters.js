/** Configurable ICP filters. Defaults are intentionally permissive. */
function matchesFilters(lead = {}, filters = {}) {
  const reasons = [];
  const values = (filters.cnaes || []).map(String);
  const cities = (filters.cities || []).map(v => String(v).toLowerCase());
  const states = (filters.states || []).map(v => String(v).toUpperCase());
  if (values.length && !values.includes(String(lead.cnae || ''))) reasons.push('CNAE_NOT_ALLOWED');
  if (cities.length && !cities.includes(String(lead.city || lead.cnpjCity || '').toLowerCase())) reasons.push('CITY_NOT_ALLOWED');
  if (states.length && !states.includes(String(lead.state || lead.cnpjState || '').toUpperCase())) reasons.push('STATE_NOT_ALLOWED');
  if (filters.excludeMei === true && lead.isMei === true) reasons.push('MEI_EXCLUDED');
  if (filters.requireActiveCnpj === true && lead.companyStatusClass !== 'ACTIVE') reasons.push('CNPJ_NOT_ACTIVE');
  if (Number.isFinite(filters.minScore) && Number(lead.commercialScore || 0) < filters.minScore) reasons.push('SCORE_BELOW_MINIMUM');
  return { matches: reasons.length === 0, filterReasons: reasons };
}
module.exports = { matchesFilters };
