const { getEntitlements, assertWithinLimit } = require('./entitlements');
if (getEntitlements('STANDARD').maxWhatsAppNumbers !== 1) throw Error('standard entitlement mismatch');
if (getEntitlements('PRO').maxWhatsAppNumbers !== 3) throw Error('pro entitlement mismatch');
assertWithinLimit('STANDARD','maxWhatsAppNumbers',0);
try { assertWithinLimit('STANDARD','maxWhatsAppNumbers',1); throw Error('limit not enforced'); } catch(e) { if (!String(e.message).startsWith('ENTITLEMENT_LIMIT')) throw e; }
console.log('PASS entitlements');
