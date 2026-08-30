const { createClient } = require('@supabase/supabase-js');
const WebSocketImpl = require('ws');
const { createSupabaseRepository } = require('../backend/persistence/supabase-adapter');

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
    realtime: { transport: WebSocketImpl }
  });
  return createSupabaseRepository(client);
}

module.exports = { createProductionRepository };
