const { generate } = require('./provider');
(async()=>{
  let failed=false;
  try { await generate({lead:{status:'QUALIFYING'},text:'oi',decision:{status:'QUALIFYING'}}); } catch(e) { failed = e.message==='OPENAI_API_KEY_NOT_CONFIGURED'; }
  if (!failed) throw Error('AI provider exposed missing-key behavior incorrectly');
  console.log('PASS AI provider secret guard');
})();
