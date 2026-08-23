const assert = require('assert');
const { getConfig } = require('./config');

const config = getConfig({
  SUPABASE_SECRET_KEY:'secret',
  META_VERIFY_TOKEN:'verify',
  META_ACCESS_TOKEN:'access',
  META_PHONE_NUMBER_ID:'phone',
  META_GRAPH_API_VERSION:'v21.0',
  OPENAI_API_KEY:'key',
  AI_ASSIST_ENABLED:'true'
});
assert.equal(config.supabaseKey, 'secret');
assert.equal(config.metaVerifyToken, 'verify');
assert.equal(config.metaAccessToken, 'access');
assert.equal(config.metaPhoneNumberId, 'phone');
assert.equal(config.metaGraphApiVersion, 'v21.0');
assert.equal(config.aiAssistEnabled, true);
console.log('PASS production environment aliases');
