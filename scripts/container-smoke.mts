import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,chmodSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';

// Disposable, offline proof only: no Docker socket or operating credentials are mounted.
const image=process.env.CBGPU_REVIEW_IMAGE||'cbgpu-web:portable-candidate';
const run=(...args:string[])=>execFileSync('docker',args,{encoding:'utf8',timeout:60_000,maxBuffer:1024*1024}).trim();
const fixture=mkdtempSync(join(tmpdir(),'cbgpu-container-proof-'));
const containers:string[]=[];
const upstream=String.raw`const http=require('http'),crypto=require('crypto');const s=http.createServer((q,r)=>{if(q.url.startsWith('/realtime/')){r.writeHead(200,{'Content-Type':'text/event-stream'});r.write('data: one\n\n');setTimeout(()=>r.end('data: two\n\n'),50);return}r.setHeader('Content-Type','application/json');r.end(JSON.stringify({path:q.url,authorization:q.headers.authorization||null,port:Number(process.env.PROBE_PORT)}))});s.on('upgrade',(q,socket)=>{const accept=crypto.createHash('sha1').update(q.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');setTimeout(()=>socket.end(),300)});s.listen(Number(process.env.PROBE_PORT),'127.0.0.1');`;
const probe=String.raw`(async()=>{const a=require('node:assert/strict'),base='http://127.0.0.1:3000';let healthy=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok){healthy=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}a(healthy);a.equal(process.getuid(),65532);a.equal((await(await fetch(base+'/api/app-release')).json()).buildNumber,13);a.equal(await(await fetch(base+'/downloads/proof.apk')).text(),'SYNTHETIC-APK');const d=await(await fetch(base+'/backend/rest/v1/probe?select=id',{headers:{host:'cbgpu.com',Authorization:'Bearer synthetic-only'}})).json();a.equal(d.port,Number(process.env.PROBE_PORT));a.equal(d.path,'/rest/v1/probe?select=id');a.equal(d.authorization,'Bearer synthetic-only');a.equal(await(await fetch(base+'/backend/realtime/v1/events',{headers:{host:'cbgpu.com'}})).text(),'data: one\n\ndata: two\n\n');await new Promise((resolve,reject)=>{const socket=require('node:net').connect(3000,'127.0.0.1');let bytes='';const timer=setTimeout(()=>{socket.destroy();reject(Error('WS timeout'))},5000);socket.on('connect',()=>socket.write('GET /backend/realtime/v1/websocket HTTP/1.1\r\nHost: cbgpu.com\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: YWJjZGVmZ2hpamtsbW5vcA==\r\n\r\n'));socket.on('data',b=>{bytes+=b;if(bytes.includes('\r\n\r\n')){clearTimeout(timer);socket.destroy();try{a.match(bytes,/^HTTP\/1\.1 101 /);resolve()}catch(e){reject(e)}}});socket.on('error',reject)});a.equal((await fetch(base+'/backend/studio',{headers:{host:'cbgpu.com'}})).status,404);console.log('PASS HTTP, APK, SSE, WebSocket and service boundary');})().catch(e=>{console.error(e);process.exitCode=1})`;
try{
 chmodSync(fixture,0o755);
 writeFileSync(join(fixture,'android-release.json'),JSON.stringify({version:'1.0.12',buildNumber:13}));
 writeFileSync(join(fixture,'proof.apk'),'SYNTHETIC-APK');
 const digest=run('image','inspect',image,'--format','{{.Id}}');
 for(const port of [19090,19091]){
  const id=run('run','-d','--init','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','256','--memory','1g','--cpus','2','--tmpfs','/tmp:rw,nosuid,nodev,size=256m,mode=1777','--tmpfs','/app/.next/cache:rw,nosuid,nodev,size=128m,uid=65532,gid=65532','--mount',`type=bind,src=${fixture},dst=/app/public/downloads,readonly`,'-e',`CBGPU_BACKEND_PROXY_URL=http://127.0.0.1:${port}`,'-e',`PROBE_PORT=${port}`,image);
  containers.push(id);
  run('exec','-d',id,'/nodejs/bin/node','-e',upstream);
  console.log(run('exec',id,'/nodejs/bin/node','-e',probe));
  assert.equal(run('inspect',id,'--format','{{.Image}}'),digest);
  run('stop','--time','20',id);
  assert([0,143].includes(Number(run('inspect',id,'--format','{{.State.ExitCode}}'))),'must drain SIGTERM without SIGKILL');
 }
 console.log('PASS same image, two runtime upstreams, UID 65532, read-only root, no external network or published ports');
}finally{
 for(const id of containers){try{run('rm','-f',id)}catch{}}
 rmSync(fixture,{recursive:true,force:true});
}
