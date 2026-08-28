const { canTransition, assertTransition, BLOCKED, SCHEDULE_GATE } = require('./transition-guard');

const tests = [
  () => { if (!canTransition('NEW','IDENTIFYING')) throw Error('NEW transition failed'); },
  () => { if (canTransition(BLOCKED,'QUALIFYING')) throw Error('blocked transition leaked'); },
  () => { if (!canTransition(BLOCKED,'QUALIFYING',true)) throw Error('authorized CNPJ release failed'); },
  () => { if (canTransition(SCHEDULE_GATE,'CONFIRMED')) throw Error('schedule gate leaked'); },
  () => { if (!canTransition(SCHEDULE_GATE,'CONFIRMED',true)) throw Error('authorized schedule release failed'); },
  () => { let failed=false; try { assertTransition('CONFIRMED','QUALIFYING'); } catch(e) { failed=true; } if(!failed) throw Error('invalid reverse transition accepted'); },
  () => { let failed=false; try { assertTransition(SCHEDULE_GATE,'CONFIRMED'); } catch(e) { failed=true; } if(!failed) throw Error('unauthorized schedule confirmation accepted'); }
];

tests.forEach((fn,i)=>{fn(); console.log(`PASS transition-${i+1}`);});
console.log(`PASS ${tests.length} transition checks`);
