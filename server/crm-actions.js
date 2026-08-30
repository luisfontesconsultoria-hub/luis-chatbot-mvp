const { createProductionRuntime } = require('./runtime');
const { createQrManager } = require('./qr-manager-factory');

const runtime = createProductionRuntime();
const qrManager = runtime.repository ? createQrManager({ repository: runtime.repository }) : null;

function clean(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

function normalizePatch(body = {}) {
  const allowed = [
    'name','phone','cnpj','companyName','tradeName','interest','bankCurrent','machineCurrent',
    'monthlyRevenue','painPoint','owner','nextAction','status','source','campaign',
    'address','addressNumber','neighborhood','city','state','zipCode','companyStatus'
  ];
  const out = {};
  for (const key of allowed) if (body[key] !== undefined) out[key] = clean(body[key]);
  if (out.phone !== undefined) out.phone = out.phone ? String(out.phone).replace(/\D/g,'') : null;
  if (out.cnpj !== undefined) out.cnpj = out.cnpj ? String(out.cnpj).replace(/\D/g,'') : null;
  if (out.monthlyRevenue !== undefined && out.monthlyRevenue !== null) {
    const n = Number(String(out.monthlyRevenue).replace(',','.'));
    out.monthlyRevenue = Number.isFinite(n) ? n : null;
  }
  if (out.state) out.state = String(out.state).toUpperCase().slice(0,2);
  return out;
}

async function route({ method, path, body }) {
  if (!runtime.repository) return { status:503, body:{ error:'CRM_DATABASE_NOT_CONFIGURED' } };

  const edit = path.match(/^\/api\/crm\/leads\/([^/]+)$/);
  if (edit && method === 'PATCH') {
    const id = decodeURIComponent(edit[1]);
    const lead = await runtime.repository.getLead(id);
    if (!lead) return { status:404, body:{ error:'LEAD_NOT_FOUND' } };
    const patch = normalizePatch(body);
    if (!Object.keys(patch).length) return { status:400, body:{ error:'NO_FIELDS_TO_UPDATE' } };
    let updated;
    try {
      updated = await runtime.repository.updateLead(id, patch);
    } catch (error) {
      console.error('LEAD_UPDATE_FAILED', { code:error?.code||null, message:error?.message||'PERSISTENCE_ERROR' });
      return { status:500, body:{ error:'LEAD_UPDATE_FAILED', detail:{ code:error?.code||null, message:String(error?.message||'PERSISTENCE_ERROR').slice(0,220) } } };
    }
    // Audit is intentionally best-effort: a healthy lead update must never be
    // reported as failed merely because the secondary audit table is unavailable.
    try {
      await runtime.repository.createAudit({
        lead_id:id,
        action:'LEAD_UPDATED_MANUALLY',
        from_status:lead.status || null,
        to_status:updated.status || lead.status || null,
        actor:'LUIS',
        metadata:{ fields:Object.keys(patch) }
      });
    } catch (error) {
      console.error('LEAD_UPDATE_AUDIT_FAILED', { code:error?.code||null, message:error?.message||'AUDIT_PERSISTENCE_ERROR', lead_id:id });
    }
    return { status:200, body:{ ok:true, lead:updated, audit:'BEST_EFFORT' } };
  }

  const send = path.match(/^\/api\/crm\/leads\/([^/]+)\/messages$/);
  if (send && method === 'POST') {
    const id = decodeURIComponent(send[1]);
    const lead = await runtime.repository.getLead(id);
    if (!lead) return { status:404, body:{ error:'LEAD_NOT_FOUND' } };
    const text = clean(body?.text);
    if (!text) return { status:400, body:{ error:'OUTBOUND_TEXT_REQUIRED' } };
    if (!qrManager) return { status:503, body:{ error:'WHATSAPP_MANAGER_NOT_READY' } };
    const connected = qrManager.list().find(s => String(s.status).toUpperCase() === 'CONNECTED');
    if (!connected) return { status:409, body:{ error:'WHATSAPP_QR_NOT_CONNECTED' } };
    const response = await qrManager.send(connected.slot, { to:lead.phone, text });
    const providerMessageId = response?.key?.id || null;
    const saved = await runtime.repository.createMessage({
      lead_id:id, channel:'WHATSAPP', direction:'OUTBOUND',
      external_message_id:providerMessageId, text_content:text,
      metadata:{ provider:'BAILEYS_QR', slot:connected.slot }
    });
    await runtime.repository.createEvent({
      lead_id:id, type:'WHATSAPP_RESPONSE_SENT',
      idempotency_key:providerMessageId ? `WHATSAPP_RESPONSE_SENT:${providerMessageId}` : null,
      payload:{ external_message_id:providerMessageId, provider:'BAILEYS_QR', slot:connected.slot }
    });
    return { status:201, body:{ ok:true, message:saved } };
  }

  return { status:404, body:{ error:'CRM_ACTION_ROUTE_NOT_FOUND' } };
}

module.exports = { route, normalizePatch };
