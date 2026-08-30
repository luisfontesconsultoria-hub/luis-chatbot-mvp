/**
 * Framework-agnostic API boundary for the capture station.
 * It intentionally has no CRM/Supabase dependency.
 * External CNPJ resolution is injected by the hosting application; request
 * bodies never carry executable functions.
 */

const { runCaptureStation } = require('./google-maps-station');
const { getCaptureConfig } = require('./capture-provider-config');

function handleCaptureRequest(body = {}, env = process.env, dependencies = {}) {
  if (!Array.isArray(body.places)) {
    return { statusCode: 400, body: { error: 'PLACES_ARRAY_REQUIRED' } };
  }

  const config = getCaptureConfig(env);
  const result = runCaptureStation(body.places, {
    existing: Array.isArray(body.existing) ? body.existing : [],
    filters: { ...(body.filters || {}), minScore: body.filters?.minScore ?? config.minScore },
    eligibility: { ...(body.eligibility || {}), excludeMei: body.eligibility?.excludeMei ?? config.excludeMei },
    scoring: body.scoring || {},
    cnpjResolver: typeof dependencies.cnpjResolver === 'function' ? dependencies.cnpjResolver : undefined,
  });

  return { statusCode: 200, body: result };
}

module.exports = { handleCaptureRequest };
