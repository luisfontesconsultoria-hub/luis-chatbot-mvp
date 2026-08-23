const { createClient } = require('@supabase/supabase-js');
const { createSupabaseRepository } = require('../backend/persistence/supabase-adapter');

function createProductionRepository(env = process.env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const client = createClient(url, key, { auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false } });
  return createSupabaseRepository(client);
}

module.exports = { createProductionRepository };
