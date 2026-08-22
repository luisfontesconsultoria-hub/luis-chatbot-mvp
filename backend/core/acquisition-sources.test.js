const { normalizeSource } = require('./acquisition-sources');
if (normalizeSource('linkedin') !== 'LINKEDIN') throw Error('LinkedIn source failed');
if (normalizeSource('google_ads') !== 'GOOGLE_ADS') throw Error('Google Ads source failed');
if (normalizeSource('unknown') !== 'DIRECT') throw Error('unknown source fallback failed');
console.log('PASS acquisition sources');
