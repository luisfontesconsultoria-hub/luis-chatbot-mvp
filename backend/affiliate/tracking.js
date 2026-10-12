/**
 * Rastreamento da operação de afiliados.
 *
 * 1. Código de campanha na 1ª mensagem do WhatsApp (pré-preenchida pela página ponte):
 *      #G-PROD1-K03  →  canal G (Google Ads), produto PROD1, anúncio/palavra K03
 *      #M-PROD1-C02  →  canal M (Meta Ads)
 * 2. Token do lead no link de compra: o id do lead (uuid sem hífens, prefixo "L")
 *    vai no parâmetro de rastreio da plataforma. O webhook de venda devolve esse
 *    valor e o CRM encontra o lead sem tabela extra.
 */

const CHANNELS = Object.freeze({ G: 'GOOGLE_ADS', M: 'META_ADS', O: 'ORGANICO', I: 'INSTAGRAM' });
const CAMPAIGN_CODE = /#([A-Za-z])-([A-Za-z0-9_]{1,40})(?:-([A-Za-z0-9_]{1,40}))?/;

function parseCampaignCode(text) {
  const match = String(text || '').match(CAMPAIGN_CODE);
  if (!match) return null;
  const channelKey = match[1].toUpperCase();
  return {
    code: match[0].slice(1).toUpperCase(),
    channel: CHANNELS[channelKey] || 'OUTRO',
    productCode: match[2].toUpperCase(),
    adCode: match[3] ? match[3].toUpperCase() : null
  };
}

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

function buildTrackedLink(product, leadId) {
  if (!product?.checkoutUrl) throw new Error('AFFILIATE_PRODUCT_CHECKOUT_URL_REQUIRED');
  const url = new URL(product.checkoutUrl);
  url.searchParams.set(product.trackingParam || 'sck', leadTrackingToken(leadId));
  return url.toString();
}

module.exports = { parseCampaignCode, leadTrackingToken, leadIdFromTrackingToken, buildTrackedLink, CHANNELS };
