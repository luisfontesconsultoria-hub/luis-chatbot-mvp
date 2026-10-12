/**
 * SDR determinístico da operação de afiliados.
 *
 * Fluxo: identificar produto → diagnóstico (dor) → encaixe → apresentação →
 * dúvidas/objeções → link de compra rastreado → pós-venda.
 *
 * Regras:
 * - Fatos (preço, garantia, conteúdo, bônus, respostas de objeção, link) vêm só da
 *   ficha do produto. Respostas com fatos saem com lockReply=true: a IA não reescreve.
 * - Dúvida sem resposta segura na ficha → pausa para o Luís (AGUARDANDO_RETORNO_DO_LUIS,
 *   nextAction RESPONDER_DUVIDA_AFILIADO). O robô fica em silêncio até a liberação.
 * - Pedido de saída (opt-out) encerra e o robô para de responder.
 */
const { STATES } = require('../core/sdr-contract');
const { normalize } = require('../core/orchestrator');
const { findProductByCode, findProductByText } = require('./products');
const { parseCampaignCode, buildTrackedLink } = require('./tracking');

const AF = Object.freeze({
  IDENTIFY_PRODUCT: 'AF_IDENTIFY_PRODUCT',
  DIAGNOSING: 'AF_DIAGNOSING',
  PRESENTING: 'AF_PRESENTING',
  DECIDING: 'AF_DECIDING',
  LINK_SENT: 'AF_LINK_SENT',
  PURCHASE_REPORTED: 'AF_PURCHASE_REPORTED',
  SOLD: 'AF_SOLD'
});
const AF_STATES = new Set(Object.values(AF));
const BLOCKED = STATES.AGUARDANDO_RETORNO_DO_LUIS;
const HUMAN = STATES.HUMAN_HANDOFF;
const LOST = STATES.LOST;
const GATE_ACTION = 'RESPONDER_DUVIDA_AFILIADO';

// Etapas comerciais (stage) — mesmo vocabulário que o CRM já exibe, + REEMBOLSADO.
const STAGE = Object.freeze({
  NEW: 'NEW', DIAGNOSING: 'QUALIFYING', QUALIFIED: 'QUALIFIED', LINK_SENT: 'NEGOTIATION',
  SOLD: 'CONVERTIDO', REFUNDED: 'REEMBOLSADO', LOST: 'PERDIDO'
});

const RX = {
  optOutExact: /^(nao quero|pare|parar|sair|stop)\W*$/,
  optOut: /\b(nao tenho interesse|sem interesse|nao quero mais|pare de (me )?(mandar|enviar)|para de (me )?(mandar|enviar)|nao me (mande|mandem|envie)|me (tira|tire|remove|remova)|descadastr|sair da lista)/,
  human: /\b(falar com (o )?(luis|humano|atendente|uma pessoa|alguem)|atendimento humano)\b/,
  price: /\b(preco|valor|quanto (custa|e|fica|sai)|parcel\w*|formas? de pagamento|a vista|desconto|pix|boleto|cartao)\b/,
  guarantee: /\b(garantia|reembolso|devolu\w*|devolver|me arrepender|arrependimento)\b/,
  includes: /\b(o que vem|o que tem|conteudo|como funciona|o que (eu )?recebo|modulos?|aulas?|acesso)\b/,
  bonus: /\b(bonus|brinde)\b/,
  buy: /\b(link|comprar|compro|garantir|quero (o|esse|ele|comprar|garantir)|manda o link|me (manda|envia|passa)|checkout|fechar|assinar|como (faco|faz) (pra|para) comprar|onde (eu )?compro)\b/,
  purchased: /\b(comprei|paguei|finalizei|ja comprei|fiz a compra|efetuei|compra feita|pagamento feito)\b/,
  yes: /^(sim|s|claro|pode|pode sim|quero|quero sim|bora|vamos|ok|okay|beleza|blz|manda|isso|com certeza|aham|uhum|por favor|pfv|pf)\b/,
  no: /^(nao|n|agora nao|depois|talvez depois|ainda nao)\b/,
  thanks: /^(obrigad\w*|valeu|vlw|show|top|perfeito|certo|otimo|massa|legal)\b/
};

