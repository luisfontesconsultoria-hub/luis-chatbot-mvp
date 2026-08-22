/** Structured, secret-safe operational logging. Never log tokens or full customer payloads. */
const SECRET_KEYS = /token|secret|password|authorization|api[_-]?key/i;

function sanitize(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(sanitize);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SECRET_KEYS.test(k) ? '[REDACTED]' : sanitize(v)]));
  }
  return value;
}

function logEvent(event, data = {}) {
  const payload = { ts: new Date().toISOString(), event, ...sanitize(data) };
  console.log(JSON.stringify(payload));
}
module.exports = { sanitize, logEvent };
