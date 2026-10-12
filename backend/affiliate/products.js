/**
 * Fichas de produto da operação de afiliados.
 *
 * Fonte: variável de ambiente AFFILIATE_PRODUCTS (JSON, lista de produtos).
 * O SDR de afiliado só afirma o que estiver na ficha. Campo ausente = o robô
 * não fala sobre o assunto e passa a dúvida para o Luís (sem inventar).
 *
 * Campos:
 *   code            (obrigatório) código curto usado no código de campanha, ex.: "PROD1"
 *   name            (obrigatório) nome do produto
 *   checkout_url    (obrigatório) link de afiliado (https)
 *   tracking_param  parâmetro de rastreio da plataforma (padrão "sck"; confirmar na plataforma)
 *   topic           tema/dor central, usado na pergunta de diagnóstico
 *   for_who         para quem o produto serve
 *   not_for         para quem o produto NÃO serve
 *   includes        o que vem dentro / como funciona
 *   price           preço e formas de pagamento, como o produtor divulga
 *   guarantee       garantia, como o produtor divulga
 *   bonuses         bônus reais
 *   aliases         lista de nomes alternativos para reconhecer o produto na conversa
 *   objections      lista de { keywords: [..], answer: ".." }
 */

function clean(value, max = 1200) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : null;
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function validHttpsUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeProduct(raw = {}) {
  const code = clean(raw.code, 40);
  const name = clean(raw.name, 160);
  const checkoutUrl = clean(raw.checkout_url || raw.checkoutUrl, 2000);
  if (!code || !/^[A-Za-z0-9_]+$/.test(code)) throw new Error('AFFILIATE_PRODUCT_CODE_INVALID');
  if (!name) throw new Error(`AFFILIATE_PRODUCT_NAME_REQUIRED:${code}`);
  if (!checkoutUrl || !validHttpsUrl(checkoutUrl)) throw new Error(`AFFILIATE_PRODUCT_CHECKOUT_URL_INVALID:${code}`);
  const trackingParam = clean(raw.tracking_param || raw.trackingParam, 40) || 'sck';
  if (!/^[A-Za-z0-9_]+$/.test(trackingParam)) throw new Error(`AFFILIATE_PRODUCT_TRACKING_PARAM_INVALID:${code}`);
  const objections = (Array.isArray(raw.objections) ? raw.objections : [])
    .map(item => ({
      keywords: (Array.isArray(item?.keywords) ? item.keywords : []).map(normalizeKey).filter(Boolean),
      answer: clean(item?.answer, 800)
    }))
    .filter(item => item.keywords.length && item.answer);
  return Object.freeze({
    code: code.toUpperCase(),
    name,
    checkoutUrl,
    trackingParam,
    topic: clean(raw.topic, 160),
    forWho: clean(raw.for_who || raw.forWho, 400),
    notFor: clean(raw.not_for || raw.notFor, 400),
    includes: clean(raw.includes, 800),
    price: clean(raw.price, 300),
    guarantee: clean(raw.guarantee, 300),
    bonuses: clean(raw.bonuses, 400),
    aliases: (Array.isArray(raw.aliases) ? raw.aliases : []).map(normalizeKey).filter(Boolean),
    objections
  });
}

function loadProducts(env = process.env) {
  const raw = String(env.AFFILIATE_PRODUCTS || '').trim();
  if (!raw) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('AFFILIATE_PRODUCTS_JSON_INVALID');
  }
  const list = Array.isArray(parsed) ? parsed : [parsed];
  const products = list.map(normalizeProduct);
  const codes = new Set();
  for (const product of products) {
    if (codes.has(product.code)) throw new Error(`AFFILIATE_PRODUCT_CODE_DUPLICATED:${product.code}`);
    codes.add(product.code);
  }
  return products;
}

function findProductByCode(products = [], code) {
  const wanted = String(code || '').trim().toUpperCase();
  if (!wanted) return null;
  return products.find(product => product.code === wanted) || null;
}

function findProductByText(products = [], text) {
  const q = normalizeKey(text);
  if (!q) return null;
  const matches = products.filter(product => {
    const names = [normalizeKey(product.name), ...product.aliases];
    return names.some(name => name && q.includes(name));
  });
  return matches.length === 1 ? matches[0] : null;
}

/** Texto da ficha usado como contexto da IA (a IA só reescreve, nunca acrescenta fatos). */
function productContext(product) {
  if (!product) return '';
  const lines = [
    `Produto: ${product.name}`,
    product.topic && `Tema: ${product.topic}`,
    product.forWho && `Para quem é: ${product.forWho}`,
    product.notFor && `Para quem não é: ${product.notFor}`,
    product.includes && `O que vem dentro: ${product.includes}`,
    product.price && `Preço: ${product.price}`,
    product.guarantee && `Garantia: ${product.guarantee}`,
    product.bonuses && `Bônus: ${product.bonuses}`
  ].filter(Boolean);
  return lines.join('\n');
}

module.exports = { loadProducts, normalizeProduct, findProductByCode, findProductByText, productContext, normalizeKey };
