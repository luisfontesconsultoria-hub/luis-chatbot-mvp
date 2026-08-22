/** Canonical CRM projection for acquisition, score and routing. */
const { normalizeSource } = require('./acquisition-sources');
const { classifyScore } = require('./lead-scoring');

function buildLeadRecord(input = {}, score = 0, route = {}) {
  return {
    source: normalizeSource(input.source),
    score: Math.max(0, Math.min(100, Number(score) || 0)),
    classification: classifyScore(score),
    queue: route.queue || 'NURTURE',
    priority: route.priority || 'LOW',
    nextAction: route.reason || 'NURTURE',
    updatedAt: new Date().toISOString()
  };
}
module.exports = { buildLeadRecord };
