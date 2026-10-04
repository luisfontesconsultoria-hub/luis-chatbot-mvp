const assert = require('assert');
const p = require('./product-playbook');

const product = {
  id: 'metodo-x', name: 'Método X', code: 'EMAG', link: 'https://exemplo.com/metodo-x',
  price: 'R$ 197,00', pitch: 'Curso prático em vídeo.', knowledge: 'Acesso por 12 meses. Parcela em 12x de R$ 19,70.',
  source: 'GOOGLE_ADS', active: true
};
const other = { id: 'guia-y', name: 'Guia Y', code: 'GUIA', link: 'https://exemplo.com/guia-y', active: true };
const step = (status, text, extra = {}) => p.nextProductStep({ lead: { status }, text, product, ...extra });

// Código de campanha
assert.deepEqual(p.findRef('Olá! Quero saber mais (ref EMAG-G1)'), { code: 'EMAG', suffix: 'G1', ref: 'EMAG-G1' });
assert.deepEqual(p.findRef('código: emag'), { code: 'EMAG', suffix: null, ref: 'EMAG' });
assert.equal(p.findRef('#GUIA').code, 'GUIA');
assert.equal(p.findRef('bom dia, tudo bem?'), null);

// Resolução do produto: código > campanha do lead > produto do número
const products = [product, other, { id: 'off', name: 'Desativado', code: 'OFFX', link: 'https://exemplo.com/off', active: false }];
assert.equal(p.resolveProduct({ text: 'oi (ref GUIA)', products, slotProductId: 'metodo-x' }).product.id, 'guia-y');
assert.equal(p.resolveProduct({ text: 'oi', lead: { campaign: 'GUIA-A2' }, products, slotProductId: 'metodo-x' }).via, 'LEAD_CAMPAIGN');
assert.equal(p.resolveProduct({ text: 'oi', products, slotProductId: 'metodo-x' }).via, 'SLOT_DEFAULT');
assert.equal(p.resolveProduct({ text: 'ref OFFX', products, slotProductId: null }).product, null, 'produto desativado não atende');
assert.equal(p.resolveProduct({ text: 'ref ZZZZ', products, slotProductId: 'metodo-x' }).product.id, 'metodo-x', 'código desconhecido cai no produto do número');
assert.equal(p.resolveProduct({ text: 'oi', products: [], slotProductId: 'metodo-x' }).product, null);

// Primeiro contato: apresenta e se identifica como assistente virtual
const start = step('NEW', 'Olá! Quero saber mais (ref EMAG)');
assert.equal(start.status, 'PRODUCT_PRESENTED');
assert.ok(start.reply.includes('assistente virtual'));
assert.ok(start.reply.includes(product.pitch));
assert.ok(!start.reply.includes(product.link), 'apresentação não despeja o link');
assert.equal(start.linkSent, false);

// Primeiro contato já pedindo para comprar: link direto
const eager = step('NEW', 'quero comprar');
assert.equal(eager.status, 'PRODUCT_LINK_SENT');
assert.ok(eager.reply.includes(product.link) && eager.linkSent);

// Aceite e preço enviam o link oficial e o valor cadastrado
const yes = step('PRODUCT_PRESENTED', 'sim');
assert.equal(yes.status, 'PRODUCT_LINK_SENT');
assert.ok(yes.reply.includes(product.link) && yes.reply.includes('R$ 197,00'));
const price = step('PRODUCT_PRESENTED', 'quanto custa?');
assert.ok(price.reply.includes('R$ 197,00') && price.linkSent);
const noPrice = p.nextProductStep({ lead: { status: 'PRODUCT_PRESENTED' }, text: 'qual o valor?', product: { ...product, price: null } });
assert.ok(!/R\$/.test(noPrice.reply), 'sem preço cadastrado o robô não cita valor');
assert.ok(noPrice.reply.includes(product.link));

// "sim" fora do roteiro não é pedido de compra
assert.equal(p.detectIntent('sim', 'NEW'), 'QUESTION');
assert.equal(p.detectIntent('não quero pagar no cartão, tem pix?', 'PRODUCT_PRESENTED'), 'BUY');

