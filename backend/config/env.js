/** Server-only environment contract. No secrets committed. */
const REQUIRED = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
const OPTIONAL = ['OPENAI_API_KEY','WHATSAPP_ACCESS_TOKEN','WHATSAPP_VERIFY_TOKEN','WHATSAPP_PHONE_NUMBER_ID'];

function loadEnv(env = process.env) {
  const missing = REQUIRED.filter(k => !env[k]);
  return {
    ok: missing.length === 0,
    missing,
    optionalConfigured: OPTIONAL.filter(k => Boolean(env[k]))
  };
}

function assertProductionEnv(env = process.env) {
  const result = loadEnv(env);
  if (!result.ok) throw new Error(`missing_server_secrets:${result.missing.join(',')}`);
  return result;
}

module.exports = { loadEnv, assertProductionEnv, REQUIRED, OPTIONAL };
