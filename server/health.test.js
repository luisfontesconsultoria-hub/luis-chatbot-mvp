const { healthResponse } = require('./health');
const result = healthResponse({ version:'v1', now:'2026-08-22T15:00:00Z' });
if (result.status !== 'ok' || result.service !== 'luis-chatbot-mvp' || result.version !== 'v1') throw Error('HEALTH_RESPONSE_FAILED');
if (JSON.stringify(result).match(/KEY|TOKEN|SECRET/i)) throw Error('HEALTH_LEAKS_SECRET_TERMS');
console.log('PASS production health response');
