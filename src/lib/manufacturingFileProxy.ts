import 'server-only';
import {createHash} from 'node:crypto';
import {scopedAccountMode} from './deployAccess';
import {readSharedCookies} from './sharedSessionBroker';
import {trustedInternalServiceUrl} from './internalServiceUrl';
import {boundedSchoolBody} from './schoolsProxySecurity';
import {WindowRateLimiter} from './requestSecurity';
const mainHosts=new Set(['cbgpu.com','www.cbgpu.com','app.cbgpu.com','student.cbgpu.com','researcher.cbgpu.com','developer.cbgpu.com']);
const portalHosts=new Set(['admin.cbgpu.com','manufacturing.cbgpu.com','print.cbgpu.com','laser.cbgpu.com']);
const headers={'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"sandbox; default-src 'none'; frame-ancestors 'none'",'Vary':'Authorization, Cookie, Host'};
const tokenPattern=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
export function manufacturingFileToken(request:Request):string|null{
 const authority=request.headers.get('host')||new URL(request.url).host;
 if(/[\s,\\/@]/.test(authority))return null;
 let rawHost:string;try{rawHost=new URL('http://'+authority).hostname.toLowerCase()}catch{return null}
 const forwarded=request.headers.get('x-cbgpu-public-host');
 const host=['localhost','127.0.0.1'].includes(rawHost)&&forwarded?forwarded:rawHost;
 if(!mainHosts.has(host)&&!portalHosts.has(host))return null;
 if(request.headers.get('sec-fetch-site')==='cross-site')return null;
 let token:unknown;
 if(request.headers.has('authorization'))token=request.headers.get('authorization')?.match(/^Bearer\s+([^\s,]{1,8192})$/i)?.[1];
 else if(mainHosts.has(host)){
  try{const cookie=readSharedCookies(request.headers.get('cookie')||'');if(cookie.loggedOut||!cookie.value)return null;token=JSON.parse(cookie.value).access_token}catch{return null}
 }
 // Portal identities must use their current SDK bearer; never borrow a main-site account cookie.
 return typeof token==='string'&&token.length<=8192&&tokenPattern.test(token)?token:null;
}
export type FileProxyDeps={
 enabled:()=>boolean;
 authorize:(token:string,key:string,signal:AbortSignal)=>Promise<boolean>;
 open:(token:string,key:string,metadata:boolean,method:string,range:string|null,signal:AbortSignal)=>Promise<Response>;
 heartbeatMs?:number;deadlineMs?:number;maxStreams?:number;authorityTimeoutMs?:number;openingTimeoutMs?:number;
};
const reply=(status:number)=>Response.json({error:status===401?'SIGN_IN_REQUIRED':status===404?'FILE_NOT_AVAILABLE':status===429?'FILE_TRANSFER_BUSY':'FILE_AUTHORITY_UNAVAILABLE'},{status,headers});
export function createManufacturingFileProxy(deps:FileProxyDeps){
 let active=0;const limits=new WindowRateLimiter(120,60_000);
 return async function handle(request:Request){
  try{if(!deps.enabled())return reply(404)}catch{return reply(503)}
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
  const url=new URL(request.url),key=url.searchParams.get('key')||'',metadata=url.searchParams.get('metadata')==='1';
  if(!key||key.length>2048||/[\\\u0000-\u001f\u007f]/.test(key)||key.split('/').some(part=>!part||part==='.'||part==='..'))return reply(404);
  const token=manufacturingFileToken(request);if(!token)return reply(401);
  if(!limits.allow(createHash('sha256').update(token).digest('hex')))return reply(429);
  const range=request.headers.get('range');if(range&&(range.length>100||!/^bytes=(?:\d+-\d*|-\d+)$/.test(range)))return new Response(null,{status:416,headers});
  // Include pending authority/open requests in the cap, not only established streams.
  if(active>=(deps.maxStreams??8))return reply(429);active++;
  const controller=new AbortController();let released=false,closed=false;
  let reader:ReadableStreamDefaultReader<Uint8Array>|undefined,sink:ReadableStreamDefaultController<Uint8Array>|undefined;
  let heartbeat:ReturnType<typeof setInterval>|undefined,deadline:ReturnType<typeof setTimeout>|undefined;
  const release=()=>{if(released)return;released=true;active--;clearInterval(heartbeat);clearTimeout(deadline);request.signal.removeEventListener('abort',fail)};
  const fail=()=>{if(closed)return;closed=true;release();controller.abort();void reader?.cancel().catch(()=>{});try{sink?.error(Error('File authority changed or became unavailable'))}catch{}};
  const bounded=async<T,>(operation:()=>Promise<T>,milliseconds:number):Promise<T>=>{
   if(controller.signal.aborted)throw Error('File request aborted');
   let rejectAbort:(reason:Error)=>void=()=>{};
   const interrupted=new Promise<never>((_,reject)=>{rejectAbort=reject});
   const abort=()=>rejectAbort(Error('File request aborted'));
   controller.signal.addEventListener('abort',abort,{once:true});
   const timer=setTimeout(()=>controller.abort(),milliseconds);
   try{return await Promise.race([Promise.resolve().then(operation),interrupted])}
   finally{clearTimeout(timer);controller.signal.removeEventListener('abort',abort)}
  };
  const prove=()=>bounded(()=>deps.authorize(token,key,controller.signal),deps.authorityTimeoutMs??3000);
  request.signal.addEventListener('abort',fail,{once:true});if(request.signal.aborted)fail();
  try{
   if(!await prove()){release();return reply(404)}
   if(controller.signal.aborted)throw Error('File request aborted');
   const upstream=await bounded(async()=>{const result=await deps.open(token,key,metadata,request.method,range,controller.signal);if(controller.signal.aborted){await result.body?.cancel();throw Error('File request aborted')}return result},deps.openingTimeoutMs??10_000);
   if(controller.signal.aborted){await upstream.body?.cancel();throw Error('File request aborted')}
   if(![200,206,304,416].includes(upstream.status)){await upstream.body?.cancel();release();return reply([400,401,403,404].includes(upstream.status)?404:503)}
   const out=new Headers(headers);for(const name of ['content-length','content-range','accept-ranges','etag','last-modified']){const value=upstream.headers.get(name);if(value)out.set(name,value)}
   out.set('Content-Type',metadata?'application/json':'application/octet-stream');
   const name=(key.split('/').at(-1)||'file').replace(/[^A-Za-z0-9._-]/g,'_').slice(0,180)||'file';out.set('Content-Disposition',`attachment; filename="${name}"`);
   if(request.method==='HEAD'||!upstream.body||[304,416].includes(upstream.status)){await upstream.body?.cancel();release();return new Response(null,{status:upstream.status,headers:out})}
   reader=upstream.body.getReader();let checking=false;
   heartbeat=setInterval(()=>{if(checking||closed)return;checking=true;void prove().then(allowed=>{if(!allowed)fail()},fail).finally(()=>{checking=false})},deps.heartbeatMs??5000);
   deadline=setTimeout(fail,deps.deadlineMs??20*60_000);
   const body=new ReadableStream<Uint8Array>({
    start(value){sink=value;if(controller.signal.aborted)fail()},
    async pull(value){try{const next=await reader!.read();if(closed)return;if(next.done){closed=true;release();value.close()}else value.enqueue(next.value)}catch{fail()}},
    async cancel(){closed=true;release();controller.abort();try{await reader?.cancel()}catch{}}
   });
   return new Response(body,{status:upstream.status,headers:out});
  }catch{fail();return reply(503)}
 };
}
function target(){return trustedInternalServiceUrl(process.env.SUPABASE_INTERNAL_URL||'http://127.0.0.1:54321',process.env.CBGPU_INTERNAL_NETWORK_MODE)}
export const manufacturingFileProxy=createManufacturingFileProxy({
 enabled:()=>scopedAccountMode(),
 authorize:async(token,key,signal)=>{
  const endpoint=target(),anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!anon)throw Error('File authority unavailable');endpoint.pathname='/rest/v1/rpc/cbgpu_manufacturing_file_access';endpoint.search='';endpoint.hash='';
  const response=await fetch(endpoint,{method:'POST',headers:{apikey:anon,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({p_object_name:key}),cache:'no-store',redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(3000)])});
  if(response.status===401||response.status===403)return false;if(!response.ok)throw Error('File authority unavailable');
  const value:unknown=JSON.parse(await boundedSchoolBody(response.body,1024));if(typeof value!=='boolean')throw Error('Invalid file authority');return value;
 },
 open:async(token,key,metadata,method,range,signal)=>{
  const endpoint=target(),anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!anon)throw Error('File service unavailable');endpoint.pathname='/storage/v1/object/'+(metadata?'info/authenticated/':'authenticated/')+'manufacturing/'+key.split('/').map(encodeURIComponent).join('/');endpoint.search='';endpoint.hash='';
  return fetch(endpoint,{method,headers:{apikey:anon,Authorization:'Bearer '+token,'Accept-Encoding':'identity',...(range&&!metadata?{Range:range}:{})},cache:'no-store',redirect:'error',signal});
 }
});
