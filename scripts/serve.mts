/** Standard Next HTTP server with explicit, separately authorized notebook upgrades. */
import http from'node:http';
import{fileURLToPath}from'node:url';
import path from'node:path';
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
import{createRequire}from'node:module';
import type{Duplex}from'node:stream';
type NextFrontend={prepare:()=>Promise<void>;getRequestHandler:()=>(r:http.IncomingMessage,s:http.ServerResponse)=>Promise<void>;close:()=>Promise<void>};
const next=createRequire(import.meta.url)('next') as(options:{dev:boolean;hostname:string;port:number})=>NextFrontend;
import{notebookUpgrade}from'../src/lib/notebookUpgrade.ts';
const host=process.env.HOSTNAME||'127.0.0.1',port=Number(process.env.PORT||3000);if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid web listener port');
const app=next({dev:false,hostname:host,port});await app.prepare();const handle=app.getRequestHandler();
// Next lazily attaches another upgrade listener after the first HTTP request.
// Handle only reserved notebook paths before that listener; leave every other upgrade to Next.
class FrontendServer extends http.Server{
 override emit(event:string|symbol,...args:unknown[]):boolean{
  if(event==='upgrade'){const[request,socket,head]=args as[http.IncomingMessage,Duplex,Buffer];if(notebookUpgrade(request,socket,head))return true;if(this.listenerCount('upgrade')===0){socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');return true}}
  return Reflect.apply(http.Server.prototype.emit,this,[event,...args]) as boolean;
 }
}
const server=new FrontendServer((request,response)=>{void handle(request,response)});
server.listen(port,host,()=>console.log(JSON.stringify({service:'cbgpu-web',event:'ready'})));
let closing=false;async function stop(){if(closing)return;closing=true;server.close();await app.close();process.exit(0)}process.on('SIGTERM',()=>{void stop()});process.on('SIGINT',()=>{void stop()});
