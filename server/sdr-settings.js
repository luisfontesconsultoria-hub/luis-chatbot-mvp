/**
 * Configuração do robô de vendas: modo por número de WhatsApp e catálogo de produtos.
 *
 * O CRM não depende de um número específico. Cada número conectado (slot) tem um modo:
 *   OFF       o CRM só registra a conversa; o robô não responde (padrão).
 *   CONTA_PJ  roteiro comercial original (qualificação, CNPJ, consulta manual).
 *   PRODUCT   roteiro de venda de um produto do catálogo (anúncios / afiliados).
 *
 * Persistência: um arquivo JSON no mesmo disco persistente das sessões do WhatsApp.
 * Não usa o banco de propósito: evita migration em produção nesta fase. A interface
 * (get/slotConfig/setSlot/saveProduct/removeProduct) permite trocar por tabela depois.
 */
const fs = require('fs');
const path = require('path');
const { normalizeSource } = require('../backend/core/acquisition-sources');

const MODES = Object.freeze(['OFF', 'CONTA_PJ', 'PRODUCT']);
const MAX_SLOTS = 4;
const MAX_PRODUCTS = 50;
const LIMITS = Object.freeze({ name: 80, code: 20, pitch: 600, knowledge: 6000, price: 80, link: 500 });

function defaultFile(env = process.env) {
  if (env.SDR_SETTINGS_FILE) return env.SDR_SETTINGS_FILE;
  return path.join(env.WHATSAPP_QR_SESSION_DIR || '/tmp/luis-whatsapp-sessions', 'sdr-settings.json');
}

function settingsError(code, field) {
  const error = new Error(code);
  error.code = code;
  if (field) error.field = field;
  return error;
}

function text(value, max) { return String(value ?? '').replace(/\r\n/g, '\n').trim().slice(0, max); }

function slugify(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

function validLink(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && Boolean(url.hostname.includes('.')); }
  catch { return false; }
}

/** Normaliza e valida um produto vindo do painel. Lança erro com code/field para a interface. */
function normalizeProduct(input = {}, existingId = null) {
  const name = text(input.name, LIMITS.name);
  if (!name) throw settingsError('PRODUCT_NAME_REQUIRED', 'name');
  const link = text(input.link, LIMITS.link);
  if (!validLink(link)) throw settingsError('PRODUCT_LINK_INVALID', 'link');
  const code = text(input.code, LIMITS.code).toUpperCase();
  if (code && !/^[A-Z0-9]{3,20}$/.test(code)) throw settingsError('PRODUCT_CODE_INVALID', 'code');
  const id = existingId || slugify(input.id) || slugify(name);
  if (!id) throw settingsError('PRODUCT_NAME_REQUIRED', 'name');
  return {
    id, name, code: code || null, link,
    price: text(input.price, LIMITS.price) || null,
    pitch: text(input.pitch, LIMITS.pitch),
    knowledge: text(input.knowledge, LIMITS.knowledge),
    source: normalizeSource(input.source || 'GOOGLE_ADS'),
    active: input.active !== false
  };
}

function emptyState() { return { version: 1, slots: {}, products: [] }; }

function sanitizeState(raw) {
  const state = emptyState();
  if (!raw || typeof raw !== 'object') return state;
  for (const product of Array.isArray(raw.products) ? raw.products.slice(0, MAX_PRODUCTS) : []) {
    try { state.products.push(normalizeProduct(product, slugify(product?.id) || null)); } catch (_) { /* ignora registro inválido */ }
  }
  for (const [slot, cfg] of Object.entries(raw.slots && typeof raw.slots === 'object' ? raw.slots : {})) {
    const id = Number(slot);
    if (!Number.isInteger(id) || id < 1 || id > MAX_SLOTS) continue;
    const mode = MODES.includes(cfg?.mode) ? cfg.mode : 'OFF';
    const productId = state.products.some(p => p.id === cfg?.productId) ? cfg.productId : null;
    state.slots[String(id)] = { mode, productId };
  }
  return state;
}

