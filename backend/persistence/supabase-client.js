const { createClient } = require('@supabase/supabase-js');

function createSupabaseServerClient({ url = process.env.SUPABASE_URL, serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY } = {}) {
  if (!url || !serviceRoleKey) throw new Error('SUPABASE_CREDENTIALS_REQUIRED');
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken:false, persistSession:false, detectSessionInUrl:false } });
}

module.exports = { createSupabaseServerClient };
