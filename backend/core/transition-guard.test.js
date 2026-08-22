const { canTransition, assertTransition } = require('./transition-guard');

const tests = [
  () => { if (!canTransition('NEW','IDENTIFYING')) throw Error('NEW transition failed'); },
  () => { if (canTransition('AGUARDANDO_RETORNO_DO_LUIS','QUALIFYING')) throw Error('blocked transition leaked'); },
  () => { if (!canTransition('AGUARDANDO_RETORNO_DO_LUIS','QUALIFYING',true)) throw Error('authorized release failed'); },
  () => { let failed=false; try { assertTransition('CONFIRMED','QUALIFYING'); } catch(e) { failed=true; } if(!failed) throw Error('invalid reverse transition accepted'); }
];

tests.forEach((fn,i)=>{fn(); console.log(`PASS transition-${i+1}`);});
console.log(`PASS ${tests.length} transition checks`);
