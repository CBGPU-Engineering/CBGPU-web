import http from 'node:http';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sites=new Map([[3000,'cbgpu.com'],[3001,'researcher.cbgpu.com'],[3002,'admin.cbgpu.com'],[3003,'student.cbgpu.com'],[3004,'app.cbgpu.com'],[3005,'docs.cbgpu.com'],[3006,'arxiv.cbgpu.com'],[3007,'manufacturing.cbgpu.com'],[3008,'print.cbgpu.com'],[3009,'laser.cbgpu.com']]);
const ports=new Map([...sites].map(([port,host])=>[host,port]));
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3099'],{cwd:root,stdio:'inherit',env:process.env});
const servers=[];
for(const [port,host] of sites){
 const headers=req=>({...req.headers,host,'x-forwarded-host':host,'x-forwarded-proto':'http'});
 const server=http.createServer((req,res)=>{
  const upstream=http.request({hostname:'127.0.0.1',port:3099,path:req.url,method:req.method,headers:headers(req)},response=>{
   const h={...response.headers};
   if(h.location){try{const u=new URL(h.location);if(ports.has(u.hostname))h.location='http://localhost:'+ports.get(u.hostname)+u.pathname+u.search+u.hash;}catch{}}
   res.writeHead(response.statusCode,h);response.pipe(res);
  });
  upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('Development server is starting. Reload shortly.');});req.pipe(upstream);
 });
 server.on('upgrade',(req,socket,head)=>{
  const upstream=net.connect(3099,'127.0.0.1',()=>{
   const h=headers(req);upstream.write(req.method+' '+req.url+' HTTP/'+req.httpVersion+'\r\n'+Object.entries(h).map(([k,v])=>k+': '+v).join('\r\n')+'\r\n\r\n');if(head.length)upstream.write(head);socket.pipe(upstream);upstream.pipe(socket);
  });upstream.on('error',()=>socket.destroy());socket.on('error',()=>upstream.destroy());
 });
 server.listen(port,'127.0.0.1',()=>console.log(host+' -> http://localhost:'+port));servers.push(server);
}
function stop(){for(const s of servers)s.close();child.kill('SIGTERM');setTimeout(()=>process.exit(0),500).unref();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);child.on('exit',stop);
