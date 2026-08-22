/** V1 privacy/data-minimization policy. Legal review is still required before public launch. */
const RETENTION_DAYS = 180;
const MIN_FIELDS = ['phone','source','status'];

function retentionCutoff(now = new Date(), days = RETENTION_DAYS) {
  return new Date(now.getTime() - days * 86400000).toISOString();
}

function minimizeLead(input = {}) {
  return Object.fromEntries(Object.entries(input).filter(([key]) => MIN_FIELDS.includes(key) || ['name','company_name','cnpj','product_interest','pain_point','consent_at'].includes(key)));
}

module.exports = { RETENTION_DAYS, retentionCutoff, minimizeLead };
