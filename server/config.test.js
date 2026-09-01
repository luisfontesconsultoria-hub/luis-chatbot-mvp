const assert = require('assert');
const { getConfig } = require('./config');

const config = getConfig({
  SUPABASE_SECRET_KEY:'secret',
  META_VERIFY_TOKEN:'verify',
  META_ACCESS_TOKEN:'access',
  META_PHONE_NUMBER_ID:'phone',
  META_GRAPH_API_VERSION:'v21.0',
  GEMINI_API_KEY:'key',
  GEMINI_MODEL:'gemini-test',
  AI_PROVIDER:'gemini',
  AI_ASSIST_ENABLED:'true'
});
assert.equal(config.supabaseKey, 'secret');
assert.equal(config.metaVerifyToken, 'verify');
assert.equal(config.metaAccessToken, 'access');
assert.equal(config.metaPhoneNumberId, 'phone');
assert.equal(config.metaGraphApiVersion, 'v21.0');
assert.equal(config.aiProvider, 'gemini');
assert.equal(config.geminiApiKey, 'key');
assert.equal(config.geminiModel, 'gemini-test');
assert.equal(config.aiAssistEnabled, true);
const local = getConfig({ AI_PROVIDER:'ollama', AI_ASSIST_ENABLED:'true', OLLAMA_MODEL:'gemma-test' });
assert.equal(local.aiProvider, 'ollama');
assert.equal(local.aiConfigured, true);
assert.equal(local.ollamaModel, 'gemma-test');
const openai = getConfig({ AI_PROVIDER:'openai', AI_ASSIST_ENABLED:'true', OPENAI_API_KEY:'key', OPENAI_MODEL:'gpt-test', OPENAI_BASE_URL:'https://example.test/v1' });
assert.equal(openai.aiProvider, 'openai');
assert.equal(openai.aiConfigured, true);
assert.equal(openai.openaiApiKey, 'key');
assert.equal(openai.openaiModel, 'gpt-test');
assert.equal(openai.openaiBaseUrl, 'https://example.test/v1');
console.log('PASS production environment aliases and AI providers');
