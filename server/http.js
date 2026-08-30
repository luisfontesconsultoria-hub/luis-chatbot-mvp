const http = require('http');
const { routeRequest } = require('./routes');
const { createProductionRuntime } = require('./runtime');
const { route: crmActionRoute } = require('./crm-actions');
const { importLeads } = require('./lead-import');
const auth = require('./auth');
const { appointmentsRoute } = require('../backend/appointments-api');

const PORT = Number(process.env.PORT || 10000);
const MAX_BODY_BYTES = 256 * 1024;
const appointmentRuntime = createProductionRuntime();

function parseCookies(header='') {
  const out = {};
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function authorized(headers={}) {
  const value = String(headers.authorization || '');
  if (!value.startsWith('Bearer ')) return false;
  return Boolean(auth.authenticate(value.slice(7)));
}
function withScripts(result) {
  if (!result?.raw || !Buffer.isBuffer(result.body)) return result;
  const html = result.body.toString('utf8');
  if (!html.includes('</body>')) return result;
  let updated = html;
  if (!updated.includes('/appointments.js')) updated = updated.replace('</body>', '<script src="/appointments.js?v=20260829-1"></script></body>');
  if (!updated.includes('/crm-enhancements.js')) updated = updated.replace('</body>', '<script src="/crm-enhancements.js?v=20260830-2"></script></body>');
  if (!updated.includes('/lead-import.js')) updated = updated.replace('</body>', '<script src="/lead-import.js?v=20260830-1"></script></body>');
  result.body = Buffer.from(updated, 'utf8');
  return result;
}

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
    const headers = { ...req.headers };
    const cookies = parseCookies(req.headers.cookie || '');
    if (!headers.authorization && cookies.crm_session) {
      headers['x-crm-token'] = cookies.crm_session;
      headers.authorization = `Bearer ${cookies.crm_session}`;
    }

    try {
      let result;
      if (url.pathname === '/api/crm/leads/import' && req.method === 'POST') {
        result = authorized(headers)
          ? await importLeads({ repository: appointmentRuntime.repository, rows: body?.leads })
          : { status:401, body:{ error:'CRM_AUTH_REQUIRED' } };
      } else if (url.pathname.startsWith('/api/crm/leads/') && (req.method === 'PATCH' || (req.method === 'POST' && url.pathname.endsWith('/messages')))) {
        result = authorized(headers)
          ? await crmActionRoute({ method:req.method, path:url.pathname, body })
          : { status:401, body:{ error:'CRM_AUTH_REQUIRED' } };
      } else if (url.pathname.startsWith('/api/crm/appointments')) {
        result = authorized(headers)
          ? await appointmentsRoute({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams.entries()), body, runtime: appointmentRuntime })
          : { status: 401, body: { error: 'CRM_AUTH_REQUIRED' } };
      } else {
        result = await routeRequest({
          method: req.method,
          path: url.pathname,
          query: Object.fromEntries(url.searchParams.entries()),
          body,
          rawBody,
          signatureHeader: req.headers['x-hub-signature-256'] || '',
          headers
        });
      }
      result = withScripts(result);

      res.statusCode = result.status;
      res.setHeader('Content-Type', result.contentType || (result.text ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8'));
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');

      if (req.method === 'POST' && url.pathname === '/api/auth/login' && result.status === 200 && result.body?.token) {
        res.setHeader('Set-Cookie', `crm_session=${encodeURIComponent(result.body.token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`);
      }
      if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
        res.setHeader('Set-Cookie', 'crm_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
      }

      const responseBody = result.raw ? result.body : (result.text ? String(result.body) : JSON.stringify(result.body));
      res.end(responseBody);
    } catch (error) {
      console.error(JSON.stringify({
        event: 'HTTP_HANDLER_ERROR',
        method: req.method,
        path: url.pathname,
        code: String(error?.code || 'UNKNOWN_ERROR'),
        message: String(error?.message || 'INTERNAL_SERVER_ERROR')
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

if (require.main === module) server.listen(PORT, '0.0.0.0');

module.exports = { server };