function firstName(lead) {
  const name = String(lead?.name || '').trim().split(/\s+/)[0];
  return name && name.length <= 30 ? name : '';
}

function hasQuestion(text) {
  return /\?/.test(String(text || '')) || /^(como|qual|quais|quando|onde|por que|porque|quanto|serve|funciona|tem|da pra|e se|posso)\b/.test(normalize(text));
}

function gate(stage, reply = 'Boa pergunta! Vou confirmar essa informação para não te passar nada errado. Já te retorno por aqui.') {
  return { reply, status: BLOCKED, handoff: true, nextAction: GATE_ACTION, stage, lockReply: true };
}

function linkDecision(product, lead) {
  const link = buildTrackedLink(product, lead.id);
  const guarantee = product.guarantee ? ` A compra tem ${product.guarantee}.` : '';
  return {
    reply: `Aqui está o link oficial do ${product.name}:\n${link}${guarantee}\nSe tiver qualquer dúvida no pagamento ou no acesso, é só me chamar.`,
    status: AF.LINK_SENT, handoff: false, nextAction: 'ACOMPANHAR_COMPRA', stage: STAGE.LINK_SENT, lockReply: true,
    event: { type: 'AFFILIATE_LINK_SENT', payload: { productCode: product.code, trackingParam: product.trackingParam } }
  };
}

/** Responde intenções com fatos da ficha. null = nenhuma intenção reconhecida. */
function answerIntent(q, product, lead, stageIfGate) {
  if (RX.price.test(q)) {
    if (!product.price) return gate(stageIfGate);
    return { reply: `O investimento no ${product.name} é ${product.price}. Quer que eu te mande o link oficial?`, status: AF.DECIDING, handoff: false, nextAction: 'AGUARDANDO_DECISAO', stage: STAGE.QUALIFIED, lockReply: true };
  }
  if (RX.guarantee.test(q)) {
    if (!product.guarantee) return gate(stageIfGate);
    return { reply: `Sobre a garantia: ${product.guarantee}. Ficou mais alguma dúvida?`, status: AF.DECIDING, handoff: false, nextAction: 'AGUARDANDO_DECISAO', stage: STAGE.QUALIFIED, lockReply: true };
  }
  if (RX.bonus.test(q)) {
    if (!product.bonuses) return gate(stageIfGate);
    return { reply: `Os bônus são: ${product.bonuses}. Quer o link oficial?`, status: AF.DECIDING, handoff: false, nextAction: 'AGUARDANDO_DECISAO', stage: STAGE.QUALIFIED, lockReply: true };
  }
  for (const objection of product.objections) {
    if (objection.keywords.some(keyword => q.includes(keyword))) {
      return { reply: objection.answer, status: AF.DECIDING, handoff: false, nextAction: 'AGUARDANDO_DECISAO', stage: STAGE.QUALIFIED, lockReply: true };
    }
  }
  if (RX.includes.test(q)) {
    if (!product.includes) return gate(stageIfGate);
    return { reply: `${product.includes}\nQuer que eu te mande o link oficial?`, status: AF.DECIDING, handoff: false, nextAction: 'AGUARDANDO_DECISAO', stage: STAGE.QUALIFIED, lockReply: true };
  }
  if (RX.buy.test(q)) return linkDecision(product, lead);
  return null;
}

function presentation(product) {
  const parts = [];
  if (product.includes) parts.push(product.includes);
  if (product.bonuses) parts.push(`Bônus: ${product.bonuses}.`);
  if (product.price) parts.push(`Investimento: ${product.price}.`);
  if (product.guarantee) parts.push(`Garantia: ${product.guarantee}.`);
  if (!parts.length) return null;
  return `${parts.join('\n')}\nFicou alguma dúvida, ou quer que eu te mande o link oficial?`;
}

function diagnosisQuestion(product, lead) {
  const name = firstName(lead);
  const hello = name ? `Oi, ${name}!` : 'Oi! Tudo bem?';
  const topic = product.topic ? ` com ${product.topic}` : '';
  return `${hello} Vi que você se interessou pelo ${product.name}. Para eu te ajudar do jeito certo: hoje, qual é a sua maior dificuldade${topic}?`;
}

