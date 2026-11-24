const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve('dist');
const csp=require('../vercel.json').headers[0].headers.find(h=>h.key==='Content-Security-Policy').value;
http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  const target=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  res.setHeader('Content-Security-Policy',csp);
  res.setHeader('Content-Type',({'.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.html':'text/html','.webmanifest':'application/manifest+json','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8','.json':'application/json; charset=utf-8'}[path.extname(target)]||'text/plain'));
  fs.createReadStream(target).on('error',()=>{res.writeHead(404);res.end();}).pipe(res);
}).listen(Number(process.env.CAMPUS_TEST_PORT||8882),'127.0.0.1');
