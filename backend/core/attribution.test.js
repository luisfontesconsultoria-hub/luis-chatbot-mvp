const { normalizeAttribution, sourceFromAttribution } = require('./attribution');
const a = normalizeAttribution({utm_source:'google',utm_campaign:'pj',gclid:'abc',evil:'drop',utm_content:'x'});
if (a.evil || a.utm_source !== 'google' || sourceFromAttribution(a) !== 'GOOGLE') throw Error('attribution normalization failed');
if (sourceFromAttribution({gclid:'abc'}) !== 'GOOGLE_ADS') throw Error('gclid classification failed');
if (sourceFromAttribution({fbclid:'abc'}) !== 'META_ADS') throw Error('fbclid classification failed');
if (sourceFromAttribution({}) !== 'DIRECT') throw Error('direct classification failed');
console.log('PASS attribution normalization');
