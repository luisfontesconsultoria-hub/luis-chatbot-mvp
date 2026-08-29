const assert = require('assert');
const { generate, extractGeminiText } = require('./provider');

(async()=>{
  const text = extractGeminiText({ candidates:[{ content:{ parts:[{text:'Olá '},{text:'mundo'}] } }] });
  assert.equal(text,'Olá mundo');

  const previousProvider = process.env.AI_PROVIDER;
  const previousAssist = process.env.AI_ASSIST_ENABLED;
  const previousKey = process.env.GEMINI_API_KEY;
  try {
    process.env.AI_PROVIDER = 'gemini';
    process.env.AI_ASSIST_ENABLED = 'true';
    delete process.env.GEMINI_API_KEY;

    let failed=false;
    try { await generate({lead:{status:'QUALIFYING'},text:'oi',decision:{status:'QUALIFYING'}}); }
    catch(e) { failed = e.message==='GEMINI_API_KEY_NOT_CONFIGURED'; }
    if (!failed) throw Error('AI provider secret guard failed');
  } finally {
    if (previousProvider === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = previousProvider;
    if (previousAssist === undefined) delete process.env.AI_ASSIST_ENABLED; else process.env.AI_ASSIST_ENABLED = previousAssist;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousKey;
  }
  console.log('PASS AI provider secret guard');
})();
