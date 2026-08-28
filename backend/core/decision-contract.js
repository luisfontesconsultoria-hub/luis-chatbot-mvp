/** Canonical decision shape used between SDR, persistence and channel layers. */
const { STATES } = require('./sdr-contract');
const ALLOWED = new Set(Object.values(STATES));

function normalizeDecision(raw = {}) {
  const status = ALLOWED.has(raw.status) ? raw.status : STATES.ERROR_RETRY;
  return {
    status,
    reply: raw.reply == null ? null : String(raw.reply),
    handoff: Boolean(raw.handoff),
    tool: raw.tool || null,
    nextAction: raw.nextAction || (raw.handoff ? 'LUIS' : null),
    authorizedHumanRelease: Boolean(raw.authorizedHumanRelease)
  };
}

function assertTransition(previous, decision) {
  if ((previous === STATES.AGUARDANDO_RETORNO_DO_LUIS || previous === STATES.AGUARDANDO_CONFIRMACAO_AGENDA) && decision.status !== previous && !decision.authorizedHumanRelease) {
    throw new Error('blocked_state_transition_denied');
  }
  return true;
}

module.exports = { normalizeDecision, assertTransition, ALLOWED };
