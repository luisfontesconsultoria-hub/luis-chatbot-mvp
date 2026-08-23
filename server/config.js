function firstEnv(env, names, fallback = undefined) {
  for (const name of names) {
    if (env[name]) return env[name];
  }
  return fallback;
}

function getConfig(env = process.env) {
  const aiConfigured = Boolean(env.OPENAI_API_KEY);
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
    openAiApiKey: env.OPENAI_API_KEY || null,
    openAiModel: env.OPENAI_MODEL || 'gpt-5.6-luna',
    aiAssistEnabled: aiFlag === 'true'
  });
}

module.exports = { getConfig, firstEnv };
