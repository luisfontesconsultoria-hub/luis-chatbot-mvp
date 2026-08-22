const https = require('https');
function createWhatsAppSender({ accessToken = process.env.META_ACCESS_TOKEN, phoneNumberId = process.env.META_PHONE_NUMBER_ID, graphApiVersion = process.env.META_GRAPH_API_VERSION, request = https.request } = {}) {
  return {
    async sendText({ to, text }) {
      if (!accessToken || !phoneNumberId || !graphApiVersion) throw new Error('META_SEND_CREDENTIALS_REQUIRED');
      if (!to || !text) throw new Error('WHATSAPP_RECIPIENT_AND_TEXT_REQUIRED');
      const body = JSON.stringify({ messaging_product:'whatsapp', to:String(to), type:'text', text:{ body:String(text) } });
      return new Promise((resolve,reject)=>{
        const req=request({ hostname:'graph.facebook.com', path:`/${graphApiVersion}/${phoneNumberId}/messages`, method:'POST', headers:{ Authorization:`Bearer ${accessToken}`, 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(body) } }, res=>{
          let data=''; res.on('data',c=>data+=c); res.on('end',()=>{ let parsed; try{parsed=JSON.parse(data)}catch{parsed={raw:data}}; if(res.statusCode>=200&&res.statusCode<300) resolve(parsed); else reject(Object.assign(new Error('META_SEND_FAILED'),{statusCode:res.statusCode,response:parsed})); });
        });
        req.on('error',reject); req.write(body); req.end();
      });
    }
  };
}
module.exports={createWhatsAppSender};
