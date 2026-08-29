const assert = require('assert');
const fs = require('fs');
const render = fs.readFileSync('render.yaml','utf8');
const required = ['SUPABASE_URL','META_VERIFY_TOKEN','META_APP_SECRET','META_ACCESS_TOKEN','META_PHONE_NUMBER_ID','META_GRAPH_API_VERSION'];
for (const key of required) assert(render.includes(`key: ${key}`), `RENDER_SECRET_MISSING:${key}`);
assert(render.includes('key: SUPABASE_SERVICE_ROLE_KEY') || render.includes('key: SUPABASE_SECRET_KEY'), 'RENDER_SECRET_MISSING:SUPABASE_SERVICE_ROLE_KEY');
assert(render.includes('healthCheckPath: /health'));
assert(render.includes('startCommand: npm start'));
console.log('PASS production configuration contract');
