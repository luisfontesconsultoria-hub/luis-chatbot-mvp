/**
 * Configuration only. No secrets are committed here.
 */

function getCaptureConfig(env = process.env) {
  return {
    provider: String(env.CAPTURE_PROVIDER || 'google_maps').toLowerCase(),
    batchSize: Math.max(1, Number(env.CAPTURE_BATCH_SIZE || 100)),
    excludeMei: String(env.CAPTURE_EXCLUDE_MEI || 'true').toLowerCase() === 'true',
    minScore: Math.max(0, Math.min(100, Number(env.CAPTURE_MIN_SCORE || 50))),
  };
}

module.exports = { getCaptureConfig };
