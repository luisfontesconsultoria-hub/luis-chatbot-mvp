const { createIdempotencyGuard } = require('./idempotency');
const guard = createIdempotencyGuard();
if (!guard.mark('meta:event:1')) throw Error('FIRST_EVENT_REJECTED');
if (guard.mark('meta:event:1')) throw Error('DUPLICATE_EVENT_ACCEPTED');
if (!guard.mark('meta:event:2')) throw Error('SECOND_EVENT_REJECTED');
console.log('PASS webhook idempotency guard');
