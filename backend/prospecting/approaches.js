const { generate } = require('../ai/provider');

async function generateApproaches({ businessType, companyName = '', region = '', lead = {} }) {
  const base = { name: lead.name || null, companyName: companyName || lead.companyName || null, interest: 'Conta PJ', status: 'PROSPECTING' };
  const strategies = [
    { key: 'CONSULTIVA', label: 'Consultiva', instruction: 'Crie uma primeira abordagem curta e consultiva, com uma pergunta simples para entender a operação da empresa antes de apresentar a solução.' },
    { key: 'DIRETA', label: 'Direta', instruction: 'Crie uma primeira abordagem curta, objetiva e comercial, destacando que existe uma solução empresarial e terminando com uma pergunta de baixa fricção.' },
    { key: 'SEGMENTADA', label: 'Segmentada', instruction: `Crie uma primeira abordagem curta e personalizada para o segmento ${businessType || 'informado'}, usando apenas contexto plausível e sem inventar fatos sobre a empresa.` }
  ];
  const out = [];
  for (const strategy of strategies) {
    const result = await generate({
      lead: base,
      text: `${strategy.instruction}\nEmpresa: ${companyName || 'empresa prospectada'}\nSegmento: ${businessType || 'não informado'}\nRegião: ${region || 'não informada'}\nGere somente a mensagem inicial, em português do Brasil, sem títulos, sem explicações e sem promessas.`,
      decision: { status: 'PROSPECTING', nextAction: 'INICIAR_ABORDAGEM', reply: '' },
      history: [],
      context: 'Objetivo comercial: abertura de conta PJ. Não prometer crédito, taxas, aprovação ou condições não confirmadas. A máquina de cartão é complementar à conta PJ.'
    });
    out.push({ key: strategy.key, label: strategy.label, message: String(result.reply || '').trim() });
  }
  return out;
}

module.exports = { generateApproaches };
