const { createServer } = require('./server');
const http = require('node:http');
function request(server, path){ return new Promise((resolve,reject)=>{const addr=server.address(); const r=http.get({host:addr.address,port:addr.port,path},res=>{let b='';res.on('data',c=>b+=c);res.on('end',()=>resolve({status:res.statusCode,body:b}));});r.on('error',reject);});}
(async()=>{const s=createServer({env:{}}); await new Promise(r=>s.listen(0,'127.0.0.1',r)); const h=await request(s,'/health'); if(h.status!==503) throw Error('health must fail closed'); s.close(); console.log('PASS V1 HTTP server health gate');})();
