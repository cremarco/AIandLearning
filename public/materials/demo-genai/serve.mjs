import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.wasm':'application/wasm','.woff2':'font/woff2','.onnx':'application/octet-stream','.md':'text/plain; charset=utf-8','.webm':'video/webm','.mp4':'video/mp4','.vtt':'text/vtt; charset=utf-8','.png':'image/png'};
const server=http.createServer((req,res)=>{
  let filename=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(filename!==root && !filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{
    if(fs.statSync(filename).isDirectory())filename=path.join(filename,'index.html');
    const stat=fs.statSync(filename);
    res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache'});
    fs.createReadStream(filename).pipe(res);
  }catch{res.writeHead(404).end('File not found');}
});
server.on('error',error=>{console.error(`Cannot start local server: ${error.message}. Close an existing server on port 4176 and retry.`);process.exitCode=1;});
server.listen(4176,'127.0.0.1',()=>console.log('GenAI lab: http://127.0.0.1:4176/ — Ctrl+C to stop'));
