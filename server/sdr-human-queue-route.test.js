const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdr-queue-'));
process.env.WHATSAPP_QR_SESSION_DIR = dir;
process.env.SDR_SETTINGS_FILE = path.join(dir, 'sdr-settings.json');
process.env.CRM_ADMIN_USER = 'luis';
process.env.CRM_ADMIN_PASSWORD = 'senha-de-teste';
process.env.CRM_AUTH_SECRET = 'segredo-de-teste';
delete process.env.NODE_ENV;

// Repositório em memória no lugar do Supabase: as rotas usam o runtime compartilhado.
const leads = new Map();
const log = { updates: [], audits: [], events: [] };
const repository = {
  async getLead(id) { return leads.has(id) ? { ...leads.get(id) } : null; },
  async listLeads({ status } = {}) { return [...leads.values()].filter(l => !status || l.status === status).map(l => ({ ...l })); },
  async updateLead(id, patch) { log.updates.push({ id, patch }); const next = { ...leads.get(id), ...patch }; leads.set(id, next); return { ...next }; },
  async createAudit(row) { log.audits.push(row); return row; },
  async createEvent(row) { log.events.push(row); return row; },
  async listEvents({ leadId, type } = {}) { return log.events.filter(e => e.lead_id === leadId && (!type || e.type === type)); }
};
require.cache[require.resolve('./runtime')] = {
  id: require.resolve('./runtime'), filename: require.resolve('./runtime'), loaded: true,
  exports: { createProductionRuntime: () => ({ repository, pipeline: null, sender: null, sdr: null }) }
};

const { routeRequest } = require('./routes');
const auth = require('./auth');

