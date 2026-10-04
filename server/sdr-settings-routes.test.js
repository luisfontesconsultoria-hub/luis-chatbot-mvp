const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdr-routes-'));
process.env.SDR_SETTINGS_FILE = path.join(dir, 'sdr-settings.json');
process.env.CRM_ADMIN_USER = 'luis';
process.env.CRM_ADMIN_PASSWORD = 'senha-de-teste';
process.env.CRM_AUTH_SECRET = 'segredo-de-teste';
process.env.WHATSAPP_MAX_SLOTS = '2';
process.env.AI_ASSIST_ENABLED = 'false';
delete process.env.SUPABASE_URL;

const { routeRequest } = require('./routes');
const auth = require('./auth');

(async () => {
  try {
    const call = (method, p, body = {}, headers = {}) => routeRequest({ method, path: p, body, headers });

    // Sem sessão do CRM nada é lido nem alterado
    for (const [method, p] of [['GET', '/api/sdr/settings'], ['POST', '/api/sdr/slots/1'], ['POST', '/api/sdr/products'], ['POST', '/api/sdr/products/x/delete']]) {
      const r = await call(method, p, { mode: 'CONTA_PJ', name: 'X', link: 'https://exemplo.com/x' });
      assert.equal(r.status, 401, `${method} ${p}`);
      assert.equal(r.body.error, 'CRM_AUTH_REQUIRED');
    }
    assert.equal((await call('GET', '/api/sdr/settings', {}, { authorization: 'Bearer token-falso' })).status, 401);
    assert.equal(fs.existsSync(process.env.SDR_SETTINGS_FILE), false, 'chamada sem sessão não grava nada');

    const headers = { authorization: `Bearer ${auth.login('luis', 'senha-de-teste').token}` };

    // Estado inicial: todos os números desligados
    let r = await call('GET', '/api/sdr/settings', {}, headers);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.slots, [{ slot: 1, mode: 'OFF', productId: null }, { slot: 2, mode: 'OFF', productId: null }]);
    assert.deepEqual(r.body.products, []);
    assert.deepEqual(r.body.ai, { enabled: false, provider: null });
    assert.deepEqual(r.body.modes, ['OFF', 'CONTA_PJ', 'PRODUCT']);
    assert.equal(r.body.persistent, false, 'arquivo em /tmp é sinalizado como temporário');

    // Produto
    r = await call('POST', '/api/sdr/products', { name: 'X', link: 'http://inseguro.com' }, headers);
    assert.deepEqual([r.status, r.body.error, r.body.field], [400, 'PRODUCT_LINK_INVALID', 'link']);
    r = await call('POST', '/api/sdr/products', { name: 'Método X', code: 'emag', link: 'https://exemplo.com/metodo-x' }, headers);
    assert.equal(r.status, 200);
    assert.equal(r.body.product.id, 'metodo-x');
    r = await call('POST', '/api/sdr/products', { name: 'Outro', code: 'EMAG', link: 'https://exemplo.com/outro' }, headers);
    assert.deepEqual([r.status, r.body.error], [409, 'PRODUCT_CODE_IN_USE']);

    // Modo por número
    r = await call('POST', '/api/sdr/slots/1', { mode: 'PRODUCT' }, headers);
    assert.deepEqual([r.status, r.body.error], [400, 'PRODUCT_REQUIRED_FOR_MODE']);
    r = await call('POST', '/api/sdr/slots/3', { mode: 'CONTA_PJ' }, headers);
    assert.deepEqual([r.status, r.body.error], [400, 'INVALID_SLOT'], 'número acima do limite configurado é recusado');
    r = await call('POST', '/api/sdr/slots/1', { mode: 'PRODUCT', productId: 'metodo-x' }, headers);
    assert.deepEqual(r.body, { ok: true, slot: { slot: 1, mode: 'PRODUCT', productId: 'metodo-x' } });

    r = await call('GET', '/api/sdr/settings', {}, headers);
    assert.deepEqual(r.body.slots[0], { slot: 1, mode: 'PRODUCT', productId: 'metodo-x' });
    assert.equal(r.body.products.length, 1);

    // Remoção
    r = await call('POST', '/api/sdr/products/metodo-x/delete', {}, headers);
    assert.deepEqual([r.status, r.body.error], [409, 'PRODUCT_IN_USE']);
    await call('POST', '/api/sdr/slots/1', { mode: 'OFF' }, headers);
    r = await call('POST', '/api/sdr/products/metodo-x/delete', {}, headers);
    assert.deepEqual(r.body, { ok: true, removed: 'metodo-x' });
    r = await call('POST', '/api/sdr/products/metodo-x/delete', {}, headers);
    assert.equal(r.status, 404);
    assert.equal((await call('GET', '/api/sdr/qualquer', {}, headers)).status, 404);

    console.log('PASS SDR settings routes: auth required, slot modes and product catalog');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exit(1); });
