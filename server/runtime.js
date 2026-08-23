const { createProductionRepository } = require('./supabase-runtime');
const { createWebhookPipeline } = require('./webhook-pipeline');
const { createMetaSender } = require('./meta-sender');
const { createProductionSdrGateway } = require('./production-sdr');

function createProductionRuntime(env = process.env) {
  const repository = createProductionRepository(env);
  if (!repository) return { repository: null, pipeline: null, sender: null, sdr: null };
  const sender = createMetaSender(env);
  const sdr = createProductionSdrGateway({ repository, sender, env });
  const pipeline = createWebhookPipeline({ repository, sdrGateway: sdr });
  return { repository, pipeline, sender, sdr };
}

module.exports = { createProductionRuntime };