function resolveProduct({ lead, text, products }) {
  const known = findProductByCode(products, lead?.productInterest || lead?.interest);
  if (known) return { product: known, campaign: null };
  const campaign = parseCampaignCode(text);
  const byCode = campaign ? findProductByCode(products, campaign.productCode) : null;
  if (byCode) return { product: byCode, campaign };
  const byText = findProductByText(products, text);
  if (byText) return { product: byText, campaign };
  if (products.length === 1) return { product: products[0], campaign };
  return { product: null, campaign };
}

function withProductPatch(decision, product, campaign, extra = {}) {
  const leadPatch = { ...(decision.leadPatch || {}), ...extra };
  if (product) leadPatch.productInterest = product.code;
  if (campaign) { leadPatch.campaign = campaign.code; leadPatch.source = campaign.channel; }
  return { ...decision, productCode: product?.code || null, leadPatch };
}

function nextAffiliateStep({ lead = {}, text = '', products = [], authorizedHumanRelease = false }) {
  const q = normalize(text);
  const raw = String(lead.status || STATES.NEW);
  const state = raw === 'NOVO' ? STATES.NEW : raw;

  // Opt-out vale em qualquer estado, inclusive com o robô pausado.
  if (state !== LOST && (RX.optOut.test(q) || RX.optOutExact.test(q))) {
    return { reply: 'Tudo bem, não vou mais te enviar mensagens. Se mudar de ideia, é só me chamar por aqui.', status: LOST, handoff: false, nextAction: null, stage: STAGE.LOST, lockReply: true };
  }
  if (state === BLOCKED && !authorizedHumanRelease) return { reply: null, status: BLOCKED, handoff: true, nextAction: lead.nextAction || GATE_ACTION };
  if (state === HUMAN && !authorizedHumanRelease) return { reply: null, status: HUMAN, handoff: true };

  if (!products.length) return gate(STAGE.NEW, 'Oi! Recebi sua mensagem. Já te respondo por aqui.');

  const { product, campaign } = resolveProduct({ lead, text, products });

  if (state === LOST) {
    // Só volta a falar se a própria pessoa pedir para comprar.
    if (product && RX.buy.test(q)) return withProductPatch(linkDecision(product, lead), product, campaign);
    return { reply: null, status: LOST, handoff: false };
  }

  if (!product) {
    if (state === AF.IDENTIFY_PRODUCT) return withProductPatch(gate(STAGE.NEW), null, campaign);
    return withProductPatch({ reply: 'Oi! Tudo bem? Qual produto você viu no anúncio? Assim eu já te passo as informações certas.', status: AF.IDENTIFY_PRODUCT, handoff: false, nextAction: 'IDENTIFICAR_PRODUTO', stage: STAGE.NEW }, null, campaign);
  }

  if (RX.human.test(q)) return withProductPatch(gate(STAGE.QUALIFIED, 'Claro! Vou chamar o Luís para falar com você. Ele te responde por aqui.'), product, campaign);

  const isEntry = !AF_STATES.has(state) || state === AF.IDENTIFY_PRODUCT;
  if (isEntry) {
    const intent = answerIntent(q, product, lead, STAGE.DIAGNOSING);
    if (intent && intent.status !== BLOCKED) return withProductPatch(intent, product, campaign);
    return withProductPatch({ reply: diagnosisQuestion(product, lead), status: AF.DIAGNOSING, handoff: false, nextAction: 'DIAGNOSTICAR_DOR', stage: STAGE.DIAGNOSING }, product, campaign);
  }

  if (state === AF.DIAGNOSING) {
    const intent = answerIntent(q, product, lead, STAGE.DIAGNOSING);
    if (intent) return withProductPatch(intent, product, campaign);
    const fit = product.forWho
      ? `Entendi, obrigado por me contar. O ${product.name} foi feito para ${product.forWho}.${product.notFor ? ` Só não é indicado para ${product.notFor}.` : ''}`
      : 'Entendi, obrigado por me contar.';
    return withProductPatch({ reply: `${fit} Quer que eu te explique o que vem dentro e como funciona a garantia?`, status: AF.PRESENTING, handoff: false, nextAction: 'APRESENTAR_PRODUTO', stage: STAGE.QUALIFIED }, product, campaign, { painPoint: String(text).trim().slice(0, 300) });
  }

  if (state === AF.PRESENTING) {
    const intent = answerIntent(q, product, lead, STAGE.QUALIFIED);
    if (intent) return withProductPatch(intent, product, campaign);
    if (RX.yes.test(q)) {
      const text2 = presentation(product);
      if (!text2) return withProductPatch(gate(STAGE.QUALIFIED), product, campaign);
      return withProductPatch({ reply: text2, status: AF.DECIDING, handoff: false, nextAction: 'AGUARDANDO_DECISAO', stage: STAGE.QUALIFIED, lockReply: true }, product, campaign);
    }
    if (RX.no.test(q)) return withProductPatch({ reply: 'Sem problema. Se quiser, me conta o que te deixou em dúvida que eu te ajudo.', status: AF.DECIDING, handoff: false, nextAction: 'AGUARDANDO_DECISAO', stage: STAGE.QUALIFIED }, product, campaign);
    return withProductPatch(gate(STAGE.QUALIFIED), product, campaign);
  }

  if (state === AF.DECIDING) {
    const intent = answerIntent(q, product, lead, STAGE.QUALIFIED);
    if (intent) return withProductPatch(intent, product, campaign);
    if (RX.yes.test(q)) return withProductPatch(linkDecision(product, lead), product, campaign);
    if (RX.no.test(q) && !hasQuestion(text)) return withProductPatch({ reply: 'Tudo bem! Fico por aqui se surgir qualquer dúvida.', status: AF.DECIDING, handoff: false, nextAction: 'FAZER_FOLLOW_UP', stage: STAGE.QUALIFIED }, product, campaign);
    if (RX.thanks.test(q) && !hasQuestion(text)) return withProductPatch({ reply: 'Por nada! Qualquer dúvida, estou por aqui.', status: AF.DECIDING, handoff: false, nextAction: 'AGUARDANDO_DECISAO', stage: STAGE.QUALIFIED }, product, campaign);
    return withProductPatch(gate(STAGE.QUALIFIED), product, campaign);
  }

  if (state === AF.LINK_SENT || state === AF.PURCHASE_REPORTED || state === AF.SOLD) {
    const stage = state === AF.SOLD ? STAGE.SOLD : STAGE.LINK_SENT;
    if (state !== AF.SOLD && RX.purchased.test(q)) {
      return withProductPatch({ reply: 'Que ótimo! Assim que a plataforma confirmar a compra, fica tudo registrado. Qualquer dúvida no acesso, é só me chamar.', status: AF.PURCHASE_REPORTED, handoff: false, nextAction: 'AGUARDANDO_CONFIRMACAO_VENDA', stage }, product, campaign);
    }
    if (state !== AF.SOLD) {
      const intent = answerIntent(q, product, lead, stage);
      // Depois do link enviado, responder dúvida não "rebaixa" o lead: mantém o estado e a etapa.
      if (intent) return withProductPatch({ ...intent, status: [BLOCKED, AF.LINK_SENT].includes(intent.status) ? intent.status : state, stage }, product, campaign);
    }
    if (RX.thanks.test(q) && !hasQuestion(text)) return withProductPatch({ reply: 'Por nada! Estou por aqui.', status: state, handoff: false, nextAction: lead.nextAction || null, stage }, product, campaign);
    return withProductPatch(gate(stage), product, campaign);
  }

  return withProductPatch(gate(STAGE.QUALIFIED), product, campaign);
}

function processAffiliateEvent({ lead, text, externalMessageId, products, authorizedHumanRelease = false }) {
  if (!externalMessageId) throw new Error('external_message_id_required');
  return nextAffiliateStep({ lead, text, products, authorizedHumanRelease });
}

module.exports = { AF, AF_STATES, STAGE, GATE_ACTION, nextAffiliateStep, processAffiliateEvent };
