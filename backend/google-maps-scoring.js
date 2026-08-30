/** Lightweight deterministic commercial scoring. No persistence or CRM access. */
function scoreLead(lead = {}, options = {}) {
  const weights = { phone: 20, cnpj: 20, active: 20, cnae: 10, city: 10, address: 5, mapsUrl: 5, category: 5, companyName: 5, ...options.weights };
  let score = 0;
  const reasons = [];
  const add = (condition, points, reason) => { if (condition) { score += points; reasons.push(reason); } };
  add(Boolean(lead.phone || lead.cnpjPhone), weights.phone, 'CONTACT');
  add(Boolean(lead.cnpj), weights.cnpj, 'CNPJ');
  add(lead.companyStatusClass === 'ACTIVE', weights.active, 'ACTIVE_CNPJ');
  add(Boolean(lead.cnae), weights.cnae, 'CNAE');
  add(Boolean(lead.city || lead.cnpjCity), weights.city, 'CITY');
  add(Boolean(lead.address || lead.cnpjAddress), weights.address, 'ADDRESS');
  add(Boolean(lead.mapsUrl), weights.mapsUrl, 'MAPS_REFERENCE');
  add(Boolean(lead.category), weights.category, 'CATEGORY');
  add(Boolean(lead.companyName || lead.name), weights.companyName, 'COMPANY');
  const threshold = Number.isFinite(options.threshold) ? options.threshold : 70;
  return { ...lead, commercialScore: Math.min(100, score), commercialScoreReasons: reasons, commercialPriority: score >= threshold ? 'HIGH' : score >= threshold - 20 ? 'MEDIUM' : 'LOW' };
}
module.exports = { scoreLead };
