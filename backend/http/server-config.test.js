const { getServerConfig } = require('./server-config');
const c = getServerConfig({PORT:'8080',HOST:'127.0.0.1'});
if (c.port !== 8080 || c.host !== '127.0.0.1' || c.webhookPath !== '/webhook' || c.healthPath !== '/health') throw Error('server config failed');
console.log('PASS server config');
