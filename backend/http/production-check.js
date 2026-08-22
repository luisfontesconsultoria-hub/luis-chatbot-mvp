/** Preflight checks for V1 pilot. Does not contact external services. */
const REQUIRED = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','WHATSAPP_VERIFY_TOKEN','WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','META_APP_SECRET','OPENAI_API_KEY'];

function preflight(env = process.env) {
  const missing = REQUIRED.filter(k => !env[k]);
  return { ready: missing.length === 0, missing };
}

function assertPilotReady(env = process.env) {
  const result = preflight(env);
  if (!result.ready) throw new Error(`PILOT_NOT_READY:${result.missing.join(',')}`);
  return result;
}
module.exports = { preflight, assertPilotReady, REQUIRED };
