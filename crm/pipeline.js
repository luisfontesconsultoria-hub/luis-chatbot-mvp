/** Controlled V1 CRM pipeline transitions. */
const FLOW = ['NEW','QUALIFIED','INTERESTED','PROPOSAL','WON','LOST'];
function transitionLeadStatus(current, next) {
  if (!FLOW.includes(current) || !FLOW.includes(next)) throw new Error('INVALID_PIPELINE_STATUS');
  if (current === 'WON' || current === 'LOST') throw new Error('CLOSED_LEAD_IMMUTABLE');
  if (next === current) return { from: current, to: next, changed: false };
  return { from: current, to: next, changed: true };
}
module.exports = { FLOW, transitionLeadStatus };
