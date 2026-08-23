const http = require('http');
const { routeRequest } = require('./routes');
const PORT = Number(process.env.PORT || 10000);
const MAX_BODY_BYTES = 256 * 1024;

const server = http.createServer((req, res) => {
  let rawBody = '';
  let size = 0;
  let tooLarge = false;

  req.setTimeout(15000, () => req.destroy());

  req.on('data', chunk => {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      tooLarge = true;
      req.destroy();
      return;
    }
    rawBody += chunk.toString('utf8');
  });

  req.on('end', async () => {
    if (tooLarge) {
      res.statusCode = 413;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error:'PAYLOAD_TOO_LARGE' }));
      return;
    }

    let body = {};
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error:'INVALID_JSON' }));
      return;
    }

    const url = new URL(req.url || '/', 'http://localhost');

    try {
      const result = await routeRequest({
        method: req.method,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams.entries()),
        body,
        rawBody,
        signatureHeader: req.headers['x-hub-signature-256'] || ''
      });
      res.statusCode = result.status;
      res.setHeader('Content-Type', result.text ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8');
      res.end(result.text ? String(result.body) : JSON.stringify(result.body));
    } catch (error) {
      console.error('HTTP_HANDLER_ERROR', error?.message || 'INTERNAL_SERVER_ERROR');
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error:'INTERNAL_SERVER_ERROR' }));
    }
  });
});

if (require.main === module) server.listen(PORT, '0.0.0.0');
module.exports = { server };
