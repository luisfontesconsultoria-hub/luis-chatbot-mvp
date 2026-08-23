/**
 * Local guard prevents duplicate work inside one process.
 * Production durability is enforced by the events.idempotency_key unique constraint;
 * the webhook pipeline treats database uniqueness conflicts as duplicates.
 */
function createIdempotencyGuard() {
  const seen = new Set();
  return { has(key){ return seen.has(String(key)); }, mark(key){ const k=String(key); if(seen.has(k)) return false; seen.add(k); return true; } };
}
module.exports = { createIdempotencyGuard };
