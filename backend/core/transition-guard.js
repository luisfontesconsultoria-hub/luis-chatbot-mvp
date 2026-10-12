/** Central state transition guard for the V1 SDR. */
const { STATES } = require('./sdr-contract');
const BLOCKED = STATES.AGUARDANDO_RETORNO_DO_LUIS;
const SCHEDULE_GATE = STATES.AGUARDANDO_CONFIRMACAO_AGENDA;
const HUMAN = STATES.HUMAN_HANDOFF;

const ALLOWED = {
  NEW: new Set(['IDENTIFYING','QUALIFYING','NEW']),
  IDENTIFYING: new Set(['QUALIFYING','IDENTIFYING']),
  QUALIFYING: new Set(['QUALIFYING_REVENUE','CNPJ_PENDING','QUALIFYING','HUMAN_HANDOFF']),
  QUALIFYING_REVENUE: new Set(['QUALIFYING_PAIN','QUALIFYING_REVENUE']),
  QUALIFYING_PAIN: new Set(['QUALIFYING_ACCEPTANCE','QUALIFYING_PAIN']),
  QUALIFYING_ACCEPTANCE: new Set(['MEETING_MODE','QUALIFYING_ACCEPTANCE']),
  CNPJ_PENDING: new Set([BLOCKED,'CNPJ_PENDING','ERROR_RETRY']),
  [BLOCKED]: new Set([BLOCKED,'QUALIFYING','HUMAN_HANDOFF','AF_DECIDING','LOST']),
  MEETING_MODE: new Set(['SCHEDULING','MEETING_MODE']),
  SCHEDULING: new Set([SCHEDULE_GATE,'SCHEDULING']),
  [SCHEDULE_GATE]: new Set([SCHEDULE_GATE,'CONFIRMED','HUMAN_HANDOFF']),
  CONFIRMED: new Set(['CLOSED','CONFIRMED']),
  HUMAN_HANDOFF: new Set(['HUMAN_HANDOFF','QUALIFYING']),
  LOST: new Set(['LOST','QUALIFYING','AF_LINK_SENT']),
  ERROR_RETRY: new Set(['ERROR_RETRY','QUALIFYING','HUMAN_HANDOFF']),
  CLOSED: new Set(['CLOSED']),
  // Operação de afiliados (backend/affiliate/orchestrator.js)
  AF_IDENTIFY_PRODUCT: new Set(['AF_IDENTIFY_PRODUCT','AF_DIAGNOSING','AF_DECIDING','AF_LINK_SENT',BLOCKED,'LOST']),
  AF_DIAGNOSING: new Set(['AF_DIAGNOSING','AF_PRESENTING','AF_DECIDING','AF_LINK_SENT',BLOCKED,'LOST']),
  AF_PRESENTING: new Set(['AF_PRESENTING','AF_DECIDING','AF_LINK_SENT',BLOCKED,'LOST']),
  AF_DECIDING: new Set(['AF_DECIDING','AF_LINK_SENT',BLOCKED,'LOST']),
  AF_LINK_SENT: new Set(['AF_LINK_SENT','AF_PURCHASE_REPORTED','AF_SOLD',BLOCKED,'LOST']),
  AF_PURCHASE_REPORTED: new Set(['AF_PURCHASE_REPORTED','AF_SOLD',BLOCKED,'LOST']),
  AF_SOLD: new Set(['AF_SOLD',BLOCKED,'LOST'])
};

function canTransition(from, to, authorizedHumanRelease = false) {
  if (from === BLOCKED && !authorizedHumanRelease) return to === BLOCKED;
  if (from === SCHEDULE_GATE && !authorizedHumanRelease) return to === SCHEDULE_GATE;
  if (from === HUMAN && !authorizedHumanRelease) return to === HUMAN;
  return Boolean(ALLOWED[from] && ALLOWED[from].has(to));
}

function assertTransition(from, to, authorizedHumanRelease = false) {
  if (!canTransition(from, to, authorizedHumanRelease)) throw new Error(`invalid_state_transition:${from}->${to}`);
}

module.exports = { canTransition, assertTransition, BLOCKED, SCHEDULE_GATE, HUMAN };
