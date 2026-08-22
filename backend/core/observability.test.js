const { sanitize } = require('./observability');
const value = sanitize({ token:'x', password:'y', nested:{ api_key:'z' }, safe:'ok' });
if (value.token !== '[REDACTED]' || value.password !== '[REDACTED]' || value.nested.api_key !== '[REDACTED]' || value.safe !== 'ok') throw Error('secret sanitization failed');
console.log('PASS secret-safe logging');
