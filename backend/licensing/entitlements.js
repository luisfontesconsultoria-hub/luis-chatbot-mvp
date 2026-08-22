/** Plan entitlements are centralized so commercial limits do not leak into SDR logic. */
const PLANS = {
  STANDARD: { maxWhatsAppNumbers: 1, maxUsers: 1 },
  PRO: { maxWhatsAppNumbers: 3, maxUsers: 5 },
  ENTERPRISE: { maxWhatsAppNumbers: 10, maxUsers: 25 }
};

function getEntitlements(plan = 'STANDARD') {
  return PLANS[plan] || PLANS.STANDARD;
}

function assertWithinLimit(plan, key, current) {
  const limits = getEntitlements(plan);
  if (!(key in limits)) throw new Error('UNKNOWN_ENTITLEMENT');
  if (!Number.isInteger(current) || current < 0 || current >= limits[key]) throw new Error(`ENTITLEMENT_LIMIT:${key}`);
  return true;
}

module.exports = { PLANS, getEntitlements, assertWithinLimit };
