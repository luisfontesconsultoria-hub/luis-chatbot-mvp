/** Commercial policy: keep payment provider independent from enforcement. */
const GRACE_PERIOD_MS = 72 * 60 * 60 * 1000;

function evaluateLicense(license, now = Date.now()) {
  if (!license) return { allowed: false, reason: 'LICENSE_MISSING' };
  if (license.status === 'CANCELLED' || license.status === 'SUSPENDED') return { allowed: false, reason: 'LICENSE_INACTIVE' };
  const expiry = Date.parse(license.expiresAt);
  if (!Number.isFinite(expiry)) return { allowed: false, reason: 'LICENSE_INVALID' };
  if (expiry > now) return { allowed: true, mode: 'ACTIVE' };
  const graceUntil = expiry + GRACE_PERIOD_MS;
  if (now < graceUntil) return { allowed: true, mode: 'GRACE' };
  return { allowed: false, reason: 'LICENSE_EXPIRED' };
}

module.exports = { evaluateLicense, GRACE_PERIOD_MS };
