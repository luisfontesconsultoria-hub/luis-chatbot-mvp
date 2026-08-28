const assert = require('assert');
const { generate, extractGeminiText } = require('./provider');

(async()=>{
  const text = extractGeminiText({ candidates:[{ content:{ parts:[{text:'Olá '},{text:'mundo'}] } }] });
  assert.equal(text,'Olá mundo');

  let failed=false;
  try { await generate({lead:{status:'QUALIFYING'},text:'oi',decision:{status:'QUALIFYING'}},{ }); }
  catch(e) { failed = e.message==='GEMINI_API_KEY_NOT_CONFIGURED'; }
  if (!failed) throw Error('AI provider secret guard failed');
  console.log('PASS AI provider secret guard');
})();
