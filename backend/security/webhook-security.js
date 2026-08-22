/** Webhook security helpers: signature verification + lightweight in-process rate limit. */
const crypto = require('crypto');

function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!rawBody || !signatureHeader || !appSecret) return false;
  const [prefix, received] = String(signatureHeader).split('=');
  if (prefix !== 'sha256' || !received) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const a = Buffer.from(received, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createRateLimiter({ limit = 30, windowMs = 60_000 } = {}) {
  const buckets = new Map();
  return function allow(key) {
    const now = Date.now();
    const current = buckets.get(key);
    if (!current || now - current.start >= windowMs) {
      buckets.set(key, { start: now, count: 1 });
      return true;
    }
    if (current.count >= limit) return false;
    current.count += 1;
    return true;
  };
}

module.exports = { verifyMetaSignature, createRateLimiter };
