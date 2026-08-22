const { retentionCutoff, minimizeLead, RETENTION_DAYS } = require('./data-policy');
const source = { phone:'1', source:'WHATSAPP', status:'NEW', name:'A', api_key:'secret', random:'discard' };
const reduced = minimizeLead(source);
if (reduced.api_key || reduced.random || reduced.phone !== '1') throw Error('data minimization failed');
const cutoff = retentionCutoff(new Date('2026-08-22T00:00:00Z'));
if (cutoff !== '2026-02-23T00:00:00.000Z' || RETENTION_DAYS !== 180) throw Error('retention policy failed');
console.log('PASS privacy data policy');
