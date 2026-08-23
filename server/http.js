const http = require('http');
const { routeRequest } = require('./routes');
const PORT = Number(process.env.PORT || 10000);

const server = http.createServer((req,res) => {
  const chunks=[];
  let size=0;

  req.on('data', chunk => {
    size += chunk.length;
    if (size > 1024*1024) {
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', async () => {
    const rawBody=Buffer.concat(chunks).toString('utf8');
    let body={};
    try {
      body=rawBody ? JSON.parse(rawBody) : {};
    } catch {
      res.statusCode=400;
      res.setHeader('Content-Type','application/json; charset=utf-8');
      res.end(JSON.stringify({error:'INVALID_JSON'}));
      return;
    }

    const url=new URL(req.url || '/', 'http://localhost');

    try {
      const result=await routeRequest({
        method:req.method,
        path:url.pathname,
        query:Object.fromEntries(url.searchParams.entries()),
        body,
        rawBody,
        signatureHeader:req.headers['x-hub-signature-256'] || ''
      });
      res.statusCode=result.status;
      res.setHeader('Content-Type', result.text ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8');
      res.end(result.text ? String(result.body) : JSON.stringify(result.body));
    } catch {
      res.statusCode=500;
      res.setHeader('Content-Type','application/json; charset=utf-8');
      res.end(JSON.stringify({error:'INTERNAL_SERVER_ERROR'}));
    }
  });
});

if (require.main === module) server.listen(PORT,'0.0.0.0');
module.exports={server};
