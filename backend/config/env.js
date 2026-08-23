/** Server-only environment contract. No secrets committed. */
const REQUIRED = ['SUPABASE_URL'];
const SUPABASE_SERVER_KEY_NAMES = ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'];
const OPTIONAL = ['OPENAI_API_KEY','WHATSAPP_ACCESS_TOKEN','WHATSAPP_VERIFY_TOKEN','WHATSAPP_PHONE_NUMBER_ID','META_APP_SECRET','META_VERIFY_TOKEN'];

function loadEnv(env = process.env) {
  const missing = REQUIRED.filter(k => !env[k]);
  if (!SUPABASE_SERVER_KEY_NAMES.some(k => Boolean(env[k]))) missing.push('SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY');
  return {
    ok: missing.length === 0,
    missing,
    optionalConfigured: OPTIONAL.filter(k => Boolean(env[k])),
    supabaseServerKey: SUPABASE_SERVER_KEY_NAMES.find(k => Boolean(env[k])) || null
  };
}

function assertProductionEnv(env = process.env) {
  const result = loadEnv(env);
  if (!result.ok) throw new Error(`missing_server_secrets:${result.missing.join(',')}`);
  return result;
}

module.exports = { loadEnv, assertProductionEnv, REQUIRED, SUPABASE_SERVER_KEY_NAMES, OPTIONAL };
