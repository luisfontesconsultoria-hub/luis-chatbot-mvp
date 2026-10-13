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
const TONES = Object.freeze(['NEUTRO', 'PROXIMO', 'FORMAL', 'DIRETO']);
const OUTSIDE_HOURS = Object.freeze(['AWAY', 'SILENT']);
const MAX_SLOTS = 4;
const MAX_PRODUCTS = 50;
const MAX_OBJECTIONS = 20;
const LIMITS = Object.freeze({
  name: 80, code: 20, pitch: 600, knowledge: 6000, price: 80, link: 500,
  trackingParam: 30, objectionAnswer: 600, objectionKeyword: 60, awayMessage: 400,
  maxRepliesMin: 3, maxRepliesMax: 30, delayMaxSeconds: 20
});
const DEFAULT_MAX_REPLIES = 12;
const DEFAULT_AWAY_MESSAGE = 'Olá! Recebemos sua mensagem. Nosso atendimento é das {inicio} às {fim}. Assim que abrirmos, te respondemos por aqui.';

/** Comportamento de atendimento de um número: tempo de resposta e horário. */
function defaultBehavior() {
  return {
    delayMin: 0, delayMax: 0, typing: true,
    hours: { enabled: false, start: '08:00', end: '20:00', days: [1, 2, 3, 4, 5, 6], outside: 'AWAY', awayMessage: '' }
  };
}

function plainKeyword(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.objectionKeyword);
}

/**
 * Objeções com resposta aprovada. Aceita a lista estruturada ou o texto do painel,
 * uma por linha: "sem tempo, nao tenho tempo => Resposta aprovada".
 */
