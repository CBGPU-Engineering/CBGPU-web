import{WindowRateLimiter}from'./requestSecurity.ts';
const nodeHandshakeLimits=new WindowRateLimiter(60,60_000);
/** Frontend transport only: hand authenticated notebook upgrades to the Rust relay.
 * Next's external HTTP rewrites do not reliably complete WebSocket upgrades. */
import http,{type IncomingMessage}from'node:http';
import type{Duplex}from'node:stream';
import{notebookEdgeAllowed}from'./notebookEdge.ts';
import{trustedInternalServiceUrl}from'./internalServiceUrl.ts';
const value=(v:string|string[]|undefined)=>typeof v==='string'?v:'';
export function notebookUpgrade(request:IncomingMessage,socket:Duplex,head:Buffer):boolean{
 const url=request.url||'',node=url==='/v1/gpu/relay',edge=url.startsWith('/__notebook_gateway/');if(!node&&!edge)return false;
 const deny=(status=404)=>{socket.end(`HTTP/1.1 ${status} ${status===404?'Not Found':'Service Unavailable'}\r\nConnection: close\r\nContent-Length: 0\r\nCache-Control: no-store\r\n\r\n`);return true};
 if(process.env.CBGPU_GPU_NOTEBOOKS_ENABLED!=='1'||request.method!=='GET')return deny();
 const host=value(request.headers.host).toLowerCase();if(!['cbgpu.com','www.cbgpu.com','localhost','127.0.0.1'].includes(host.split(':')[0]))return deny();
 if(node&&!nodeHandshakeLimits.allow((value(request.headers['cf-connecting-ip'])||request.socket.remoteAddress||'local').slice(0,128)))return deny(429);
 const path=edge?url.slice('/__notebook_gateway'.length):url;
 if(edge&&(!/^\/notebooks\/[a-f0-9-]{36}\//.test(path)||!notebookEdgeAllowed(value(request.headers['x-cbgpu-note-edge']))))return deny();
 let target:URL;try{target=trustedInternalServiceUrl(process.env.CBGPU_NOTEBOOK_RELAY_URL||'http://127.0.0.1:3557',process.env.CBGPU_INTERNAL_NETWORK_MODE);if(target.protocol!=='http:')return deny(503);const parsed=new URL(path,'http://local.invalid');target.pathname=parsed.pathname;target.search=parsed.search;}catch{return deny(503)}
 const headers:http.OutgoingHttpHeaders={...request.headers,host:node?'cbgpu.com':'notebooks.cbgpu.com','x-cbgpu-public-host':node?'cbgpu.com':'notebooks.cbgpu.com'};delete headers.authorization;delete headers.cookie;delete headers['x-cbgpu-note-edge'];
 if(edge){const cookies=value(request.headers.cookie).split(';').map(v=>v.trim()).filter(v=>v.startsWith('__Secure-cbgpu-notebook=')||v.startsWith('_xsrf='));if(cookies.length)headers.cookie=cookies.join('; ')}
 const upstream=http.request(target,{method:'GET',headers,agent:false});let connected=false;
 const timer=setTimeout(()=>{if(!connected){upstream.destroy();deny(503)}},10000);timer.unref();
 const fail=()=>{clearTimeout(timer);upstream.destroy();if(!socket.destroyed)socket.destroy()};socket.once('error',fail);socket.once('close',()=>{if(!connected)fail()});
 upstream.once('error',()=>{clearTimeout(timer);if(!connected&&!socket.destroyed)deny(503)});
 upstream.once('response',response=>{clearTimeout(timer);response.resume();if(!socket.destroyed)deny(response.statusCode===403?404:503)});
 upstream.once('upgrade',(response,remote,bytes)=>{clearTimeout(timer);if(response.statusCode!==101){remote.destroy();deny(503);return}connected=true;
  const fields:string[]=[];for(let i=0;i<response.rawHeaders.length;i+=2){const name=response.rawHeaders[i],v=response.rawHeaders[i+1];if(!/[\r\n]/.test(name+v))fields.push(name+': '+v)}
  socket.write('HTTP/1.1 101 Switching Protocols\r\n'+fields.join('\r\n')+'\r\n\r\n');if(bytes.length)socket.write(bytes);if(head.length)remote.write(head);
  remote.once('error',()=>socket.destroy());socket.once('error',()=>remote.destroy());remote.once('close',()=>socket.destroy());socket.once('close',()=>remote.destroy());remote.pipe(socket);socket.pipe(remote);
 });upstream.end();return true;
}
