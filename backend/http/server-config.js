/** Production-safe server defaults. The deployment platform provides HTTPS termination. */
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

function getServerConfig(env = process.env) {
  return {
    port: Number(env.PORT || PORT),
    host: env.HOST || HOST,
    trustProxy: true,
    webhookPath: '/webhook',
    healthPath: '/health'
  };
}

module.exports = { getServerConfig };
