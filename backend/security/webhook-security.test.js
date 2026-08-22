const crypto = require('crypto');
const { verifyMetaSignature, createRateLimiter } = require('./webhook-security');

const body = JSON.stringify({ test:true });
const secret = 'secret';
const digest = crypto.createHmac('sha256', secret).update(body).digest('hex');
if (!verifyMetaSignature(body, `sha256=${digest}`, secret)) throw Error('valid signature rejected');
if (verifyMetaSignature(body, 'sha256=bad', secret)) throw Error('invalid signature accepted');

const allow = createRateLimiter({ limit:2, windowMs:10000 });
if (!allow('x') || !allow('x') || allow('x')) throw Error('rate limit failed');
console.log('PASS webhook security');
