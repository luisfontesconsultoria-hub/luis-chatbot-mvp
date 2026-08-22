const http = require('http');
const { routeRequest } = require('./routes');
const PORT = Number(process.env.PORT || 10000);
const server = http.createServer((req,res) => {
  const chunks=[]; let size=0;
  req.on('data', chunk => { size += chunk.length; if (size > 1024*1024) req.destroy(); else chunks.push(chunk); });
  req.on('end', () => {
    const result = routeRequest({ method:req.method, path:(req.url || '').split('?')[0] });
    res.statusCode = result.status;
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.end(JSON.stringify(result.body));
  });
});
if (require.main === module) server.listen(PORT, '0.0.0.0');
module.exports = { server };
