function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function calculateLeadScore(lead = {}) {
  const fit = clamp(lead.fitScore ?? lead.fit_score, 0, 20);
  const need = clamp(lead.needScore ?? lead.need_score, 0, 20);
  const authority = clamp(lead.authorityScore ?? lead.authority_score, 0, 15);
  const budget = clamp(lead.budgetScore ?? lead.budget_score, 0, 15);
  const timing = clamp(lead.timingScore ?? lead.timing_score, 0, 15);
  const intent = clamp(lead.intentScore ?? lead.intent_score, 0, 15);

  const explicit = [fit, need, authority, budget, timing, intent].some(v => v > 0);
  if (explicit) return classify({ fit, need, authority, budget, timing, intent, total: fit + need + authority + budget + timing + intent });

  let total = 0;
  const status = String(lead.status || 'NEW').toUpperCase();
  // QUALIFIED and above represent a sales-vetted stage, so QUALIFIED starts at the priority threshold.
  const statusScore = {
    NEW: 5, IDENTIFYING: 10, QUALIFYING: 20, QUALIFIED: 85,
    ACCEPTED: 65, MEETING_MODE: 75, SCHEDULING: 80,
    CONFIRMED: 90, NEGOTIATION: 85, AGUARDANDO_RETORNO: 60,
    AGUARDANDO_RETORNO_DO_LUIS: 75, CONVERTIDO: 100
  }[status] ?? 5;
  total += statusScore;
  // Company identity and verified CNPJ are strong qualification signals.
  if (lead.companyName) total += 6;
  if (lead.cnpj) total += 10;
  if (lead.interest) total += 4;
  if (lead.painPoint) total += 5;
  if (lead.monthlyRevenue) total += 3;
  if (lead.nextAction) total += 2;

  return classify({ fit: 0, need: 0, authority: 0, budget: 0, timing: 0, intent: 0, total });
}

function classify(parts) {
  const total = clamp(parts.total, 0, 100);
  let temperature = 'COLD';
  if (total >= 85) temperature = 'QUALIFIED';
  else if (total >= 70) temperature = 'HOT';
  else if (total >= 40) temperature = 'WARM';

  const readyForSales = total >= 85 && (parts.need >= 12 || parts.intent >= 10 || ['CONFIRMED', 'NEGOTIATION', 'CONVERTIDO'].includes(String(parts.status || '').toUpperCase()));
  return { ...parts, total, temperature, readyForSales };
}

module.exports = { calculateLeadScore, classify };
