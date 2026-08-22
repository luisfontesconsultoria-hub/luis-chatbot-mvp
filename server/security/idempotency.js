/** In-memory reference implementation; production should use durable storage with a unique constraint. */
function createIdempotencyGuard() {
  const seen = new Set();
  return { has(key){ return seen.has(String(key)); }, mark(key){ const k=String(key); if(seen.has(k)) return false; seen.add(k); return true; } };
}
module.exports = { createIdempotencyGuard };
