/** Deterministic pre-SDR lead scoring. AI may enrich notes, but does not override this policy layer. */
function scoreLead(input = {}) {
  let score = 0;
  if (input.companyActive === true) score += 25;
  if (['ME','EPP','LTDA','SA'].includes(String(input.companyType || '').toUpperCase())) score += 20;
  if (input.hasCnpj === true) score += 15;
  if (input.interestAccount === true) score += 15;
  if (input.interestCardMachine === true) score += 10;
  if (input.acceptsCommercialContact === true) score += 10;
  if (input.source === 'LINKEDIN') score += 5;
  return Math.min(score, 100);
}
function classifyScore(score) {
  if (score >= 75) return 'HOT';
  if (score >= 50) return 'WARM';
  return 'COLD';
}
module.exports = { scoreLead, classifyScore };
