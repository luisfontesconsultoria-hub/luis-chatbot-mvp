/** Canonical decision shape used between SDR, persistence and channel layers. */
const ALLOWED = new Set([
  'NEW','IDENTIFYING','QUALIFYING','QUALIFYING_REVENUE','QUALIFYING_PAIN',
  'QUALIFYING_ACCEPTANCE','CNPJ_PENDING','AGUARDANDO_RETORNO_DO_LUIS',
  'MEETING_MODE','SCHEDULING','CONFIRMED','HUMAN_HANDOFF','LOST','ERROR_RETRY','CLOSED'
]);

function normalizeDecision(raw = {}) {
  const status = ALLOWED.has(raw.status) ? raw.status : 'ERROR_RETRY';
  return {
    status,
    reply: raw.reply == null ? null : String(raw.reply),
    handoff: Boolean(raw.handoff),
    tool: raw.tool || null,
    nextAction: raw.nextAction || (raw.handoff ? 'LUIS' : null)
  };
}

function assertTransition(previous, decision) {
  if (previous === 'AGUARDANDO_RETORNO_DO_LUIS' && decision.status !== previous && !decision.authorizedHumanRelease) {
    throw new Error('blocked_state_transition_denied');
  }
  return true;
}

module.exports = { normalizeDecision, assertTransition, ALLOWED };
