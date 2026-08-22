const { routeLead } = require('./lead-routing');
if (routeLead({score:90,acceptsCommercialContact:true}).queue !== 'PRIORITY') throw Error('hot routing failed');
if (routeLead({score:60,acceptsCommercialContact:true}).queue !== 'FOLLOW_UP') throw Error('warm routing failed');
if (routeLead({score:90,acceptsCommercialContact:false}).reason !== 'NO_CONTACT_CONSENT') throw Error('consent gate failed');
console.log('PASS lead routing');
