const { loadEnv, assertProductionEnv } = require('./env');

const clean = loadEnv({});
if (clean.ok || clean.missing.length !== 2) throw Error('required secret contract failed');

const ready = loadEnv({ SUPABASE_URL:'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY:'server-only' });
if (!ready.ok) throw Error('valid server environment rejected');

let failed = false;
try { assertProductionEnv({}); } catch (e) { failed = true; }
if (!failed) throw Error('production environment guard failed');

console.log('PASS server environment contract');