(async () => {
  try {
    const headers = { authorization: `Bearer ${auth.login('luis', 'senha-de-teste').token}` };
    const call = (method, p, body = {}, h = headers, query = {}) => routeRequest({ method, path: p, body, headers: h, query });

    leads.set('p1', { id: 'p1', name: 'Ana', phone: '5571900000001', status: 'HUMAN_HANDOFF', nextAction: 'ATENDIMENTO_HUMANO', interest: 'Método X' });
    leads.set('p2', { id: 'p2', name: 'Bia', phone: '5571900000002', status: 'HUMAN_HANDOFF', nextAction: null });
    leads.set('c1', { id: 'c1', name: 'Caio', phone: '5571900000003', status: 'AGUARDANDO_RETORNO_DO_LUIS', nextAction: 'AGUARDANDO_RETORNO_DO_LUIS' });
    leads.set('n1', { id: 'n1', name: 'Nina', phone: '5571900000004', status: 'PRODUCT_LINK_SENT' });

    // Fila humana inclui quem o robô passou para uma pessoa
    let r = await call('GET', '/api/crm/human-queue');
    assert.equal(r.status, 200);
    const actions = Object.fromEntries(r.body.leads.map(l => [l.id, l.humanAction]));
    assert.deepEqual(actions, { c1: 'CONSULTAR_CNPJ_E_LIBERAR', p1: 'ATENDER_E_DEVOLVER_AO_ROBO', p2: 'ATENDER_E_DEVOLVER_AO_ROBO' });
    assert.equal((await call('GET', '/api/crm/human-queue', {}, {})).status, 401, 'fila exige login');

    // Devolver ao robô: venda de produto volta para "link enviado"
    r = await call('POST', '/api/crm/leads/p1/human-release');
    assert.equal(r.status, 200);
    assert.deepEqual([r.body.previousStatus, r.body.targetStatus], ['HUMAN_HANDOFF', 'PRODUCT_LINK_SENT']);
    assert.equal(leads.get('p1').nextAction, 'AGUARDAR_COMPRA');
    assert.equal(log.audits.at(-1).action, 'HUMAN_RELEASE');

    // Repasse de outro roteiro volta para a qualificação
    r = await call('POST', '/api/crm/leads/p2/human-release');
    assert.equal(r.body.targetStatus, 'QUALIFYING');

    // Roteiro PJ continua igual
    r = await call('POST', '/api/crm/leads/c1/human-release');
    assert.equal(r.body.targetStatus, 'QUALIFYING');

    // Quem não está aguardando uma pessoa não é "liberado"
    r = await call('POST', '/api/crm/leads/n1/human-release');
    assert.deepEqual([r.status, r.body.error], [409, 'LEAD_NOT_WAITING_HUMAN_GATE']);

    // Webhook de venda: autenticação, venda aprovada e repetição
    const lead = '123e4567-e89b-12d3-a456-426614174000';
    leads.set(lead, { id: lead, phone: '5571900000005', status: 'PRODUCT_LINK_SENT', stage: 'NEGOTIATION' });
    const sale = { transaction_id: 'HP123', status: 'APPROVED', data: { purchase: { origin: { sck: 'L123e4567e89b12d3a456426614174000' } } }, buyer: { name: 'Fulano', email: 'f@x.com' } };
    delete process.env.AFFILIATE_WEBHOOK_SECRET;
    r = await call('POST', '/webhooks/affiliate-sale', sale, {});
    assert.deepEqual([r.status, r.body.error], [503, 'AFFILIATE_WEBHOOK_NOT_CONFIGURED'], 'sem segredo configurado o webhook fica fechado');
    process.env.AFFILIATE_WEBHOOK_SECRET = 'segredo-venda-123';
    r = await call('POST', '/webhooks/affiliate-sale', sale, {}, { token: 'errado' });
    assert.equal(r.status, 401);
    r = await call('POST', '/webhooks/affiliate-sale', sale, {}, { token: 'segredo-venda-123', platform: 'hotmart' });
    assert.deepEqual([r.status, r.body.matched, r.body.applied], [200, true, true]);
    assert.deepEqual([leads.get(lead).status, leads.get(lead).stage, leads.get(lead).nextAction], ['PRODUCT_SOLD', 'CONVERTIDO', 'POS_VENDA']);
    const saleEvent = log.events.find(e => e.type === 'AFFILIATE_SALE');
    assert.equal(saleEvent.payload.platform, 'hotmart');
    assert.ok(!JSON.stringify(saleEvent.payload).includes('Fulano') && !JSON.stringify(saleEvent.payload).includes('f@x.com'), 'dados do comprador não são gravados');
    r = await call('POST', '/webhooks/affiliate-sale', sale, { 'x-affiliate-secret': 'segredo-venda-123' });
    assert.equal(r.body.duplicate, true, 'mesma venda não é aplicada duas vezes');

    // Reembolso muda a etapa; venda sem token vira pendência para conferência
    r = await call('POST', '/webhooks/affiliate-sale', { ...sale, status: 'REFUNDED' }, { 'x-affiliate-secret': 'segredo-venda-123' });
    assert.equal(leads.get(lead).stage, 'REEMBOLSADO');
    r = await call('POST', '/webhooks/affiliate-sale', { transaction_id: 'HP999', status: 'APPROVED' }, { 'x-affiliate-secret': 'segredo-venda-123' });
    assert.deepEqual([r.status, r.body.matched], [202, false]);
    assert.ok(log.events.some(e => e.type === 'AFFILIATE_SALE_UNMATCHED'));
    r = await call('POST', '/webhooks/affiliate-sale', { status: 'APPROVED' }, { 'x-affiliate-secret': 'segredo-venda-123' });
    assert.deepEqual([r.status, r.body.error], [400, 'TRANSACTION_ID_REQUIRED']);
    // Boleto/PIX expirado chega como "cancelado": não é reembolso de venda
    const lead2 = '223e4567-e89b-12d3-a456-426614174000';
    leads.set(lead2, { id: lead2, phone: '5571900000006', status: 'PRODUCT_LINK_SENT', stage: 'NEGOTIATION' });
    r = await call('POST', '/webhooks/affiliate-sale', { transaction_id: 'HP555', status: 'PURCHASE_CANCELED', sck: 'L223e4567e89b12d3a456426614174000' }, { 'x-affiliate-secret': 'segredo-venda-123' });
    assert.deepEqual([r.status, r.body.applied], [200, false]);
    assert.equal(leads.get(lead2).stage, 'NEGOTIATION');

    // Falha ao gravar o lead: a plataforma reenvia e a venda é aplicada na nova tentativa
    const originalUpdate = repository.updateLead;
    repository.updateLead = async () => { throw new Error('SUPABASE_TIMEOUT'); };
    const quiet = console.error; console.error = () => {};
    try { r = await call('POST', '/webhooks/affiliate-sale', { transaction_id: 'HP777', status: 'approved', sck: 'L223e4567e89b12d3a456426614174000' }, { 'x-affiliate-secret': 'segredo-venda-123' }); }
    finally { console.error = quiet; repository.updateLead = originalUpdate; }
    assert.equal(r.status, 500);
    r = await call('POST', '/webhooks/affiliate-sale', { transaction_id: 'HP777', status: 'approved', sck: 'L223e4567e89b12d3a456426614174000' }, { 'x-affiliate-secret': 'segredo-venda-123' });
    assert.deepEqual([r.status, r.body.applied], [200, true]);
    assert.equal(leads.get(lead2).status, 'PRODUCT_SOLD');

    // Devolver ao robô deixa o marcador que zera a contagem de respostas automáticas
    assert.ok(log.events.some(e => e.type === 'HUMAN_RELEASE' && e.lead_id === 'p1'));
    delete process.env.AFFILIATE_WEBHOOK_SECRET;

    console.log('PASS human queue, release back to the robot and affiliate sale webhook');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exit(1); });
