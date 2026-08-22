const { assertSingleNumberPilot } = require('./pilot-gate');
const event = { metadata:{ phoneNumberId:'v1-number' } };
if (!assertSingleNumberPilot(event, 'v1-number')) throw Error('authorized V1 number rejected');
let blocked = false;
try { assertSingleNumberPilot({metadata:{phoneNumberId:'other-number'}}, 'v1-number'); } catch(e) { blocked = e.message === 'V1_NUMBER_NOT_AUTHORIZED'; }
if (!blocked) throw Error('second WhatsApp number was not blocked');
console.log('PASS single-number V1 pilot gate');
