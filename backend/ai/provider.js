/** AI provider boundary. The commercial state machine remains authoritative. */
function requireKey(){if(!process.env.OPENAI_API_KEY)throw new Error('OPENAI_API_KEY_NOT_CONFIGURED');return process.env.OPENAI_API_KEY;}
async function generate({lead,text,decision}){
  const key=requireKey(); const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5',store:false,max_output_tokens:180,input:[{role:'system',content:'Você é o assistente comercial da consultoria. Siga estritamente o estado e a próxima ação fornecidos pelo backend. Não invente aprovação, preços ou condições. Responda em português do Brasil, de forma curta, profissional e natural para WhatsApp.'},{role:'user',content:JSON.stringify({lead:{name:lead?.name||null,companyName:lead?.companyName||null,status:lead?.status||null},text,status:decision.status,nextAction:decision.nextAction})}]}),signal:controller.signal});
    if(!response.ok)throw new Error(`OPENAI_HTTP_${response.status}`);
    const data=await response.json(); const output=String(data.output_text||data.output?.flatMap(x=>x.content||[]).map(x=>x.text||'').join('')||'').trim();
    return {...decision,reply:output||decision.reply};
  }finally{clearTimeout(timeout);}
}
module.exports={generate};
