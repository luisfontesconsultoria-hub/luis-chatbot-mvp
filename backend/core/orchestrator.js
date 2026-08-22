/**
 * Pure V1 orchestration core.
 * No provider SDKs, secrets or network calls live here.
 * Adapters persist/send/call tools around this deterministic core.
 */

const BLOCKED = 'AGUARDANDO_RETORNO_DO_LUIS';

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

function nextStep(lead, text) {
  const q = normalize(text);
  const state = lead.status || 'NEW';

  if (state === BLOCKED) {
    return { reply: 'Recebi sua mensagem. Seu atendimento está aguardando o retorno do Luís. Assim que ele retornar, continuamos por aqui.', status: BLOCKED, handoff: true };
  }

  if (state === 'NEW') {
    return { reply: 'Olá! Tudo bem? Para começarmos, com quem eu estou falando?', status: 'IDENTIFYING', handoff: false };
  }

  if (state === 'IDENTIFYING') {
    return { reply: `Prazer, ${text}! O que você está procurando hoje para sua empresa?`, status: 'QUALIFYING', handoff: false };
  }

  if (state === 'QUALIFYING') {
    if (/\b(credito|creditario|crediario|financiamento|consorcio|emprestimo|capital de giro|antecipacao|limite)\b/.test(q)) {
      return { reply: 'Entendi. Esse tipo de produto depende de análise e não representa aprovação. Neste primeiro momento, vamos verificar a solução de conta PJ ou máquina para sua empresa. Me informe o CNPJ, por favor.', status: 'CNPJ_PENDING', handoff: false };
    }
    return { reply: 'Perfeito. Para verificar a disponibilidade para sua empresa, me informe o CNPJ, por favor.', status: 'CNPJ_PENDING', handoff: false };
  }

  if (state === 'CNPJ_PENDING') {
    if (!validCnpj(text)) return { reply: 'O CNPJ informado parece inválido. Pode conferir os 14 dígitos e enviar novamente?', status: 'CNPJ_PENDING', handoff: false };
    return { reply: 'Perfeito. Recebi o CNPJ. Vou verificar a disponibilidade e aguardar a validação necessária. Só um instante, por favor.', status: BLOCKED, handoff: true, tool: 'CNPJ_LOOKUP_AUTHORIZED' };
  }

  return { reply: 'Entendi. Vou continuar seu atendimento.', status: state, handoff: false };
}

function processEvent({ lead, text, externalMessageId }) {
  if (!externalMessageId) throw new Error('external_message_id_required');
  return nextStep(lead, text);
}

module.exports = { normalize, validCnpj, nextStep, processEvent, BLOCKED };
