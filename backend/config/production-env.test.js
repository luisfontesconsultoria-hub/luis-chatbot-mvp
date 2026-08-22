const { validateProductionEnv } = require('./production-env');
let failed = false;
try { validateProductionEnv({}); } catch (e) { failed = e.message.includes('PRODUCTION_ENV_MISSING'); }
if (!failed) throw Error('missing env gate failed');
const env = {SUPABASE_URL:'u',SUPABASE_SERVICE_ROLE_KEY:'s',OPENAI_API_KEY:'o',META_VERIFY_TOKEN:'v',META_ACCESS_TOKEN:'a',META_PHONE_NUMBER_ID:'p'};
if (!validateProductionEnv(env).ok) throw Error('complete env gate failed');
console.log('PASS production environment gate');
