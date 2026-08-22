/** Computes V1 pilot readiness without exposing secret values. */
const REQUIRED = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','WHATSAPP_VERIFY_TOKEN','WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','META_APP_SECRET','OPENAI_API_KEY'];
function readiness(env = process.env) {
  const missing = REQUIRED.filter(k => !env[k]);
  return { ready: missing.length === 0, missingCount: missing.length, requiredCount: REQUIRED.length };
}
module.exports = { readiness, REQUIRED };
