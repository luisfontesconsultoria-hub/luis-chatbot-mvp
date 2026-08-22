/**
 * Supabase repository adapter.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY only on the server.
 * No credentials are hardcoded.
 */

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_NOT_CONFIGURED`);
  return value;
}

function headers() {
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

async function request(path, options = {}) {
  const base = requireEnv('SUPABASE_URL').replace(/\/$/, '');
  const response = await fetch(`${base}/rest/v1/${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) }
  });
  if (!response.ok) throw new Error(`SUPABASE_HTTP_${response.status}`);
  return response.status === 204 ? null : response.json();
}

async function findLeadByPhone(phone) {
  const encoded = encodeURIComponent(phone);
  const rows = await request(`leads?phone=eq.${encoded}&select=*`);
  return rows[0] || null;
}

async function upsertLead(data) {
  return request('leads?on_conflict=phone', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(data)
  });
}

async function saveMessage(data) {
  return request('messages', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(data)
  });
}

async function saveEvent(data) {
  return request('events', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(data)
  });
}

async function saveAudit(data) {
  return request('audit_log', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(data)
  });
}

module.exports = { findLeadByPhone, upsertLead, saveMessage, saveEvent, saveAudit };
