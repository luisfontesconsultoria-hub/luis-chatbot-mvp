const { preflight, assertPilotReady } = require('./production-check');
const missing = preflight({});
if (missing.ready || missing.missing.length !== 7) throw Error('preflight missing-secret detection failed');
const values = { SUPABASE_URL:'x', SUPABASE_SERVICE_ROLE_KEY:'x', WHATSAPP_VERIFY_TOKEN:'x', WHATSAPP_ACCESS_TOKEN:'x', WHATSAPP_PHONE_NUMBER_ID:'x', META_APP_SECRET:'x', OPENAI_API_KEY:'x' };
if (!assertPilotReady(values).ready) throw Error('complete pilot environment rejected');
console.log('PASS V1 pilot preflight');
