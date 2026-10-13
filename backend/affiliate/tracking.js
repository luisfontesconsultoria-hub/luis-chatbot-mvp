/**
 * Rastreamento da operação de afiliados.
 *
 * Token do lead no link de compra: o id do lead (uuid sem hífens, prefixo "L")
 *    vai no parâmetro de rastreio da plataforma. O webhook de venda devolve esse
 *    valor e o CRM encontra o lead sem tabela extra.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function leadTrackingToken(leadId) {
  const id = String(leadId || '').trim();
  if (UUID.test(id)) return `L${id.replace(/-/g, '').toLowerCase()}`;
  // ids não-uuid (testes / bases antigas): só aceita caracteres seguros
  if (/^[A-Za-z0-9_]{1,64}$/.test(id)) return `L${id}`;
  throw new Error('LEAD_ID_NOT_TRACKABLE');
}

function leadIdFromTrackingToken(token) {
  const raw = String(token || '').trim();
  const match = raw.match(/L([0-9a-f]{32})/i);
  if (match) {
    const h = match[1].toLowerCase();
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  const plain = raw.match(/^L([A-Za-z0-9_]{1,64})$/);
  return plain ? plain[1] : null;
}

/**
 * Link de compra com o token do lead no parâmetro de rastreio da plataforma.
 * Sem parâmetro configurado no produto, devolve o link original sem alteração.
 */
function buildTrackedLink(product, leadId) {
  const base = product?.link || product?.checkoutUrl;
  if (!base) throw new Error('AFFILIATE_PRODUCT_LINK_REQUIRED');
  if (!product.trackingParam) return base;
  const url = new URL(base);
  url.searchParams.set(product.trackingParam, leadTrackingToken(leadId));
  return url.toString();
}

module.exports = { leadTrackingToken, leadIdFromTrackingToken, buildTrackedLink };
