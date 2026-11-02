import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('public');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.wasm':'application/wasm','.woff2':'font/woff2','.onnx':'application/octet-stream','.md':'text/plain; charset=utf-8','.webm':'video/webm','.mp4':'video/mp4','.vtt':'text/vtt; charset=utf-8','.png':'image/png'};
http.createServer((req,res)=>{
  let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if (!file.startsWith(root + path.sep)) {res.writeHead(403).end();return;}
  try {
    if(fs.statSync(file).isDirectory()) file=path.join(file,'index.html');
    const stat=fs.statSync(file);
    res.writeHead(200, {'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache'});
    fs.createReadStream(file).pipe(res);
  }catch{res.writeHead(404).end('File non trovato');}
}).listen(4176,'127.0.0.1',()=>console.log('Demo: http://127.0.0.1:4176/materials/demo-genai/'));
