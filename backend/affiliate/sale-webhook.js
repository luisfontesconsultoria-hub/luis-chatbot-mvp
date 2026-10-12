/**
 * Webhook de venda da plataforma de afiliados → CRM.
 *
 * Endpoint: POST /webhooks/affiliate-sale  (ver server/routes.js)
 * Autenticação: AFFILIATE_WEBHOOK_SECRET, enviado no header `x-affiliate-secret`
 * ou no parâmetro `?token=` (muitas plataformas só permitem configurar a URL).
 *
 * Formato: genérico. O lead é encontrado pelo token de rastreio (L + 32 hex) que o
 * SDR colocou no link de compra — procurado nos campos conhecidos e, se não
 * estiver neles, em qualquer campo do payload. Isso funciona com plataformas
 * diferentes sem depender do formato exato de cada uma. Um parser específico por
 * plataforma pode ser adicionado quando a plataforma for escolhida.
 *
 * Privacidade: só guardamos transação, status, comissão e produto. Nome/e-mail
 * do comprador recebidos no payload não são persistidos.
 */
const crypto = require('crypto');
const { leadIdFromTrackingToken } = require('./tracking');

const TOKEN_RX = /L[0-9a-f]{32}/i;
const APPROVED_RX = /^(approved|aprovad\w*|complete|completed|paid|pago|purchase_approved|purchase_complete|order_approved|venda_aprovada)$/i;
const REFUND_RX = /(refund|reembols|chargeback|cancel|estorn|dispute|protest)/i;

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (!left.length || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function authorizeSaleWebhook({ secret, headers = {}, query = {} }) {
  if (!secret) return { ok: false, status: 503, error: 'AFFILIATE_WEBHOOK_NOT_CONFIGURED' };
  const provided = headers['x-affiliate-secret'] || query.token || '';
  if (!safeEqual(provided, secret)) return { ok: false, status: 401, error: 'AFFILIATE_WEBHOOK_UNAUTHORIZED' };
  return { ok: true };
}

function pick(obj, paths) {
  for (const path of paths) {
    let value = obj;
    for (const key of path.split('.')) value = value == null ? undefined : value[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return null;
}

function deepFindToken(value, depth = 0) {
  if (depth > 6 || value == null) return null;
  if (typeof value === 'string') { const m = value.match(TOKEN_RX); return m ? m[0] : null; }
  if (Array.isArray(value)) { for (const item of value) { const found = deepFindToken(item, depth + 1); if (found) return found; } return null; }
  if (typeof value === 'object') { for (const item of Object.values(value)) { const found = deepFindToken(item, depth + 1); if (found) return found; } }
  return null;
}

function toNumber(value) {
  if (value == null) return null;
  const n = Number(String(value).replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function normalizeSalePayload(body = {}) {
  const transactionId = pick(body, ['transaction_id', 'transaction', 'order_id', 'data.purchase.transaction', 'data.transaction', 'data.order_id', 'id']);
  const rawStatus = pick(body, ['status', 'event', 'purchase_status', 'data.purchase.status', 'data.status', 'order_status']);
  const explicitToken = pick(body, ['tracking', 'sck', 'src', 'data.purchase.origin.sck', 'data.purchase.origin.src', 'tracking_code']);
  const token = (explicitToken && String(explicitToken).match(TOKEN_RX)?.[0]) || deepFindToken(body);
  const statusText = String(rawStatus || '').trim();
  const kind = APPROVED_RX.test(statusText) ? 'APPROVED' : REFUND_RX.test(statusText) ? 'REFUNDED' : 'OTHER';
  return {
    transactionId: transactionId ? String(transactionId).slice(0, 120) : null,
    rawStatus: statusText.slice(0, 60) || null,
    kind,
    token,
    leadId: token ? leadIdFromTrackingToken(token) : null,
    commission: toNumber(pick(body, ['commission', 'commission_value', 'affiliate_commission', 'data.commissions.0.value', 'data.commission'])),
    currency: String(pick(body, ['currency', 'currency_value', 'data.purchase.price.currency_value']) || 'BRL').slice(0, 8),
    productCode: pick(body, ['product_code', 'product_id', 'data.product.id']) ? String(pick(body, ['product_code', 'product_id', 'data.product.id'])).slice(0, 60) : null,
    platform: String(pick(body, ['platform']) || '').slice(0, 30) || null
  };
}

async function alreadyProcessed(repository, leadId, key) {
  if (typeof repository.listEvents !== 'function') return false;
  const rows = await repository.listEvents({ leadId, type: 'AFFILIATE_SALE', limit: 200 });
  return (rows || []).some(row => row?.idempotency_key === key);
}

async function handleAffiliateSale({ repository, body, platform = null }) {
  if (!repository) return { status: 503, body: { error: 'PERSISTENCE_NOT_CONFIGURED' } };
  const sale = normalizeSalePayload(body || {});
  if (!sale.transactionId) return { status: 400, body: { error: 'TRANSACTION_ID_REQUIRED' } };
  const key = `AFFILIATE_SALE:${sale.transactionId}:${sale.kind}`;
  const payload = { transactionId: sale.transactionId, rawStatus: sale.rawStatus, kind: sale.kind, commission: sale.commission, currency: sale.currency, productCode: sale.productCode, platform: platform || sale.platform };

  const lead = sale.leadId ? await repository.getLead(sale.leadId) : null;
  if (!lead) {
    await repository.createEvent({ lead_id: null, type: 'AFFILIATE_SALE_UNMATCHED', idempotency_key: `UNMATCHED:${key}`, payload: { ...payload, hasToken: Boolean(sale.token) } });
    return { status: 202, body: { received: true, matched: false } };
  }
  if (await alreadyProcessed(repository, lead.id, key)) return { status: 200, body: { received: true, matched: true, duplicate: true } };

  await repository.createEvent({ lead_id: lead.id, type: 'AFFILIATE_SALE', idempotency_key: key, payload });

  if (sale.kind === 'OTHER') return { status: 200, body: { received: true, matched: true, applied: false, kind: sale.kind } };

  const patch = sale.kind === 'APPROVED'
    ? { stage: 'CONVERTIDO', status: 'AF_SOLD', nextAction: 'POS_VENDA', updatedAt: new Date().toISOString() }
    : { stage: 'REEMBOLSADO', nextAction: 'VERIFICAR_REEMBOLSO', updatedAt: new Date().toISOString() };
  await repository.updateLead(lead.id, patch);
  await repository.createAudit({
    lead_id: lead.id,
    action: sale.kind === 'APPROVED' ? 'AFFILIATE_SALE_APPROVED' : 'AFFILIATE_SALE_REFUNDED',
    from_status: lead.status || null,
    to_status: patch.status || lead.status || null,
    from_stage: lead.stage || null,
    to_stage: patch.stage,
    actor: 'AFFILIATE_WEBHOOK',
    metadata: payload
  });
  return { status: 200, body: { received: true, matched: true, applied: true, kind: sale.kind } };
}

module.exports = { authorizeSaleWebhook, normalizeSalePayload, handleAffiliateSale, safeEqual };
