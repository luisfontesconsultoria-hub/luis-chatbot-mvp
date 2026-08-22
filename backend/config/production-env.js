/** Production environment gate. Values are read at runtime; no secrets are stored here. */
const REQUIRED = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','OPENAI_API_KEY','META_VERIFY_TOKEN','META_ACCESS_TOKEN','META_PHONE_NUMBER_ID'];
function validateProductionEnv(env = process.env) {
  const missing = REQUIRED.filter(k => !String(env[k] || '').trim());
  if (missing.length) throw new Error(`PRODUCTION_ENV_MISSING:${missing.join(',')}`);
  return { ok: true, keysPresent: REQUIRED.slice() };
}
module.exports = { REQUIRED, validateProductionEnv };
