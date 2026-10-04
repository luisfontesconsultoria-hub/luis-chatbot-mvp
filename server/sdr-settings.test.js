const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createSdrSettingsStore, normalizeProduct, defaultFile } = require('./sdr-settings');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdr-settings-'));
const file = path.join(dir, 'nested', 'sdr-settings.json');
const code = fn => { try { fn(); } catch (e) { return e.code; } return null; };

try {
  const store = createSdrSettingsStore({ file });

  // Padrão seguro: sem configuração, todo número fica desligado
  assert.equal(store.slotConfig(1).mode, 'OFF');
  assert.equal(store.slotConfig(4).mode, 'OFF');
  assert.equal(store.slotConfig(9).mode, 'OFF', 'slot inválido nunca liga o robô');
  assert.equal(store.slotConfig('abc').mode, 'OFF');
  assert.deepEqual(store.get(), { products: [], slots: {} });

  // Validação de produto
  assert.equal(code(() => store.saveProduct({ link: 'https://exemplo.com/p' })), 'PRODUCT_NAME_REQUIRED');
  assert.equal(code(() => store.saveProduct({ name: 'X', link: 'http://exemplo.com/p' })), 'PRODUCT_LINK_INVALID', 'só https');
  assert.equal(code(() => store.saveProduct({ name: 'X', link: 'javascript:alert(1)' })), 'PRODUCT_LINK_INVALID');
  assert.equal(code(() => store.saveProduct({ name: 'X', link: 'https://exemplo.com/p', code: 'a b' })), 'PRODUCT_CODE_INVALID');
  assert.equal(code(() => store.saveProduct({ name: 'X', link: 'https://exemplo.com/p', code: 'AB' })), 'PRODUCT_CODE_INVALID');

  const created = store.saveProduct({ name: 'Método X', code: 'emag', link: 'https://exemplo.com/metodo-x', price: 'R$ 197,00', pitch: '  Curso prático.  ', knowledge: 'Acesso por 12 meses.' });
  assert.equal(created.id, 'metodo-x');
  assert.equal(created.code, 'EMAG');
  assert.equal(created.pitch, 'Curso prático.');
  assert.equal(created.source, 'GOOGLE_ADS');
  assert.equal(created.active, true);
  assert.equal(normalizeProduct({ name: 'Y', link: 'https://exemplo.com/y', source: 'qualquer' }).source, 'DIRECT', 'origem fora da lista vira DIRECT');
  assert.equal(normalizeProduct({ name: 'Y', link: 'https://exemplo.com/y', source: 'meta_ads' }).source, 'META_ADS');
  assert.equal(normalizeProduct({ name: 'Y', link: 'https://exemplo.com/y', pitch: 'a'.repeat(5000) }).pitch.length, 600);

  // Duplicidade
  assert.equal(code(() => store.saveProduct({ name: 'Método X', link: 'https://exemplo.com/outro' })), 'PRODUCT_ALREADY_EXISTS');
  assert.equal(code(() => store.saveProduct({ name: 'Guia Y', code: 'EMAG', link: 'https://exemplo.com/guia' })), 'PRODUCT_CODE_IN_USE');
  store.saveProduct({ name: 'Guia Y', code: 'GUIA', link: 'https://exemplo.com/guia' });

  // Edição mantém o id
  const edited = store.saveProduct({ id: 'metodo-x', name: 'Método X 2.0', code: 'EMAG', link: 'https://exemplo.com/metodo-x', price: 'R$ 297,00' });
  assert.equal(edited.id, 'metodo-x');
  assert.equal(edited.name, 'Método X 2.0');
  assert.equal(store.get().products.length, 2);

  // Modo por número
  assert.equal(code(() => store.setSlot(1, { mode: 'QUALQUER' })), 'INVALID_MODE');
  assert.equal(code(() => store.setSlot(7, { mode: 'OFF' })), 'INVALID_SLOT');
  assert.equal(code(() => store.setSlot(1, { mode: 'PRODUCT' })), 'PRODUCT_REQUIRED_FOR_MODE');
  assert.equal(code(() => store.setSlot(1, { mode: 'PRODUCT', productId: 'nao-existe' })), 'PRODUCT_REQUIRED_FOR_MODE');
  assert.deepEqual(store.setSlot(2, { mode: 'PRODUCT', productId: 'metodo-x' }), { slot: 2, mode: 'PRODUCT', productId: 'metodo-x' });
  assert.deepEqual(store.setSlot(1, { mode: 'conta_pj', productId: 'metodo-x' }), { slot: 1, mode: 'CONTA_PJ', productId: null });
  const cfg = store.slotConfig(2);
  assert.equal(cfg.mode, 'PRODUCT');
  assert.equal(cfg.productId, 'metodo-x');
  assert.equal(cfg.products.length, 2);
  assert.equal(store.slotConfig(3).mode, 'OFF', 'número não configurado continua desligado');

  // Produto em uso não pode ser removido nem desativado
  assert.equal(code(() => store.removeProduct('metodo-x')), 'PRODUCT_IN_USE');
  assert.equal(code(() => store.saveProduct({ id: 'metodo-x', name: 'Método X 2.0', link: 'https://exemplo.com/metodo-x', active: false })), 'PRODUCT_IN_USE');
  assert.equal(code(() => store.removeProduct('nao-existe')), 'PRODUCT_NOT_FOUND');
  assert.deepEqual(store.removeProduct('guia-y'), { removed: 'guia-y' });

  // Persistência: outra instância lê o mesmo arquivo; arquivo restrito ao dono
  const reopened = createSdrSettingsStore({ file });
  assert.equal(reopened.slotConfig(2).mode, 'PRODUCT');
  assert.equal(reopened.get().products[0].name, 'Método X 2.0');
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.ok(!fs.readdirSync(path.dirname(file)).some(f => f.endsWith('.tmp')), 'gravação atômica não deixa temporário');

  // Mutação do retorno não altera o estado interno
  const snapshot = reopened.get();
  snapshot.products[0].name = 'ALTERADO';
  snapshot.slots['2'].mode = 'OFF';
  assert.equal(reopened.get().products[0].name, 'Método X 2.0');
  assert.equal(reopened.slotConfig(2).mode, 'PRODUCT');

  // Arquivo corrompido ou adulterado nunca liga o robô
  const broken = path.join(dir, 'broken.json');
  fs.writeFileSync(broken, '{ isto não é json');
  const errors = [];
  const original = console.error; console.error = (...a) => errors.push(a);
  try { assert.equal(createSdrSettingsStore({ file: broken }).slotConfig(1).mode, 'OFF'); } finally { console.error = original; }
  assert.equal(errors.length, 1, 'arquivo corrompido é registrado em log');

  const tampered = path.join(dir, 'tampered.json');
  fs.writeFileSync(tampered, JSON.stringify({ slots: { 1: { mode: 'PRODUCT', productId: 'fantasma' }, 2: { mode: 'XYZ' }, 99: { mode: 'CONTA_PJ' } }, products: [{ name: 'Sem link' }, { id: 'ok', name: 'Ok', link: 'https://exemplo.com/ok' }] }));
  const t = createSdrSettingsStore({ file: tampered });
  assert.deepEqual(t.get().slots, { 1: { mode: 'PRODUCT', productId: null }, 2: { mode: 'OFF', productId: null } });
  assert.equal(t.get().products.length, 1);

  // Local do arquivo e aviso de disco temporário
  assert.equal(defaultFile({ WHATSAPP_QR_SESSION_DIR: '/var/data/whatsapp-sessions' }), '/var/data/whatsapp-sessions/sdr-settings.json');
  assert.equal(defaultFile({ SDR_SETTINGS_FILE: '/var/data/x.json', WHATSAPP_QR_SESSION_DIR: '/outro' }), '/var/data/x.json');
  assert.equal(createSdrSettingsStore({ file: '/var/data/whatsapp-sessions/sdr-settings.json' }).persistent, true);
  assert.equal(createSdrSettingsStore({ file: '/tmp/luis-whatsapp-sessions/sdr-settings.json' }).persistent, false);

  console.log('PASS SDR settings store: safe defaults, validation, slot modes and persistence');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
