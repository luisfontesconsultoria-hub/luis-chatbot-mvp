const { getConfig } = require('../../server/config');

function extractGeminiText(data) {
  return String(data?.candidates?.[0]?.content?.parts?.map(part => part?.text || '').join('') || '').trim();
}

function extractOpenAIText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const chunks = [];
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (typeof content?.text === 'string') chunks.push(content.text);
    }
  }
  return chunks.join('').trim();
}

function buildSystem({ decision, context }) {
  return [
    'Você é o assistente comercial da consultoria.',
    'Siga estritamente o estado e a próxima ação fornecidos pelo backend.',
    'Não invente aprovação, preços, taxas, prazos ou condições.',
    'Use somente o contexto de conhecimento fornecido.',
    'Se a informação não estiver no contexto, admita que precisa confirmar.',
    'Responda em português do Brasil.',
    'Seja curto, profissional, natural e adequado para WhatsApp.',
    'Faça uma pergunta por vez e não transforme a conversa em interrogatório.',
    `ESTADO: ${decision.status}`,
    `PRÓXIMA AÇÃO: ${decision.nextAction || 'continuar conversa'}`,
    `CONTEXTO DA BASE:\n${context || 'Nenhum contexto adicional disponível.'}`
  ].join('\n');
}

async function generateGemini({ lead, text, decision, history = [], context = '' }, config) {
  if (!config.geminiApiKey) throw new Error('GEMINI_API_KEY_NOT_CONFIGURED');
  const system = buildSystem({ decision, context });
  const contents = [
    ...history.slice(-12).map(item => ({ role: item.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(item.text || '') }] })),
    { role: 'user', parts: [{ text: JSON.stringify({ lead: { name: lead?.name || null, companyName: lead?.companyName || null, interest: lead?.interest || null, status: lead?.status || null }, message: text }) }] }
  ];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;
    const response = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { temperature: 0.35, maxOutputTokens: 220 } }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`GEMINI_HTTP_${response.status}`);
    return { ...decision, reply: extractGeminiText(await response.json()) || decision.reply };
  } finally { clearTimeout(timeout); }
}

async function generateOpenAI({ lead, text, decision, history = [], context = '' }, config) {
  if (!config.openaiApiKey) throw new Error('OPENAI_API_KEY_NOT_CONFIGURED');
  const system = buildSystem({ decision, context });
  const input = [
    ...history.slice(-12).map(item => ({ role: item.role === 'assistant' ? 'assistant' : 'user', content: String(item.text || '') })),
    { role: 'user', content: JSON.stringify({ lead: { name: lead?.name || null, companyName: lead?.companyName || null, interest: lead?.interest || null, status: lead?.status || null }, message: text }) }
  ];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${config.openaiBaseUrl.replace(/\/$/, '')}/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.openaiApiKey}` },
      body: JSON.stringify({ model: config.openaiModel, instructions: system, input, max_output_tokens: 220 }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`OPENAI_HTTP_${response.status}`);
    return { ...decision, reply: extractOpenAIText(await response.json()) || decision.reply };
  } finally { clearTimeout(timeout); }
}

async function generateOllama({ lead, text, decision, history = [], context = '' }, config) {
  const system = [
    'Você é um SDR comercial. Siga estritamente o estado do backend.',
    'Não invente informações. Use somente o contexto fornecido.',
    'Responda em português brasileiro, de forma natural e curta.',
    `ESTADO: ${decision.status}`,
    `PRÓXIMA AÇÃO: ${decision.nextAction || 'continuar conversa'}`,
    `CONTEXTO:\n${context || 'Nenhum.'}`
  ].join('\n');
  const messages = [
    { role: 'system', content: system },
    ...history.slice(-12).map(item => ({ role: item.role, content: String(item.text || '') })),
    { role: 'user', content: JSON.stringify({ lead: { name: lead?.name || null, companyName: lead?.companyName || null }, message: text }) }
  ];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${config.ollamaBaseUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.ollamaModel, messages, stream: false, options: { temperature: 0.35 } }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`OLLAMA_HTTP_${response.status}`);
    const data = await response.json();
    return { ...decision, reply: String(data?.message?.content || '').trim() || decision.reply };
  } finally { clearTimeout(timeout); }
}

async function generate(args) {
  const config = getConfig();
  if (!config.aiAssistEnabled) return args.decision;
  if (config.aiProvider === 'ollama') return generateOllama(args, config);
  if (config.aiProvider === 'gemini') return generateGemini(args, config);
  if (config.aiProvider === 'openai') return generateOpenAI(args, config);
  throw new Error(`AI_PROVIDER_NOT_SUPPORTED:${config.aiProvider}`);
}

module.exports = { generate, extractGeminiText, extractOpenAIText };
