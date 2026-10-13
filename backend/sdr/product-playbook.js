/**
 * Roteiro de venda por produto (anúncios / afiliados).
 *
 * As regras comerciais são determinísticas e ficam aqui, fora do modelo de IA:
 * quem recebe o link, quando o robô para, quando passa para uma pessoa.
 * A IA só redige a resposta a uma dúvida, e o texto dela passa por
 * sanitizeAiReply() antes de ser enviado.
 *
 * Módulo puro: não acessa banco, rede nem variáveis de ambiente.
 */

const PRODUCT_STATES = Object.freeze({
  PRESENTED: 'PRODUCT_PRESENTED',
  LINK_SENT: 'PRODUCT_LINK_SENT',
  SOLD: 'PRODUCT_SOLD',
  HUMAN: 'HUMAN_HANDOFF',
  LOST: 'LOST'
});

// Estados em que só uma pessoa pode retomar a conversa. Valem para qualquer roteiro.
const HUMAN_GATES = new Set(['HUMAN_HANDOFF', 'AGUARDANDO_RETORNO_DO_LUIS', 'AGUARDANDO_CONFIRMACAO_AGENDA']);
const START_STATES = new Set(['', 'NEW', 'NOVO']);
const PRODUCT_FLOW_STATES = new Set([PRODUCT_STATES.PRESENTED, PRODUCT_STATES.LINK_SENT]);

// Teto padrão de respostas automáticas por lead: evita conversa infinita e custo de IA sem controle.
// Cada produto pode definir o seu (product.maxReplies) no painel.
const MAX_BOT_REPLIES = 12;
const MAX_AI_REPLY_CHARS = 900;

