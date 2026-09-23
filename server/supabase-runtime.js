const { createClient } = require('@supabase/supabase-js');
const WebSocketImpl = require('ws');
const { createSupabaseRepository } = require('../backend/persistence/supabase-adapter');

function createTimeoutFetch(timeoutMs, baseFetch = globalThis.fetch) {
  return (input, init = {}) => {
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return baseFetch(input, { ...init, signal });
  };
}

function createProductionRepository(env = process.env) {
  const url = env.SUPABASE_URL;
  // CRM persistence must use the server-side service-role credential.
  // Prefer the canonical variable so an accidentally configured anon/publishable
  // key in SUPABASE_SECRET_KEY can never override the service-role key.
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  // Node 20 has no stable global WebSocket, and @supabase/realtime-js throws at
  // client-construction time (not lazily) unless a transport is supplied.
  // We don't use Realtime subscriptions in this project, but createClient()
  // still builds the Realtime client eagerly, so this must always be provided.
  const client = createClient(url, key, {
    auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
    realtime: { transport: WebSocketImpl },
    // Sem timeout, um fetch pendurado deixa o handler do WhatsApp sem resultado terminal.
    // O erro ("TimeoutError ... timeout") é transitório para o spool.
    global: { fetch: createTimeoutFetch(Number(env.SUPABASE_FETCH_TIMEOUT_MS) || 15000) }
  });
  return createSupabaseRepository(client);
}

module.exports = { createProductionRepository, createTimeoutFetch };
