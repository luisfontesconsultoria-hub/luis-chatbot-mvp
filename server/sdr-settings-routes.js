/**
 * Rotas do painel para configurar o robô de vendas.
 * Todas exigem a sessão do CRM (a verificação é feita por quem chama, em routes.js).
 *
 *   GET  /api/sdr/settings                 modo de cada número, catálogo e situação da IA
 *   POST /api/sdr/slots/:n                 { mode, productId }
 *   POST /api/sdr/products                 cria ou atualiza um produto
 *   POST /api/sdr/products/:id/delete      remove um produto que não esteja em uso
 */
const { getSdrSettingsStore, MODES, LIMITS } = require('./sdr-settings');
const { getConfig } = require('./config');

const CLIENT_ERRORS = new Set([
  'INVALID_SLOT', 'INVALID_MODE', 'PRODUCT_REQUIRED_FOR_MODE', 'PRODUCT_INACTIVE', 'PRODUCT_NAME_REQUIRED',
  'PRODUCT_LINK_INVALID', 'PRODUCT_CODE_INVALID', 'PRODUCT_LIMIT_REACHED'
]);
const CONFLICT_ERRORS = new Set(['PRODUCT_ALREADY_EXISTS', 'PRODUCT_CODE_IN_USE', 'PRODUCT_IN_USE']);

function failure(error) {
  const code = String(error?.code || '');
  if (CLIENT_ERRORS.has(code)) return { status: 400, body: { error: code, field: error.field || null } };
  if (CONFLICT_ERRORS.has(code)) return { status: 409, body: { error: code, field: error.field || null } };
  if (code === 'PRODUCT_NOT_FOUND') return { status: 404, body: { error: code } };
  console.error('SDR_SETTINGS_WRITE_FAILED', { message: String(error?.message || error).slice(0, 160) });
  return { status: 500, body: { error: 'SDR_SETTINGS_WRITE_FAILED' } };
}

function snapshot(store, maxSlots, env) {
  const state = store.get();
  const config = getConfig(env);
  const slots = Array.from({ length: maxSlots }, (_, i) => {
    const cfg = state.slots[String(i + 1)] || { mode: 'OFF', productId: null };
    return { slot: i + 1, mode: cfg.mode, productId: cfg.productId };
  });
  return {
    modes: MODES, limits: LIMITS, slots, products: state.products,
    ai: { enabled: Boolean(config.aiAssistEnabled), provider: config.aiAssistEnabled ? config.aiProvider : null },
    persistent: store.persistent
  };
}

async function sdrSettingsRoute({ method, path, body = {}, maxSlots = 1, env = process.env, store = getSdrSettingsStore(env) }) {
  if (method === 'GET' && path === '/api/sdr/settings') return { status: 200, body: snapshot(store, maxSlots, env) };

  const slot = path.match(/^\/api\/sdr\/slots\/(\d+)$/);
  if (slot && method === 'POST') {
    const id = Number(slot[1]);
    if (id < 1 || id > maxSlots) return { status: 400, body: { error: 'INVALID_SLOT' } };
    try { return { status: 200, body: { ok: true, slot: store.setSlot(id, { mode: body.mode, productId: body.productId || null }) } }; }
    catch (error) { return failure(error); }
  }

  if (method === 'POST' && path === '/api/sdr/products') {
    try { return { status: 200, body: { ok: true, product: store.saveProduct(body) } }; }
    catch (error) { return failure(error); }
  }

  const remove = path.match(/^\/api\/sdr\/products\/([^/]+)\/delete$/);
  if (remove && method === 'POST') {
    try { return { status: 200, body: { ok: true, ...store.removeProduct(decodeURIComponent(remove[1])) } }; }
    catch (error) { return failure(error); }
  }

  return { status: 404, body: { error: 'SDR_ROUTE_NOT_FOUND' } };
}

module.exports = { sdrSettingsRoute };