// Dúvida livre: sem IA manda o link uma vez; com o link já enviado, passa para uma pessoa
const q1 = step('PRODUCT_PRESENTED', 'funciona para iniciante?');
assert.equal(q1.status, 'PRODUCT_LINK_SENT');
assert.ok(q1.aiEligible && q1.appendLink && q1.reply.includes(product.link));
const q2 = step('PRODUCT_LINK_SENT', 'e tem certificado?');
assert.equal(q2.status, 'HUMAN_HANDOFF');
assert.ok(q2.handoff && q2.aiEligible && q2.appendLink === false);
assert.equal(q2.aiStatus, 'PRODUCT_LINK_SENT');

// Pedido de pessoa e pedido de saída
const human = step('PRODUCT_PRESENTED', 'quero falar com um atendente');
assert.equal(human.status, 'HUMAN_HANDOFF');
assert.ok(human.reply && human.handoff);
const out = step('PRODUCT_LINK_SENT', 'pare de me mandar mensagem');
assert.equal(out.status, 'LOST');
assert.equal(out.nextAction, 'OPT_OUT');
assert.ok(out.reply);
assert.equal(step('LOST', 'oi').reply, null, 'quem pediu para sair não recebe mais resposta automática');
assert.equal(step('LOST', 'pare').reply, null);

// Portões humanos e leads de outro roteiro: silêncio
for (const gate of ['HUMAN_HANDOFF', 'AGUARDANDO_RETORNO_DO_LUIS', 'AGUARDANDO_CONFIRMACAO_AGENDA']) {
  const r = step(gate, 'quero comprar');
  assert.equal(r.reply, null);
  assert.equal(r.status, gate);
}
const foreign = step('QUALIFYING', 'quero comprar');
assert.equal(foreign.reply, null);
assert.equal(foreign.intent, 'OUT_OF_FLOW');
assert.equal(foreign.status, 'QUALIFYING');

// Chegada por anúncio de outro produto recomeça o roteiro, mas nunca fura portão humano
assert.equal(step('QUALIFYING', 'oi (ref EMAG)', { restart: true }).status, 'PRODUCT_PRESENTED');
assert.equal(step('LOST', 'oi (ref EMAG)', { restart: true }).status, 'PRODUCT_PRESENTED');
assert.equal(step('HUMAN_HANDOFF', 'oi (ref EMAG)', { restart: true }).reply, null);

// Áudio/imagem (sem texto), agradecimento e teto de respostas
assert.equal(step('PRODUCT_PRESENTED', '').intent, 'NON_TEXT');
const ack = step('PRODUCT_LINK_SENT', 'obrigado');
assert.equal(ack.status, 'PRODUCT_LINK_SENT');
assert.ok(ack.reply && !ack.handoff);
const capped = step('PRODUCT_LINK_SENT', 'sim', { botReplies: p.MAX_BOT_REPLIES });
assert.equal(capped.status, 'HUMAN_HANDOFF');
assert.equal(capped.intent, 'REPLY_LIMIT');

// Filtro da resposta da IA
assert.equal(p.sanitizeAiReply('Sim, o acesso é por 12 meses.', product), 'Sim, o acesso é por 12 meses.');
assert.ok(p.sanitizeAiReply('Custa R$ 197, e parcela em 12x de R$ 19,70.', product), 'valores do cadastro passam');
assert.equal(p.sanitizeAiReply('Hoje sai por R$ 97!', product), null, 'valor inventado é rejeitado');
assert.equal(p.sanitizeAiReply('Veja em https://outro-site.com/promo', product), null, 'link que não é o oficial é rejeitado');
assert.equal(p.sanitizeAiReply('Veja em www.outro-site.com', product), null);
assert.ok(p.sanitizeAiReply(`Veja em ${product.link}.`, product), 'link oficial passa');
assert.equal(p.sanitizeAiReply('', product), null);
assert.equal(p.sanitizeAiReply('x'.repeat(p.MAX_AI_REPLY_CHARS + 1), product), null);

// Contexto da IA carrega as regras e só os dados do produto
const ctx = p.buildAiContext(product);
assert.ok(ctx.includes('Não invente preço') && ctx.includes('Método X') && ctx.includes('12 meses'));
assert.ok(!ctx.includes(product.link), 'o link não vai para a IA: quem envia é o sistema');
assert.ok(p.buildAiContext({ ...product, price: null }).includes('não cite valores'));

assert.throws(() => p.nextProductStep({ lead: {}, text: 'oi' }), /PRODUCT_REQUIRED/);
console.log('PASS product playbook: campaign code, flow, human gates, opt-out and AI guardrails');
