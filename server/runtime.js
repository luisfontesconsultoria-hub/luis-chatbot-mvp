const { createProductionRepository } = require('./supabase-runtime');
const { createWebhookPipeline } = require('./webhook-pipeline');
const { createMetaSender } = require('./meta-sender');
const { createProductionSdrGateway } = require('./production-sdr');

// server/http.js, server/crm-actions.js e server/routes.js chamam
// createProductionRuntime() cada um de forma independente. Sem cache, isso
// abria 3 clientes Supabase distintos no mesmo processo. Cache em nível de
// módulo (singleton por processo) para que os 3 pontos de entrada
// compartilhem o mesmo repository/sender/sdr/pipeline. Só o resultado
// bem-sucedido é cacheado: se SUPABASE_URL/KEY não estiverem configurados
// nesta chamada, repository vem null e a próxima chamada tenta de novo, em
// vez de travar um estado inválido para sempre.
let cachedRuntime = null;

function createProductionRuntime(env = process.env) {
  if (cachedRuntime) return cachedRuntime;
  const repository = createProductionRepository(env);
  if (!repository) return { repository: null, pipeline: null, sender: null, sdr: null };
  const sender = createMetaSender(env);
  const sdr = createProductionSdrGateway({ repository, sender, env });
  const pipeline = createWebhookPipeline({ repository, sdrGateway: sdr });
  cachedRuntime = { repository, pipeline, sender, sdr };
  return cachedRuntime;
}

module.exports = { createProductionRuntime };
