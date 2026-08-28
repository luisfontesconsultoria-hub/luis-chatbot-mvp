function firstEnv(env, names, fallback = undefined) {
  for (const name of names) {
    if (env[name]) return env[name];
  }
  return fallback;
}

function getConfig(env = process.env) {
  const aiProvider = String(env.AI_PROVIDER || 'gemini').trim().toLowerCase();
  const aiKey = aiProvider === 'gemini'
    ? env.GEMINI_API_KEY
    : aiProvider === 'ollama'
      ? true
      : null;
  const aiConfigured = Boolean(aiKey);
  const aiFlag = String(env.AI_ASSIST_ENABLED ?? (aiConfigured ? 'true' : 'false')).toLowerCase();

  return Object.freeze({
    nodeEnv: env.NODE_ENV || 'production',
    port: Number(env.PORT || 10000),
    supabaseUrl: env.SUPABASE_URL || null,
    supabaseKey: firstEnv(env, ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY']),
    metaVerifyToken: firstEnv(env, ['WHATSAPP_VERIFY_TOKEN', 'META_VERIFY_TOKEN']),
    metaAppSecret: env.META_APP_SECRET || null,
    metaAccessToken: firstEnv(env, ['WHATSAPP_ACCESS_TOKEN', 'META_ACCESS_TOKEN']),
    metaPhoneNumberId: firstEnv(env, ['WHATSAPP_PHONE_NUMBER_ID', 'META_PHONE_NUMBER_ID']),
    metaGraphApiVersion: firstEnv(env, ['WHATSAPP_GRAPH_API_VERSION', 'META_GRAPH_API_VERSION'], 'v20.0'),
    aiProvider,
    aiConfigured,
    aiAssistEnabled: aiFlag === 'true',
    geminiApiKey: env.GEMINI_API_KEY || null,
    geminiModel: env.GEMINI_MODEL || 'gemini-2.5-flash',
    ollamaBaseUrl: env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
    ollamaModel: env.OLLAMA_MODEL || 'gemma3:4b'
  });
}

module.exports = { getConfig, firstEnv };
