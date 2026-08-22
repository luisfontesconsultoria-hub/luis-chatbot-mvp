/** AI provider boundary. The commercial state machine remains authoritative. */
function requireKey() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY_NOT_CONFIGURED');
  return process.env.OPENAI_API_KEY;
}

async function generate({ lead, text, decision }) {
  const key = requireKey();
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      input: [
        { role:'system', content:'Você é o assistente comercial da consultoria. Siga estritamente o estado e a próxima ação fornecidos pelo backend. Não invente aprovação, preços ou condições.' },
        { role:'user', content: JSON.stringify({ lead, text, status: decision.status, nextAction: decision.nextAction }) }
      ]
    })
  });
  if (!response.ok) throw new Error(`OPENAI_HTTP_${response.status}`);
  const data = await response.json();
  const output = data.output_text || data.output?.flatMap(x => x.content || []).map(x => x.text || '').join('') || '';
  return { ...decision, reply: output || decision.reply };
}

module.exports = { generate };