function createSdrSettingsStore({ file = defaultFile(), fsImpl = fs } = {}) {
  let cache = null;

  function load() {
    if (cache) return cache;
    try { cache = sanitizeState(JSON.parse(fsImpl.readFileSync(file, 'utf8'))); }
    catch (error) {
      // Arquivo ausente é o estado inicial normal. Arquivo corrompido não pode
      // ligar o robô por acidente: cai no padrão seguro (tudo desligado).
      if (error?.code !== 'ENOENT') console.error('SDR_SETTINGS_READ_FAILED', { message: String(error?.message || error).slice(0, 160) });
      cache = emptyState();
    }
    return cache;
  }

  function persist(next) {
    fsImpl.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fsImpl.writeFileSync(tmp, JSON.stringify(next, null, 2), { mode: 0o600 });
    fsImpl.renameSync(tmp, file);
    cache = next;
  }

  function slotId(slot) {
    const id = Number(slot);
    if (!Number.isInteger(id) || id < 1 || id > MAX_SLOTS) throw settingsError('INVALID_SLOT', 'slot');
    return id;
  }

  return {
    file,
    /** Disco em /tmp some a cada deploy/restart: o painel avisa quando for o caso. */
    persistent: !/^\/tmp(\/|$)/.test(path.resolve(file)),

    get() {
      const state = load();
      return { products: state.products.map(p => ({ ...p })), slots: Object.fromEntries(Object.entries(state.slots).map(([k, v]) => [k, { ...v }])) };
    },

    /** Configuração efetiva de um número. Nunca lança: qualquer problema vira OFF. */
    slotConfig(slot) {
      const off = { mode: 'OFF', productId: null, products: [] };
      let id;
      try { id = slotId(slot); } catch (_) { return off; }
      const state = load();
      const cfg = state.slots[String(id)];
      if (!cfg) return { ...off, products: state.products };
      return { mode: cfg.mode, productId: cfg.productId, products: state.products };
    },

    setSlot(slot, { mode, productId = null } = {}) {
      const id = slotId(slot);
      const nextMode = String(mode || '').toUpperCase();
      if (!MODES.includes(nextMode)) throw settingsError('INVALID_MODE', 'mode');
      const state = load();
      let nextProduct = null;
      if (nextMode === 'PRODUCT') {
        const product = state.products.find(p => p.id === productId);
        if (!product) throw settingsError('PRODUCT_REQUIRED_FOR_MODE', 'productId');
        if (product.active === false) throw settingsError('PRODUCT_INACTIVE', 'productId');
        nextProduct = product.id;
      }
      const next = { ...state, slots: { ...state.slots, [String(id)]: { mode: nextMode, productId: nextProduct } } };
      persist(next);
      return { slot: id, ...next.slots[String(id)] };
    },

    saveProduct(input = {}) {
      const state = load();
      const requestedId = slugify(input.id);
      const existing = requestedId ? state.products.find(p => p.id === requestedId) : null;
      const product = normalizeProduct(input, existing?.id || null);
      if (!existing) {
        if (state.products.length >= MAX_PRODUCTS) throw settingsError('PRODUCT_LIMIT_REACHED');
        if (state.products.some(p => p.id === product.id)) throw settingsError('PRODUCT_ALREADY_EXISTS', 'name');
      }
      if (product.code && state.products.some(p => p.id !== product.id && p.code === product.code)) throw settingsError('PRODUCT_CODE_IN_USE', 'code');
      if (!product.active && Object.values(state.slots).some(s => s.mode === 'PRODUCT' && s.productId === product.id)) throw settingsError('PRODUCT_IN_USE', 'active');
      const products = existing ? state.products.map(p => (p.id === product.id ? product : p)) : [...state.products, product];
      persist({ ...state, products });
      return { ...product };
    },

    removeProduct(id) {
      const state = load();
      const key = slugify(id);
      if (!state.products.some(p => p.id === key)) throw settingsError('PRODUCT_NOT_FOUND');
      if (Object.values(state.slots).some(s => s.productId === key)) throw settingsError('PRODUCT_IN_USE');
      persist({ ...state, products: state.products.filter(p => p.id !== key) });
      return { removed: key };
    }
  };
}

let shared = null;
/** Instância única por processo: painel e robô leem a mesma configuração. */
function getSdrSettingsStore(env = process.env) {
  if (!shared) shared = createSdrSettingsStore({ file: defaultFile(env) });
  return shared;
}

module.exports = { MODES, MAX_SLOTS, LIMITS, defaultFile, normalizeProduct, slugify, createSdrSettingsStore, getSdrSettingsStore };
