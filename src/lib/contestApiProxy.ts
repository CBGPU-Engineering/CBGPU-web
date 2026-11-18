import {readFile} from 'node:fs/promises';
import {readJsonBody,RequestBodyError} from './requestSecurity.ts';

const jwtOrigin='http://127.0.0.1:3545',tokenOrigin='http://127.0.0.1:13545';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const common={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff',
 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, DELETE, OPTIONS',
 'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600'};
const json=(status:number,message:string)=>Response.json({message},{status,headers:common});
let active=0;

function allowed(path:string[],method:string){
 if(!path.length)return method==='GET';
 if(path.length===1&&path[0]==='register')return method==='POST';
 if(path.length===1&&path[0]==='tokens')return ['GET','POST'].includes(method);
 if(path.length===2&&path[0]==='tokens'&&uuid.test(path[1]))return method==='DELETE';
 if(!uuid.test(path[0]))return false;
 if(path.length===1)return method==='GET';
 if(path.length===2&&path[1]==='form')return method==='GET';
 if(path.length===2&&path[1]==='registrations')return method==='POST';
 return path.length===3&&path[1]==='registrations'&&path[2]==='me'&&['GET','DELETE'].includes(method);
}

/** Authentication, permissions and all contest writes live in the Rust service. */
export async function contestApiProxy(request:Request,path:string[],dependencies:{key?:()=>Promise<string>;fetch?:typeof fetch}={}){
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:common});
 const query=new URL(request.url).searchParams;
 if(!allowed(path,request.method))return json(404,'Unsupported contest API route');
 if(query.size&&(path.length||request.method!=='GET'||[...query].some(([key,value])=>
  !['limit','offset'].includes(key)||query.getAll(key).length!==1||!/^\d+$/.test(value)||
  Number(value)>(key==='limit'?100:10000)||(key==='limit'&&Number(value)<1))))return json(404,'Unsupported contest API query');
 const authorization=request.headers.get('authorization');
 if(!authorization||!/^Bearer [^\s]{1,8192}$/i.test(authorization))return json(401,'Use a CBGPU access token');
 if(active>=64)return json(503,'Contest API is busy; retry later');
 active++;
 try{
  let body:string|undefined;
  if(request.method==='POST'){
   if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return json(415,'Use application/json');
   const value=await readJsonBody(request,256*1024);
   if(!value||typeof value!=='object'||Array.isArray(value))return json(400,'Use a JSON object');
   body=JSON.stringify(value);
  }
  const key=(await (dependencies.key?.()??readFile('/home/cbgpu/.config/cbgpu/contest-api-internal-key','utf8'))).trim();
  if(key.length<32)throw new Error('Contest API is not configured');
  const lifecycle=path[0]==='tokens',personal=/^Bearer cbgpu_ct_/i.test(authorization);
  const origin=lifecycle||personal?tokenOrigin:jwtOrigin;
  const route=lifecycle?'/v1/'+path.join('/'):'/v1/contests'+(path.length?'/'+path.join('/'):'');
  const response=await (dependencies.fetch??fetch)(origin+route+(query.size?'?'+query.toString():''),{
   method:request.method,headers:{Authorization:authorization,'x-cbgpu-contest-key':key,'Content-Type':'application/json'},body,
   cache:'no-store',redirect:'error',signal:AbortSignal.timeout(25_000),
  });
  if(response.redirected||!/^application\/(?:json|[\w.+-]+\+json)(?:\s*;|$)/i.test(response.headers.get('content-type')||'')){await response.body?.cancel();return json(503,'Contest API is unavailable; retry later')}
  return new Response(response.body,{status:response.status,headers:{...common,'Content-Type':'application/json'}});
 }catch(error){
  return error instanceof RequestBodyError?json(error.status,error.status===413?'Request is too large':'Invalid JSON'):json(503,'Contest API is unavailable; retry later');
 }finally{active--}
}
