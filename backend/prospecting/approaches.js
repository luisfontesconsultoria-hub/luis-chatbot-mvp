const { generate } = require('../ai/provider');

function fallbackApproaches({ businessType, companyName, region }) {
  const company = companyName || 'sua empresa';
  const type = businessType || 'seu segmento';
  const area = region || 'sua região';
  return [
    { key: 'CONSULTIVA', label: 'Consultiva', message: `Olá! Tudo bem? Sou Luís Paulo Fontes. Estou entrando em contato porque trabalho com soluções para empresas de ${type}. Queria entender rapidamente como vocês cuidam hoje da conta PJ e dos recebimentos. Posso te explicar em 2 minutos?` },
    { key: 'DIRETA', label: 'Direta', message: `Olá! Tudo bem? Sou Luís Paulo Fontes. Atendo empresas de ${type} em ${area} e queria apresentar uma solução empresarial que pode fazer sentido para ${company}. Posso te enviar as informações?` },
    { key: 'SEGMENTADA', label: 'Segmentada', message: `Olá! Tudo bem? Sou Luís Paulo Fontes. Estou falando com empresas de ${type} da região e queria entender se vocês já têm uma estrutura de conta PJ e recebimentos que atende bem à operação. Posso fazer uma pergunta rápida?` }
  ];
}

async function generateApproaches({ businessType, companyName = '', region = '', lead = {} }) {
  const base = { name: lead.name || null, companyName: companyName || lead.companyName || null, interest: 'Conta PJ', status: 'PROSPECTING' };
  const strategies = [
    { key: 'CONSULTIVA', label: 'Consultiva', instruction: 'Crie uma primeira abordagem curta e consultiva, com uma pergunta simples para entender a operação da empresa antes de apresentar a solução.' },
    { key: 'DIRETA', label: 'Direta', instruction: 'Crie uma primeira abordagem curta, objetiva e comercial, destacando que existe uma solução empresarial e terminando com uma pergunta de baixa fricção.' },
    { key: 'SEGMENTADA', label: 'Segmentada', instruction: `Crie uma primeira abordagem curta e personalizada para o segmento ${businessType || 'informado'}, usando apenas contexto plausível e sem inventar fatos sobre a empresa.` }
  ];
  try {
    const out = [];
    for (const strategy of strategies) {
      const result = await generate({
        lead: base,
        text: `${strategy.instruction}\nEmpresa: ${companyName || 'empresa prospectada'}\nSegmento: ${businessType || 'não informado'}\nRegião: ${region || 'não informada'}\nGere somente a mensagem inicial, em português do Brasil, sem títulos, sem explicações e sem promessas.`,
        decision: { status: 'PROSPECTING', nextAction: 'INICIAR_ABORDAGEM', reply: '' },
        history: [],
        context: 'Objetivo comercial: abertura de conta PJ. Não prometer crédito, taxas, aprovação ou condições não confirmadas. A máquina de cartão é complementar à conta PJ.'
      });
      if (!result.reply) throw new Error('AI_REPLY_EMPTY');
      out.push({ key: strategy.key, label: strategy.label, message: String(result.reply).trim() });
    }
    return out;
  } catch (error) {
    if (error.message === 'AI_REPLY_EMPTY' || error.message === 'GEMINI_API_KEY_NOT_CONFIGURED' || String(error.message).startsWith('AI_PROVIDER_NOT_SUPPORTED')) return fallbackApproaches({ businessType, companyName, region });
    throw error;
  }
}

module.exports = { generateApproaches, fallbackApproaches };
