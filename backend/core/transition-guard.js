/** Central state transition guard for the V1 SDR. */
const BLOCKED = 'AGUARDANDO_RETORNO_DO_LUIS';
const HUMAN = 'HUMAN_HANDOFF';

const ALLOWED = {
  NEW: new Set(['IDENTIFYING','QUALIFYING','NEW']),
  IDENTIFYING: new Set(['QUALIFYING','IDENTIFYING']),
  QUALIFYING: new Set(['QUALIFYING_REVENUE','CNPJ_PENDING','QUALIFYING','HUMAN_HANDOFF']),
  QUALIFYING_REVENUE: new Set(['QUALIFYING_PAIN','QUALIFYING_REVENUE']),
  QUALIFYING_PAIN: new Set(['QUALIFYING_ACCEPTANCE','QUALIFYING_PAIN']),
  QUALIFYING_ACCEPTANCE: new Set(['MEETING_MODE','QUALIFYING_ACCEPTANCE']),
  CNPJ_PENDING: new Set(['AGUARDANDO_RETORNO_DO_LUIS','CNPJ_PENDING','ERROR_RETRY']),
  AGUARDANDO_RETORNO_DO_LUIS: new Set(['AGUARDANDO_RETORNO_DO_LUIS','QUALIFYING','HUMAN_HANDOFF']),
  MEETING_MODE: new Set(['SCHEDULING','MEETING_MODE']),
  SCHEDULING: new Set(['CONFIRMED','SCHEDULING']),
  CONFIRMED: new Set(['CLOSED','CONFIRMED']),
  HUMAN_HANDOFF: new Set(['HUMAN_HANDOFF','QUALIFYING']),
  LOST: new Set(['LOST','QUALIFYING']),
  ERROR_RETRY: new Set(['ERROR_RETRY','QUALIFYING','HUMAN_HANDOFF']),
  CLOSED: new Set(['CLOSED'])
};

function canTransition(from, to, authorizedHumanRelease = false) {
  if (from === BLOCKED && !authorizedHumanRelease) return to === BLOCKED;
  if (from === HUMAN && !authorizedHumanRelease) return to === HUMAN;
  return Boolean(ALLOWED[from] && ALLOWED[from].has(to));
}

function assertTransition(from, to, authorizedHumanRelease = false) {
  if (!canTransition(from, to, authorizedHumanRelease)) {
    throw new Error(`invalid_state_transition:${from}->${to}`);
  }
}

module.exports = { canTransition, assertTransition, BLOCKED, HUMAN };
