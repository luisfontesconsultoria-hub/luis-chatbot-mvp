/**
 * Pure V1 orchestration core.
 * No provider SDKs, secrets or network calls live here.
 */

const BLOCKED = 'AGUARDANDO_RETORNO_DO_LUIS';
const HUMAN = 'HUMAN_HANDOFF';

function normalize(text = '') {
  return String(text).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function validCnpj(value) {
  const d = String(value).replace(/\D/g, '');
  if (d.length !== 14 || /^([0-9])\1{13}$/.test(d)) return false;
  const digit = (base, weights) => {
    const sum = weights.reduce((n, w, i) => n + Number(base[i]) * w, 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return digit(d.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]) === Number(d[12]) &&
    digit(d.slice(0, 13), [6,5,4,3,2,9,8,7,6,5,4,3,2]) === Number(d[13]);
}

const creditTerms = /\b(credito|creditario|crediario|financiamento|consorcio|emprestimo|capital de giro|antecipacao|limite)\b/;
const machineTerms = /\b(maquina|stone|cielo|rede|safrapay|pagseguro|getnet|sumup|ton)\b/;
const bankTerms = /\b(itau|bradesco|santander|banrisul|sicredi|sicoob|inter|nubank|c6|caixa|bb|banco do brasil)\b/;
const accountMachineTogether = /conta.{0,80}(maquina|máquina)|(?:maquina|máquina).{0,80}conta/i;

function nextStep(lead = {}, text = '', authorizedHumanRelease = false) {
  const q = normalize(text);
  // Backward-compatible normalization for the legacy Portuguese status used by an earlier schema.
  const rawState = lead.status || 'NEW';
  const state = rawState === 'NOVO' ? 'NEW' : rawState;

  if (state === BLOCKED && !authorizedHumanRelease) {
    return { reply: 'Recebi sua mensagem. Seu atendimento está aguardando o retorno do Luís. Assim que ele retornar, continuamos por aqui.', status: BLOCKED, handoff: true };
  }
  if (state === HUMAN && !authorizedHumanRelease) {
    return { reply: null, status: HUMAN, handoff: true };
  }

  if (state === 'NEW') {
    return { reply: 'Olá! Tudo bem? Para começarmos, com quem eu estou falando?', status: 'IDENTIFYING', handoff: false };
  }

  if (state === 'IDENTIFYING') {
    const safeName = String(text).trim().slice(0, 80);
    return { reply: `Prazer, ${safeName || 'tudo bem'}! O que você está procurando hoje para sua empresa?`, status: 'QUALIFYING', handoff: false };
  }

  if (state === 'QUALIFYING') {
    if (creditTerms.test(q)) {
      return { reply: 'Entendi. Esse tipo de produto depende de análise do banco e não representa aprovação automática. Neste primeiro momento, vamos verificar a solução de conta PJ ou máquina para sua empresa. Me informe o CNPJ, por favor.', status: 'CNPJ_PENDING', handoff: false };
    }
    if (accountMachineTogether.test(text)) {
      return { reply: 'Perfeito. Entendi que você procura conta PJ e máquina. Quanto sua empresa fatura aproximadamente por mês?', status: 'QUALIFYING_REVENUE', handoff: false };
    }
    if (bankTerms.test(q) || machineTerms.test(q)) {
      return { reply: 'Perfeito. Entendi. Quanto sua empresa fatura aproximadamente por mês?', status: 'QUALIFYING_REVENUE', handoff: false };
    }
    return { reply: 'Perfeito. Para verificar a disponibilidade para sua empresa, me informe o CNPJ, por favor.', status: 'CNPJ_PENDING', handoff: false };
  }

  if (state === 'QUALIFYING_REVENUE') {
    return { reply: 'Entendi. E o que mais pesa para você hoje: taxa, suporte, prazo de recebimento ou custo da operação?', status: 'QUALIFYING_PAIN', handoff: false };
  }

  if (state === 'QUALIFYING_PAIN') {
    return { reply: 'Entendi. Se conseguirmos melhorar esse ponto, faz sentido compararmos uma condição para sua empresa?', status: 'QUALIFYING_ACCEPTANCE', handoff: false };
  }

  if (state === 'QUALIFYING_ACCEPTANCE') {
    if (/\b(sim|claro|pode|vamos|quero|aceito)\b/.test(q)) {
      return { reply: 'Perfeito. Você prefere uma conversa online ou presencial?', status: 'MEETING_MODE', handoff: false };
    }
    return { reply: 'Sem problema. Se quiser, posso continuar por aqui e entender melhor sua necessidade.', status: 'QUALIFYING_ACCEPTANCE', handoff: false };
  }

  if (state === 'MEETING_MODE') {
    return { reply: 'Perfeito. Qual dia e horário ficam melhores para você?', status: 'SCHEDULING', handoff: false };
  }

  if (state === 'SCHEDULING') {
    // V1 must never claim a meeting is confirmed without a real calendar confirmation.
    return { reply: 'Perfeito. Anotei sua preferência de dia e horário. Vou confirmar o agendamento com você.', status: 'SCHEDULING', handoff: true };
  }

  if (state === 'CNPJ_PENDING') {
    if (!validCnpj(text)) return { reply: 'O CNPJ informado parece inválido. Pode conferir os 14 dígitos e enviar novamente?', status: 'CNPJ_PENDING', handoff: false };
    return { reply: 'Perfeito. Recebi o CNPJ. Vou verificar a disponibilidade e aguardar a validação necessária. Só um instante, por favor.', status: BLOCKED, handoff: true, tool: 'CNPJ_LOOKUP_AUTHORIZED' };
  }

  return { reply: 'Entendi. Vou continuar seu atendimento.', status: state, handoff: false };
}

function processEvent({ lead, text, externalMessageId, authorizedHumanRelease = false }) {
  if (!externalMessageId) throw new Error('external_message_id_required');
  return nextStep(lead, text, authorizedHumanRelease);
}

module.exports = { normalize, validCnpj, nextStep, processEvent, BLOCKED, HUMAN };
