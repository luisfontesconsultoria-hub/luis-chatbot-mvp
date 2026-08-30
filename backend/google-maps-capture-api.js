/**
 * Framework-agnostic API boundary for the capture station.
 * It intentionally has no CRM/Supabase dependency.
 */

const { runCaptureStation } = require('./google-maps-station');
const { getCaptureConfig } = require('./capture-provider-config');

function handleCaptureRequest(body = {}, env = process.env) {
  if (!Array.isArray(body.places)) {
    return { statusCode: 400, body: { error: 'PLACES_ARRAY_REQUIRED' } };
  }

  const config = getCaptureConfig(env);
  const result = runCaptureStation(body.places, {
    existing: Array.isArray(body.existing) ? body.existing : [],
    filters: { ...(body.filters || {}), minScore: body.filters?.minScore ?? config.minScore },
    eligibility: { ...(body.eligibility || {}), excludeMei: body.eligibility?.excludeMei ?? config.excludeMei },
    scoring: body.scoring || {},
    cnpjResolver: body.cnpjResolver,
  });

  return { statusCode: 200, body: result };
}

module.exports = { handleCaptureRequest };
