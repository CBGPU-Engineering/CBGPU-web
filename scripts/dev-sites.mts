import http from 'node:http';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sites=new Map([[3000,'cbgpu.com'],[3001,'researcher.cbgpu.com'],[3002,'admin.cbgpu.com'],[3003,'app.cbgpu.com'],[3004,'docs.cbgpu.com'],[3005,'arxiv.cbgpu.com'],[3006,'manufacturing.cbgpu.com'],[3007,'print.cbgpu.com'],[3008,'laser.cbgpu.com'],[3009,'developers.cbgpu.com']]);
const ports=new Map([...sites].map(([port,host])=>[host,port]));
ports.set('student.cbgpu.com',3000);
const devOrigins=JSON.stringify({...Object.fromEntries([...sites].map(([port,host])=>[host,'http://localhost:'+port])),'student.cbgpu.com':'http://localhost:3000'});
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3099'],{cwd:root,stdio:'inherit',env:{...process.env,NEXT_PUBLIC_CBGPU_SITE_ORIGINS:devOrigins}});
const servers=[];
for(const [port,host] of sites){
 const upstreamPort=host==='developers.cbgpu.com'?3400:3099;
 const headers=req=>({...req.headers,host,'x-forwarded-host':host,'x-forwarded-proto':'http'});
 const server=http.createServer((req,res)=>{
  const upstream=http.request({hostname:'127.0.0.1',port:upstreamPort,path:req.url,method:req.method,headers:headers(req)},response=>{
   const h={...response.headers};
   if(h.location){try{const u=new URL(h.location);if(ports.has(u.hostname))h.location='http://localhost:'+ports.get(u.hostname)+u.pathname+u.search+u.hash;}catch{}}
   res.writeHead(response.statusCode,h);response.pipe(res);
  });
  upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('Development server is starting. Reload shortly.');});req.pipe(upstream);
 });
 server.on('upgrade',(req,socket,head)=>{
  const upstream=net.connect(upstreamPort,'127.0.0.1',()=>{
   const h=headers(req);upstream.write(req.method+' '+req.url+' HTTP/'+req.httpVersion+'\r\n'+Object.entries(h).map(([k,v])=>k+': '+v).join('\r\n')+'\r\n\r\n');if(head.length)upstream.write(head);socket.pipe(upstream);upstream.pipe(socket);
  });upstream.on('error',()=>socket.destroy());socket.on('error',()=>upstream.destroy());
 });
 server.listen(port,'127.0.0.1',()=>console.log(host+' -> http://localhost:'+port));servers.push(server);
}
function stop(){for(const s of servers)s.close();child.kill('SIGTERM');setTimeout(()=>process.exit(0),500).unref();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);child.on('exit',stop);