function normalizeObjections(input) {
  let items = [];
  if (Array.isArray(input)) items = input;
  else if (typeof input === 'string') {
    items = input.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
      const at = line.indexOf('=>');
      if (at < 0) throw settingsError('OBJECTION_FORMAT_INVALID', 'objections');
      return { keywords: line.slice(0, at).split(','), answer: line.slice(at + 2) };
    });
  }
  const out = [];
  for (const item of items.slice(0, MAX_OBJECTIONS)) {
    const keywords = (Array.isArray(item?.keywords) ? item.keywords : String(item?.keywords || '').split(','))
      .map(plainKeyword).filter(k => k.length >= 3).slice(0, 10);
    const answer = text(item?.answer, LIMITS.objectionAnswer);
    if (!keywords.length || !answer) throw settingsError('OBJECTION_FORMAT_INVALID', 'objections');
    out.push({ keywords, answer });
  }
  return out;
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Valida tempo de resposta e horário vindos do painel. Lança erro com code/field. */
function normalizeBehavior(input = {}, current = defaultBehavior()) {
  const base = { ...current, hours: { ...current.hours } };
  const delayMin = input.delayMin === undefined ? base.delayMin : clampInt(input.delayMin, 0, LIMITS.delayMaxSeconds, 0);
  const delayMax = input.delayMax === undefined ? base.delayMax : clampInt(input.delayMax, 0, LIMITS.delayMaxSeconds, 0);
  if (delayMax < delayMin) throw settingsError('DELAY_RANGE_INVALID', 'delayMax');
  const typing = input.typing === undefined ? base.typing : input.typing !== false && input.typing !== 'false';
  const h = input.hours && typeof input.hours === 'object' ? input.hours : {};
  const enabled = h.enabled === undefined ? base.hours.enabled : h.enabled === true || h.enabled === 'true';
  const start = h.start === undefined ? base.hours.start : String(h.start).trim();
  const end = h.end === undefined ? base.hours.end : String(h.end).trim();
  if (!HHMM.test(start)) throw settingsError('HOURS_INVALID', 'hours.start');
  if (!HHMM.test(end)) throw settingsError('HOURS_INVALID', 'hours.end');
  if (start === end) throw settingsError('HOURS_INVALID', 'hours.end');
  let days = h.days === undefined ? base.hours.days : h.days;
  if (typeof days === 'string') days = days.split(',');
  days = [...new Set((Array.isArray(days) ? days : []).map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  if (enabled && !days.length) throw settingsError('HOURS_DAYS_REQUIRED', 'hours.days');
  const outside = h.outside === undefined ? base.hours.outside : String(h.outside).toUpperCase();
  if (!OUTSIDE_HOURS.includes(outside)) throw settingsError('HOURS_INVALID', 'hours.outside');
  const awayMessage = h.awayMessage === undefined ? base.hours.awayMessage : text(h.awayMessage, LIMITS.awayMessage);
  return { delayMin, delayMax, typing, hours: { enabled, start, end, days, outside, awayMessage } };
}

function safeBehavior(raw) {
  try { return normalizeBehavior(raw || {}); } catch (_) { return defaultBehavior(); }
}

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
  const trackingParam = text(input.trackingParam, LIMITS.trackingParam);
  if (trackingParam && !/^[A-Za-z0-9_]{1,30}$/.test(trackingParam)) throw settingsError('PRODUCT_TRACKING_PARAM_INVALID', 'trackingParam');
  const tone = String(input.tone || 'NEUTRO').toUpperCase();
  if (!TONES.includes(tone)) throw settingsError('PRODUCT_TONE_INVALID', 'tone');
  return {
    id, name, code: code || null, link,
    price: text(input.price, LIMITS.price) || null,
    pitch: text(input.pitch, LIMITS.pitch),
    knowledge: text(input.knowledge, LIMITS.knowledge),
    source: normalizeSource(input.source || 'GOOGLE_ADS'),
    active: input.active !== false && input.active !== 'false',
    trackingParam: trackingParam || null,
    tone,
    aiEnabled: input.aiEnabled !== false && input.aiEnabled !== 'false',
    maxReplies: clampInt(input.maxReplies, LIMITS.maxRepliesMin, LIMITS.maxRepliesMax, DEFAULT_MAX_REPLIES),
    objections: normalizeObjections(input.objections ?? [])
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
    state.slots[String(id)] = { mode, productId, ...safeBehavior(cfg) };
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
      return {
        products: state.products.map(p => ({ ...p, objections: p.objections.map(o => ({ keywords: [...o.keywords], answer: o.answer })) })),
        slots: Object.fromEntries(Object.entries(state.slots).map(([k, v]) => [k, { ...v, hours: { ...v.hours, days: [...v.hours.days] } }]))
      };
    },

    /** Configuração efetiva de um número. Nunca lança: qualquer problema vira OFF. */
    slotConfig(slot) {
      const off = { mode: 'OFF', productId: null, products: [], ...defaultBehavior() };
      let id;
      try { id = slotId(slot); } catch (_) { return off; }
      const state = load();
      const cfg = state.slots[String(id)];
      if (!cfg) return { ...off, products: state.products };
      return { ...cfg, hours: { ...cfg.hours }, products: state.products };
    },

    /**
     * Grava o modo e o comportamento de um número. Campos de comportamento omitidos
     * mantêm o valor atual, então o painel pode salvar só o que mudou.
     */
    setSlot(slot, { mode, productId = null, ...behavior } = {}) {
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
      const current = state.slots[String(id)];
      const nextBehavior = normalizeBehavior(behavior, current ? { delayMin: current.delayMin, delayMax: current.delayMax, typing: current.typing, hours: current.hours } : defaultBehavior());
      const next = { ...state, slots: { ...state.slots, [String(id)]: { mode: nextMode, productId: nextProduct, ...nextBehavior } } };
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

module.exports = {
  MODES, TONES, OUTSIDE_HOURS, MAX_SLOTS, LIMITS, DEFAULT_MAX_REPLIES, DEFAULT_AWAY_MESSAGE,
  defaultFile, defaultBehavior, normalizeProduct, normalizeBehavior, normalizeObjections, slugify,
  createSdrSettingsStore, getSdrSettingsStore
};
