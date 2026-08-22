const { evaluateLicense } = require('./license-policy');
const now = Date.parse('2026-08-22T00:00:00.000Z');
if (!evaluateLicense({status:'ACTIVE',expiresAt:'2026-08-23T00:00:00.000Z'}, now).allowed) throw Error('active license blocked');
if (evaluateLicense({status:'ACTIVE',expiresAt:'2026-08-21T00:00:00.000Z'}, now).mode !== 'GRACE') throw Error('grace policy failed');
if (evaluateLicense({status:'ACTIVE',expiresAt:'2026-08-17T00:00:00.000Z'}, now).allowed) throw Error('expired license allowed');
if (evaluateLicense({status:'SUSPENDED',expiresAt:'2099-01-01T00:00:00.000Z'}, now).allowed) throw Error('suspended license allowed');
console.log('PASS license policy');
