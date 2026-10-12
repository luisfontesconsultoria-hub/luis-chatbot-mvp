const assert = require('assert');
const { loadProducts, findProductByText } = require('./products');
const { parseCampaignCode, leadTrackingToken, leadIdFromTrackingToken, buildTrackedLink } = require('./tracking');
const { nextAffiliateStep, AF, STAGE } = require('./orchestrator');

const PRODUCTS_JSON = JSON.stringify([
  {
    code: 'PROD1', name: 'Curso Alfa', topic: 'organizar as finanças',
    checkout_url: 'https://pay.exemplo.com/alfa?off=1', tracking_param: 'sck',
    for_who: 'quem quer sair do vermelho', not_for: 'quem procura ficar rico rápido',
    includes: '12 aulas em vídeo e planilha de controle.', price: '12x de R$ 29,70 ou R$ 297 à vista',
    guarantee: '7 dias de garantia incondicional', aliases: ['alfa'],
    objections: [{ keywords: ['nao tenho tempo', 'sem tempo'], answer: 'As aulas têm 15 minutos e ficam gravadas.' }]
  },
  { code: 'PROD2', name: 'Mentoria Beta', checkout_url: 'https://pay.exemplo.com/beta' }
]);

// ---- fichas
const products = loadProducts({ AFFILIATE_PRODUCTS: PRODUCTS_JSON });
assert.equal(products.length, 2);
assert.equal(products[0].code, 'PROD1');
assert.equal(products[1].trackingParam, 'sck');
assert.equal(findProductByText(products, 'vi o anúncio do ALFA').code, 'PROD1');
assert.deepEqual(loadProducts({}), []);
assert.throws(() => loadProducts({ AFFILIATE_PRODUCTS: '{x' }), /AFFILIATE_PRODUCTS_JSON_INVALID/);
assert.throws(() => loadProducts({ AFFILIATE_PRODUCTS: JSON.stringify([{ code: 'A', name: 'A', checkout_url: 'http://inseguro.com' }]) }), /CHECKOUT_URL_INVALID/);
assert.throws(() => loadProducts({ AFFILIATE_PRODUCTS: JSON.stringify([{ code: 'A', name: 'A', checkout_url: 'https://a.com' }, { code: 'a', name: 'B', checkout_url: 'https://b.com' }]) }), /DUPLICATED/);
console.log('PASS affiliate products');

// ---- rastreamento
assert.deepEqual(parseCampaignCode('Olá! Quero saber mais #G-PROD1-K03'), { code: 'G-PROD1-K03', channel: 'GOOGLE_ADS', productCode: 'PROD1', adCode: 'K03' });
assert.equal(parseCampaignCode('oi #m-prod2').channel, 'META_ADS');
assert.equal(parseCampaignCode('sem código'), null);
const uuid = '3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90';
const token = leadTrackingToken(uuid);
assert.equal(token, 'L3f2a9c1e5b7d4e8a9c217d4e5f6a8b90');
assert.equal(leadIdFromTrackingToken(token), uuid);
assert.equal(leadIdFromTrackingToken(`affiliate_${token}_x`), uuid);
const link = buildTrackedLink(products[0], uuid);
assert.ok(link.startsWith('https://pay.exemplo.com/alfa?'));
assert.equal(new URL(link).searchParams.get('off'), '1');
assert.equal(new URL(link).searchParams.get('sck'), token);
console.log('PASS affiliate tracking');

// ---- roteiro completo
let lead = { id: uuid, status: 'NEW', name: 'Maria Souza' };
const step = text => {
  const d = nextAffiliateStep({ lead, text, products });
  lead = { ...lead, ...(d.leadPatch || {}), status: d.status, stage: d.stage || lead.stage, nextAction: d.nextAction };
  return d;
};

let d = step('Oi, vim pelo anúncio #G-PROD1-K03');
assert.equal(d.status, AF.DIAGNOSING);
assert.equal(d.stage, STAGE.DIAGNOSING);
assert.match(d.reply, /Maria/);
assert.match(d.reply, /Curso Alfa/);
assert.equal(d.leadPatch.productInterest, 'PROD1');
assert.equal(d.leadPatch.campaign, 'G-PROD1-K03');
assert.equal(d.leadPatch.source, 'GOOGLE_ADS');

d = step('Não consigo guardar dinheiro no fim do mês');
assert.equal(d.status, AF.PRESENTING);
assert.equal(d.stage, STAGE.QUALIFIED);
assert.match(d.reply, /sair do vermelho/);
assert.equal(d.leadPatch.painPoint, 'Não consigo guardar dinheiro no fim do mês');

d = step('sim, pode explicar');
assert.equal(d.status, AF.DECIDING);
assert.equal(d.lockReply, true);
assert.match(d.reply, /12 aulas/);
assert.match(d.reply, /R\$ 297/);
assert.match(d.reply, /7 dias/);

