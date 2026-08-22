/** Server-side licensing boundary for future commercial deployments. */
const crypto = require('node:crypto');

function canonical(payload) {
  return JSON.stringify({ tenantId: payload.tenantId, status: payload.status, expiresAt: payload.expiresAt, plan: payload.plan });
}

function signLicense(payload, secret) {
  if (!secret) throw new Error('LICENSE_SIGNING_SECRET_NOT_CONFIGURED');
  return crypto.createHmac('sha256', secret).update(canonical(payload)).digest('hex');
}

function verifyLicense(license, secret, now = Date.now()) {
  if (!license || !secret || !license.tenantId || !license.signature) return { valid: false, reason: 'INVALID_LICENSE' };
  const expected = signLicense(license, secret);
  const signatureOk = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(license.signature));
  if (!signatureOk) return { valid: false, reason: 'INVALID_SIGNATURE' };
  if (license.status !== 'ACTIVE') return { valid: false, reason: 'LICENSE_INACTIVE' };
  if (!Number.isFinite(Date.parse(license.expiresAt)) || Date.parse(license.expiresAt) <= now) return { valid: false, reason: 'LICENSE_EXPIRED' };
  return { valid: true, tenantId: license.tenantId, plan: license.plan || 'STANDARD', expiresAt: license.expiresAt };
}

function assertLicensed(license, secret, now = Date.now()) {
  const result = verifyLicense(license, secret, now);
  if (!result.valid) throw new Error(`LICENSE_BLOCKED:${result.reason}`);
  return result;
}

module.exports = { signLicense, verifyLicense, assertLicensed };