function normalize(text = '') {
  return String(text).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const OPT_OUT = /\b(pare|parar|para de (me )?(mandar|enviar|chamar)|descadastr\w*|me (tira|tire|remove|remova)|nao quero (mais|receber|nada)|nao tenho interesse|sem interesse|nao me (mande|envie|chame|perturbe)\w*|stop)\b/;
const OPT_OUT_EXACT = /^(nao|nao quero|nao obrigad[oa]|sair|quero sair|cancelar)[\s.!]*$/;
const HUMAN = /\b(atendente|humano|pessoa de verdade|falar com (alguem|voce|o responsavel|um vendedor|o vendedor|um consultor|o consultor|o dono)|me liga|pode (me )?ligar|ligacao)\b/;
const BUY = /\b(comprar|compro|adquirir|garantir|fechar|link|como (eu )?(compro|pago|adquiro|faco (para|pra) comprar)|onde (eu )?compro|formas? de pagamento|pagamento|pagar|pix|boleto|cartao|parcel\w*)\b/;
const AFFIRMATIVE = /^(sim|quero|quero sim|pode|pode sim|pode mandar|pode enviar|claro|manda|manda ai|envia|bora|vamos|ok quero|com certeza|isso|s)[\s.!]*$/;
const PRICE = /\b(preco|valor|quanto (custa|e|fica|sai|ta|esta)|custa quanto|qual (e )?o investimento)\b/;
const ACK = /^(ok|okay|obrigad[oa]|muito obrigad[oa]|valeu|vlw|blz|beleza|certo|ta bom|tudo bem|show|top|entendi|vou (ver|olhar|pensar|analisar)|depois (eu )?(vejo|olho))[\s.!]*$/;

function detectIntent(text = '', state = '') {
  const q = normalize(text);
  if (!q) return 'NON_TEXT';
  if (OPT_OUT.test(q) || OPT_OUT_EXACT.test(q)) return 'OPT_OUT';
  if (HUMAN.test(q)) return 'HUMAN';
  if (BUY.test(q)) return 'BUY';
  if (PRICE.test(q)) return 'PRICE';
  // "sim" só é pedido de link quando o robô acabou de oferecer o link.
  if (AFFIRMATIVE.test(q) && PRODUCT_FLOW_STATES.has(state)) return 'BUY';
  if (ACK.test(q)) return 'ACK';
  return 'QUESTION';
}

/**
 * Código de campanha na mensagem do lead.
 * O link do anúncio abre o WhatsApp com um texto pronto, por exemplo
 * "Olá! Quero saber mais (ref EMAG-G1)". EMAG é o código do produto e G1 é
 * um complemento livre para identificar campanha/anúncio.
 */
const REF_PATTERN = /(?:\bref\b|\bc[oó]d(?:igo)?\b)[\s:.#-]*([A-Za-z0-9]{3,20})(?:-([A-Za-z0-9_]{1,30}))?|#([A-Za-z0-9]{3,20})(?:-([A-Za-z0-9_]{1,30}))?/i;

function findRef(text = '') {
  const m = String(text).match(REF_PATTERN);
  if (!m) return null;
  const code = String(m[1] || m[3] || '').toUpperCase();
  const suffix = String(m[2] || m[4] || '').toUpperCase();
  if (!code) return null;
  return { code, suffix: suffix || null, ref: suffix ? `${code}-${suffix}` : code };
}

/** Objeção cadastrada no produto cuja palavra-chave aparece na mensagem. Resposta aprovada, sem IA. */
function matchObjection(text = '', product = {}) {
  const q = ` ${normalize(text).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ')} `;
  for (const item of Array.isArray(product.objections) ? product.objections : []) {
    for (const keyword of item.keywords || []) {
      const k = normalize(keyword).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (k && q.includes(` ${k} `)) return item;
    }
  }
  return null;
}

function activeProducts(products = []) {
  return (Array.isArray(products) ? products : []).filter(p => p && p.id && p.link && p.active !== false);
}

/** Decide de qual produto é a conversa. Ordem: código na mensagem, campanha já gravada no lead, produto do número. */
function resolveProduct({ text = '', lead = {}, products = [], slotProductId = null } = {}) {
  const list = activeProducts(products);
  const byCode = code => list.find(p => p.code && String(p.code).toUpperCase() === code);

  const ref = findRef(text);
  if (ref) {
    const product = byCode(ref.code);
    if (product) return { product, ref: ref.ref, via: 'CODE' };
  }
  const campaign = String(lead.campaign || '').toUpperCase();
  if (campaign) {
    const product = byCode(campaign.split('-')[0]);
    if (product) return { product, ref: campaign, via: 'LEAD_CAMPAIGN' };
  }
  if (slotProductId) {
    const product = list.find(p => p.id === slotProductId);
    if (product) return { product, ref: null, via: 'SLOT_DEFAULT' };
  }
  return { product: null, ref: null, via: 'NONE' };
}

function linkMessage(product) {
  const lines = [`Aqui está o link da página oficial de ${product.name}:`, product.link];
  if (product.price) lines.push(`Valor: ${product.price}`);
  lines.push('', 'Qualquer dúvida, é só me chamar por aqui.');
  return lines.join('\n');
}

const GREETING = 'Olá! Aqui é o assistente virtual de atendimento.';

function presentation(product) {
  const pitch = String(product.pitch || '').trim() || `Você chamou sobre ${product.name}.`;
  return [
    GREETING,
    pitch,
    '',
    'Quer que eu te envie o link da página oficial ou prefere tirar alguma dúvida antes?'
  ].join('\n');
}

const HANDOFF_TEXT = 'Certo. Vou pedir para uma pessoa da equipe continuar seu atendimento por aqui.';
const HANDOFF_UNSURE_TEXT = 'Para não te passar informação errada, vou pedir para uma pessoa da equipe te responder por aqui.';

function handoff(reply, intent) {
  return { status: PRODUCT_STATES.HUMAN, reply, intent, handoff: true, nextAction: 'ATENDIMENTO_HUMANO', linkSent: false };
}

/**
 * Próximo passo do roteiro de produto.
 *
 * @param {object} args
 * @param {object} args.lead        lead atual (usa só status)
 * @param {string} args.text        mensagem recebida
 * @param {object} args.product     produto resolvido (obrigatório)
 * @param {number} args.botReplies  quantas respostas automáticas o lead já recebeu
 * @param {boolean} args.restart    true quando o lead chegou por um anúncio de outro produto
 * @returns {{status,reply,intent,handoff,nextAction,linkSent,aiEligible,appendLink}}
 */
function nextProductStep({ lead = {}, text = '', product, botReplies = 0, restart = false } = {}) {
  if (!product) throw new Error('PRODUCT_REQUIRED');
  const raw = String(lead.status || '').toUpperCase();

  // Portões humanos são soberanos: o robô nunca retoma sozinho.
  if (HUMAN_GATES.has(raw)) return { status: raw, reply: null, intent: 'HUMAN_GATE', handoff: true, nextAction: lead.nextAction || null, linkSent: false };

  const state = restart ? '' : raw;
  const intent = detectIntent(text, state);

  // Pedido de saída vale em qualquer ponto e encerra a conversa automática.
  if (intent === 'OPT_OUT') {
    if (state === PRODUCT_STATES.LOST) return { status: PRODUCT_STATES.LOST, reply: null, intent, handoff: false, nextAction: 'OPT_OUT', linkSent: false };
    return { status: PRODUCT_STATES.LOST, reply: 'Tudo bem, não envio mais mensagens. Se mudar de ideia, é só me chamar por aqui.', intent, handoff: false, nextAction: 'OPT_OUT', linkSent: false };
  }
  // Quem já pediu para sair só volta a ser atendido por uma pessoa.
  if (state === PRODUCT_STATES.LOST) return { status: PRODUCT_STATES.LOST, reply: null, intent: 'OPTED_OUT', handoff: false, nextAction: 'OPT_OUT', linkSent: false };

  if (intent === 'HUMAN') return handoff(HANDOFF_TEXT, intent);

  if (START_STATES.has(state)) {
    if (intent === 'BUY' || intent === 'PRICE') {
      return { status: PRODUCT_STATES.LINK_SENT, reply: `${GREETING}\n\n${linkMessage(product)}`, intent, handoff: false, nextAction: 'AGUARDAR_COMPRA', linkSent: true };
    }
    return { status: PRODUCT_STATES.PRESENTED, reply: presentation(product), intent: 'START', handoff: false, nextAction: 'AGUARDAR_RESPOSTA', linkSent: false };
  }

  // O robô só conduz quem é novo ou já está neste roteiro. Lead em outro estágio
  // (ex.: cliente antigo, roteiro de Conta PJ) fica para atendimento manual.
  if (!PRODUCT_FLOW_STATES.has(state)) return { status: raw, reply: null, intent: 'OUT_OF_FLOW', handoff: false, nextAction: lead.nextAction || null, linkSent: false };

  const limit = Number.isInteger(product.maxReplies) && product.maxReplies > 0 ? product.maxReplies : MAX_BOT_REPLIES;
  if (botReplies >= limit) return handoff(HANDOFF_TEXT, 'REPLY_LIMIT');

  if (intent === 'NON_TEXT') return { status: state, reply: 'Recebi sua mensagem, mas por aqui só consigo ler texto. Pode escrever sua dúvida?', intent, handoff: false, nextAction: 'AGUARDAR_RESPOSTA', linkSent: false };

  if (intent === 'BUY') return { status: PRODUCT_STATES.LINK_SENT, reply: linkMessage(product), intent, handoff: false, nextAction: 'AGUARDAR_COMPRA', linkSent: true };

  if (intent === 'PRICE') {
    const reply = product.price
      ? `O valor de ${product.name} é ${product.price}.\n\nPágina oficial: ${product.link}`
      : `O valor atualizado e as condições estão na página oficial:\n${product.link}`;
    return { status: PRODUCT_STATES.LINK_SENT, reply, intent, handoff: false, nextAction: 'AGUARDAR_COMPRA', linkSent: true };
  }

  // Objeção com resposta aprovada no cadastro: vem antes da IA e nunca é reescrita.
  if (intent === 'QUESTION') {
    const objection = matchObjection(text, product);
    if (objection) return { status: state, reply: objection.answer, intent: 'OBJECTION', handoff: false, nextAction: state === PRODUCT_STATES.LINK_SENT ? 'AGUARDAR_COMPRA' : 'AGUARDAR_RESPOSTA', linkSent: false };
  }

  if (intent === 'ACK') return { status: state, reply: 'Combinado! Fico à disposição por aqui se surgir alguma dúvida.', intent, handoff: false, nextAction: state === PRODUCT_STATES.LINK_SENT ? 'AGUARDAR_COMPRA' : 'AGUARDAR_RESPOSTA', linkSent: false };

  // Dúvida livre. Com IA: responde usando só o conhecimento do produto.
  // Sem IA (ou se a resposta da IA for rejeitada): manda o link uma vez e,
  // se o link já foi, passa para uma pessoa em vez de inventar resposta.
  if (state === PRODUCT_STATES.LINK_SENT) {
    return { ...handoff(HANDOFF_UNSURE_TEXT, 'QUESTION'), aiEligible: true, appendLink: false, aiStatus: PRODUCT_STATES.LINK_SENT, aiNextAction: 'AGUARDAR_COMPRA' };
  }
  return {
    status: PRODUCT_STATES.LINK_SENT,
    reply: `Os detalhes completos estão na página oficial de ${product.name}:\n${product.link}\n\nSe ficar alguma dúvida depois de olhar, me chama por aqui.`,
    intent: 'QUESTION', handoff: false, nextAction: 'AGUARDAR_COMPRA', linkSent: true,
    aiEligible: true, appendLink: true, aiStatus: PRODUCT_STATES.LINK_SENT, aiNextAction: 'AGUARDAR_COMPRA'
  };
}

const TONE_TEXT = Object.freeze({
  NEUTRO: 'Tom cordial e natural.',
  PROXIMO: 'Tom próximo e descontraído, como uma conversa entre conhecidos, sem gírias pesadas.',
  FORMAL: 'Tom formal e respeitoso, tratando o cliente por "você" sem intimidade.',
  DIRETO: 'Tom direto e objetivo: responda o essencial em poucas palavras.'
});

/** Texto de apoio entregue à IA. Tudo o que ela pode afirmar sobre o produto está aqui. */
function buildAiContext(product) {
  return [
    'REGRAS DESTE ATENDIMENTO (obrigatórias):',
    '- Você responde dúvidas sobre UM produto, descrito abaixo.',
    '- Use somente as informações de PRODUTO. Se a resposta não estiver lá, diga que vai confirmar com a equipe.',
    '- Não invente preço, desconto, bônus, garantia, prazo, resultado ou depoimento.',
    '- Não prometa resultado. Não faça afirmação de saúde, renda ou ganho garantido.',
    '- Não escreva links nem endereços de site: o sistema envia o link oficial.',
    '- Responda em até 3 frases curtas, em português do Brasil, tom natural de WhatsApp.',
    `- ${TONE_TEXT[product.tone] || TONE_TEXT.NEUTRO}`,
    '',
    'PRODUTO:',
    `Nome: ${product.name}`,
    product.price ? `Valor: ${product.price}` : 'Valor: não informado (não cite valores)',
    `Apresentação: ${String(product.pitch || '').trim() || 'não informada'}`,
    `Informações que você pode usar:\n${String(product.knowledge || '').trim() || 'Nenhuma informação adicional.'}`
  ].join('\n');
}

function digits(value) { return String(value).replace(/[.,]+$/, '').replace(/[^\d,]/g, '').replace(/,00$/, ''); }

/**
 * Valida a resposta gerada pela IA. Retorna o texto aprovado ou null (usa o roteiro fixo).
 * Rejeita: vazio, longo demais, qualquer link que não seja o oficial e qualquer
 * valor em reais que não esteja no cadastro do produto.
 */
function sanitizeAiReply(candidate, product) {
  const text = String(candidate || '').trim();
  if (!text || text.length > MAX_AI_REPLY_CHARS) return null;
  const urls = text.match(/(?:https?:\/\/|www\.)[^\s)]+/gi) || [];
  if (urls.some(u => u.replace(/[.,;!?]+$/, '') !== product.link)) return null;
  const known = [product.price, product.knowledge, product.pitch].map(v => String(v || '')).join(' ');
  const knownAmounts = new Set((known.match(/R\$\s?[\d.,]+/g) || []).map(digits));
  const amounts = (text.match(/R\$\s?[\d.,]+/g) || []).map(digits);
  if (amounts.some(a => !knownAmounts.has(a))) return null;
  return text;
}

module.exports = {
  PRODUCT_STATES, HUMAN_GATES, PRODUCT_FLOW_STATES, MAX_BOT_REPLIES, MAX_AI_REPLY_CHARS, TONE_TEXT,
  normalize, detectIntent, findRef, resolveProduct, nextProductStep, matchObjection,
  linkMessage, presentation, buildAiContext, sanitizeAiReply
};
