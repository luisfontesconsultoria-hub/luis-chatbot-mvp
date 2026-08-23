const { createProductionRepository } = require('./supabase-runtime');
const { createWebhookPipeline } = require('./webhook-pipeline');

function createProductionRuntime(env = process.env) {
  const repository = createProductionRepository(env);
  const pipeline = repository ? createWebhookPipeline({ repository }) : null;
  return { repository, pipeline };
}

module.exports = { createProductionRuntime };
