import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const portIndex=process.argv.indexOf('--port');
const port=portIndex>=0?Number(process.argv[portIndex+1]):4173;
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Use a port between 1024 and 65535.');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  try {
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({app:'cabinet-of-wonders',version:1}));return;}
    const relative=decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html';
    if(relative!=='index.html'&&!relative.startsWith('src/')&&!relative.startsWith('assets/')){res.writeHead(404);res.end('Not found');return;}
    const target=path.resolve(root,relative);
    const resolvedRelative=path.relative(root,target);
    const permitted=resolvedRelative==='index.html'||resolvedRelative.startsWith(`src${path.sep}`)||resolvedRelative.startsWith(`assets${path.sep}`);
    if(!permitted||!target.startsWith(root+path.sep)||!mime[path.extname(target)]){res.writeHead(404);res.end('Not found');return;}
    const body=await fs.readFile(target);
    res.writeHead(200,{
      'Content-Type':mime[path.extname(target)],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff',
      'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    });
    res.end(req.method==='HEAD'?undefined:body);
  }catch(error){res.writeHead(error.code==='ENOENT'?404:400);res.end('Not found');}
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is in use. Use --port 4174 if another app owns it.`:error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`奇妙な収集館: http://127.0.0.1:${port}`));
