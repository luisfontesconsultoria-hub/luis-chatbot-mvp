/** Bounded local guard. Durable idempotency remains enforced by the DB unique key. */
function createIdempotencyGuard({ maxEntries=5000, ttlMs=10*60*1000 }={}) {
  const seen=new Map();
  function prune(now=Date.now()) {
    for(const [key,timestamp] of seen){ if(now-timestamp>ttlMs) seen.delete(key); else break; }
    while(seen.size>maxEntries) seen.delete(seen.keys().next().value);
  }
  return {
    has(key){ const k=String(key); const timestamp=seen.get(k); if(!timestamp) return false; if(Date.now()-timestamp>ttlMs){seen.delete(k);return false;} return true; },
    mark(key){ const k=String(key); if(this.has(k)) return false; seen.set(k,Date.now()); prune(); return true; },
    clear(){seen.clear();}
  };
}
module.exports={createIdempotencyGuard};
