/** Route qualified leads without changing the approved SDR conversation policy. */
function routeLead({ score = 0, acceptsCommercialContact = false } = {}) {
  if (!acceptsCommercialContact) return { queue: 'NURTURE', priority: 'LOW', reason: 'NO_CONTACT_CONSENT' };
  if (score >= 75) return { queue: 'PRIORITY', priority: 'HIGH', reason: 'HOT_LEAD' };
  if (score >= 50) return { queue: 'FOLLOW_UP', priority: 'MEDIUM', reason: 'WARM_LEAD' };
  return { queue: 'NURTURE', priority: 'LOW', reason: 'COLD_LEAD' };
}
module.exports = { routeLead };
