const http = require('node:http');
const { handleMetaGet, handleMetaPost } = require('./http/meta-webhook');

function createServer({ repository, channel, ai, env = process.env } = {}) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      if (req.method === 'GET' && url.pathname === '/health') {
        const required = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','WHATSAPP_VERIFY_TOKEN','WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','META_APP_SECRET','OPENAI_API_KEY'];
        const missing = required.filter(k => !env[k]);
        res.writeHead(missing.length ? 503 : 200, {'content-type':'application/json'});
        return res.end(JSON.stringify({ ok: missing.length === 0, missingCount: missing.length }));
      }
      if (url.pathname === '/webhook' && req.method === 'GET') {
        const result = handleMetaGet(Object.fromEntries(url.searchParams.entries()), env.WHATSAPP_VERIFY_TOKEN);
        res.writeHead(result.ok ? 200 : (result.status || 403), {'content-type':'text/plain'});
        return res.end(result.ok ? String(result.challenge) : 'Forbidden');
      }
      if (url.pathname === '/webhook' && req.method === 'POST') {
        let raw=''; for await (const chunk of req) raw += chunk;
        const body = JSON.parse(raw || '{}');
        const result = await handleMetaPost({ body, repository, channel, ai, pilotPhoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID });
        res.writeHead(200, {'content-type':'application/json'}); return res.end(JSON.stringify(result));
      }
      res.writeHead(404); res.end('Not Found');
    } catch (e) {
      res.writeHead(500, {'content-type':'application/json'}); res.end(JSON.stringify({ok:false,error:'INTERNAL_ERROR'}));
    }
  });
}

module.exports = { createServer };
