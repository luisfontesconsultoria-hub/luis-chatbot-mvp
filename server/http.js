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
      res.end(JSON.stringify({ error: 'PAYLOAD_TOO_LARGE' }));
      return;
    }

    let body = {};
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'INVALID_JSON' }));
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
        signatureHeader: req.headers['x-hub-signature-256'] || '',
        headers: req.headers
      });

      res.statusCode = result.status;
      res.setHeader(
        'Content-Type',
        result.contentType || (result.text ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8')
      );
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');

      let responseBody = result.raw
        ? result.body
        : (result.text ? String(result.body) : JSON.stringify(result.body));

      if (result.raw && String(result.contentType || '').startsWith('text/html')) {
        const html = Buffer.isBuffer(responseBody)
          ? responseBody.toString('utf8')
          : String(responseBody);
        const bootstrap = `<script>(function(){try{if(typeof nav==='function')nav();var f=document.getElementById('login-form');if(f&&!f.dataset.crmGuard){f.dataset.crmGuard='1';f.addEventListener('submit',function(e){e.preventDefault();e.stopImmediatePropagation();if(typeof doLogin==='function')doLogin(e)},true)}if(typeof state!=='undefined'&&state.token&&typeof showApp==='function'){showApp();if(typeof load==='function')load()}}catch(e){console.error('CRM_BOOTSTRAP_FAILED',e)}})();</script>`;
        responseBody = html.replace('</body>', bootstrap + '</body>');
      }

      res.end(responseBody);
    } catch (error) {
      const code = String(error?.code || 'UNKNOWN_ERROR');
      const message = String(error?.message || 'INTERNAL_SERVER_ERROR');
      console.error(JSON.stringify({
        event: 'HTTP_HANDLER_ERROR',
        method: req.method,
        path: url.pathname,
        code,
        message,
        stack: error?.stack?.split('\n').slice(0, 6).join('\n')
      }));
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.end(JSON.stringify({
        error: 'INTERNAL_SERVER_ERROR',
        requestId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      }));
    }
  });
});

if (require.main === module) {
  server.listen(PORT, '0.0.0.0');
}

module.exports = { server };