d = step('Mas eu não tenho tempo, trabalho muito');
assert.equal(d.status, AF.DECIDING);
assert.equal(d.reply, 'As aulas têm 15 minutos e ficam gravadas.');

d = step('Tem certificado reconhecido pelo MEC?');
assert.equal(d.status, 'AGUARDANDO_RETORNO_DO_LUIS');
assert.equal(d.nextAction, 'RESPONDER_DUVIDA_AFILIADO');
assert.equal(d.handoff, true);
assert.ok(d.reply);

d = step('alguém aí?');
assert.equal(d.status, 'AGUARDANDO_RETORNO_DO_LUIS');
assert.equal(d.reply, null, 'robô fica em silêncio enquanto o Luís não libera');

lead.status = AF.DECIDING; // liberação humana (rota /human-release)
d = step('ok, me manda o link');
assert.equal(d.status, AF.LINK_SENT);
assert.equal(d.stage, STAGE.LINK_SENT);
assert.equal(d.lockReply, true);
assert.ok(d.reply.includes(token), 'link de compra carrega o token do lead');
assert.equal(d.event.type, 'AFFILIATE_LINK_SENT');

d = step('quanto fica parcelado?');
assert.equal(d.status, AF.LINK_SENT, 'dúvida depois do link não rebaixa o lead');
assert.match(d.reply, /12x/);

d = step('Pronto, comprei!');
assert.equal(d.status, AF.PURCHASE_REPORTED);
assert.equal(d.stage, STAGE.LINK_SENT, 'etapa só vira venda com o webhook da plataforma');
console.log('PASS affiliate full flow');

// ---- opt-out em qualquer estado, inclusive pausado
for (const status of ['NEW', AF.DIAGNOSING, AF.DECIDING, 'AGUARDANDO_RETORNO_DO_LUIS']) {
  const r = nextAffiliateStep({ lead: { id: 'x1', status, productInterest: 'PROD1' }, text: 'Não tenho interesse, pare de mandar mensagem', products });
  assert.equal(r.status, 'LOST', status);
  assert.equal(r.stage, STAGE.LOST);
}
const silent = nextAffiliateStep({ lead: { id: 'x1', status: 'LOST', productInterest: 'PROD1' }, text: 'oi', products });
assert.equal(silent.reply, null);
const revived = nextAffiliateStep({ lead: { id: 'x1', status: 'LOST', productInterest: 'PROD1' }, text: 'mudei de ideia, quero comprar', products });
assert.equal(revived.status, AF.LINK_SENT);
// "não" como resposta na apresentação NÃO é opt-out
const declined = nextAffiliateStep({ lead: { id: 'x1', status: AF.PRESENTING, productInterest: 'PROD1' }, text: 'não', products });
assert.equal(declined.status, AF.DECIDING);
console.log('PASS affiliate opt-out');

// ---- produto não identificado com 2+ produtos
let unknown = nextAffiliateStep({ lead: { id: 'x2', status: 'NEW' }, text: 'oi, quero saber do curso', products });
assert.equal(unknown.status, AF.IDENTIFY_PRODUCT);
unknown = nextAffiliateStep({ lead: { id: 'x2', status: AF.IDENTIFY_PRODUCT }, text: 'é a mentoria beta', products });
assert.equal(unknown.status, AF.DIAGNOSING);
assert.equal(unknown.leadPatch.productInterest, 'PROD2');
unknown = nextAffiliateStep({ lead: { id: 'x3', status: AF.IDENTIFY_PRODUCT }, text: 'não lembro', products });
assert.equal(unknown.status, 'AGUARDANDO_RETORNO_DO_LUIS');
console.log('PASS affiliate product identification');

// ---- ficha sem o dado → nunca inventa, passa para o Luís
const beta = nextAffiliateStep({ lead: { id: 'x4', status: AF.DECIDING, productInterest: 'PROD2' }, text: 'qual o preço?', products });
assert.equal(beta.status, 'AGUARDANDO_RETORNO_DO_LUIS');
assert.ok(!/R\$/.test(beta.reply));
// pergunta de preço logo na 1ª mensagem é respondida
const firstPrice = nextAffiliateStep({ lead: { id: 'x5', status: 'NEW' }, text: 'quanto custa? #M-PROD1-C02', products });
assert.equal(firstPrice.status, AF.DECIDING);
assert.match(firstPrice.reply, /R\$ 297/);
assert.equal(firstPrice.leadPatch.source, 'META_ADS');
// sem nenhuma ficha configurada → todo lead vai para o Luís
const none = nextAffiliateStep({ lead: { id: 'x6', status: 'NEW' }, text: 'oi', products: [] });
assert.equal(none.status, 'AGUARDANDO_RETORNO_DO_LUIS');
// pedido de humano
const human = nextAffiliateStep({ lead: { id: 'x7', status: AF.DECIDING, productInterest: 'PROD1' }, text: 'quero falar com o Luís', products });
assert.equal(human.status, 'AGUARDANDO_RETORNO_DO_LUIS');
console.log('PASS affiliate safety gates');
