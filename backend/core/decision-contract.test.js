const { normalizeDecision, assertTransition } = require('./decision-contract');

const checks = [
  () => { const d = normalizeDecision({ status:'QUALIFYING', reply:'ok', handoff:false }); if(d.status!=='QUALIFYING'||d.reply!=='ok') throw Error('canonical decision failed'); },
  () => { let denied=false; try { assertTransition('AGUARDANDO_RETORNO_DO_LUIS', {status:'QUALIFYING'}); } catch(e) { denied=e.message==='blocked_state_transition_denied'; } if(!denied) throw Error('blocked transition was allowed'); },
  () => { const d = normalizeDecision({ status:'NOT_A_STATE', reply:123 }); if(d.status!=='ERROR_RETRY'||d.reply!=='123') throw Error('invalid decision fallback failed'); }
];
checks.forEach((fn,i)=>{fn(); console.log(`PASS decision-contract-${i+1}`);});
console.log(`PASS ${checks.length} decision contract checks`);
