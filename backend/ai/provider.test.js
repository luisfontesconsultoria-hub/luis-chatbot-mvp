const assert = require('assert');
const { generate, extractGeminiText, extractOpenAIText } = require('./provider');

(async()=>{
  const text = extractGeminiText({ candidates:[{ content:{ parts:[{text:'Olá '},{text:'mundo'}] } }] });
  assert.equal(text,'Olá mundo');
  assert.equal(extractOpenAIText({ output_text:'Olá OpenAI' }), 'Olá OpenAI');
  assert.equal(extractOpenAIText({ output:[{content:[{type:'output_text',text:'Resposta '}]}] }), 'Resposta');

  const previousProvider = process.env.AI_PROVIDER;
  const previousAssist = process.env.AI_ASSIST_ENABLED;
  const previousGeminiKey = process.env.GEMINI_API_KEY;
  const previousOpenAIKey = process.env.OPENAI_API_KEY;
  const previousOpenAIModel = process.env.OPENAI_MODEL;
  const previousOpenAIBase = process.env.OPENAI_BASE_URL;
  const previousFetch = global.fetch;
  try {
    process.env.AI_PROVIDER = 'gemini';
    process.env.AI_ASSIST_ENABLED = 'true';
    delete process.env.GEMINI_API_KEY;

    let failed=false;
    try { await generate({lead:{status:'QUALIFYING'},text:'oi',decision:{status:'QUALIFYING'}}); }
    catch(e) { failed = e.message==='GEMINI_API_KEY_NOT_CONFIGURED'; }
    if (!failed) throw Error('AI provider secret guard failed');

    process.env.AI_PROVIDER = 'openai';
    process.env.AI_ASSIST_ENABLED = 'true';
    delete process.env.OPENAI_API_KEY;
    failed=false;
    try { await generate({lead:{status:'QUALIFYING'},text:'oi',decision:{status:'QUALIFYING'}}); }
    catch(e) { failed = e.message==='OPENAI_API_KEY_NOT_CONFIGURED'; }
    if (!failed) throw Error('OpenAI provider secret guard failed');

    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_MODEL = 'gpt-test';
    process.env.OPENAI_BASE_URL = 'https://example.test/v1';
    let request;
    global.fetch = async (url, options) => {
      request = { url, options };
      return { ok:true, async json(){ return { output_text:'Resposta de teste' }; } };
    };
    const result = await generate({
      lead:{status:'QUALIFYING',name:'Teste'},
      text:'oi',
      decision:{status:'QUALIFYING',nextAction:'qualificar'}
    });
    assert.equal(result.reply,'Resposta de teste');
    assert.equal(request.url,'https://example.test/v1/responses');
    assert.equal(request.options.headers.Authorization,'Bearer test-key');
    assert.equal(JSON.parse(request.options.body).model,'gpt-test');
  } finally {
    if (previousProvider === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = previousProvider;
    if (previousAssist === undefined) delete process.env.AI_ASSIST_ENABLED; else process.env.AI_ASSIST_ENABLED = previousAssist;
    if (previousGeminiKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousGeminiKey;
    if (previousOpenAIKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousOpenAIKey;
    if (previousOpenAIModel === undefined) delete process.env.OPENAI_MODEL; else process.env.OPENAI_MODEL = previousOpenAIModel;
    if (previousOpenAIBase === undefined) delete process.env.OPENAI_BASE_URL; else process.env.OPENAI_BASE_URL = previousOpenAIBase;
    global.fetch = previousFetch;
  }
  console.log('PASS AI provider secret guards and OpenAI adapter');
})();
