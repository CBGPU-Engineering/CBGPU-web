import {isSharedSessionHost,SHARED_SESSION_KEY} from './sharedSessionStorage';
export const SHARED_LOGOUT_COOKIE='cbgpu-shared-session-state';
const MAX=64*1024,MAX_CHUNKS=32;
export type VerifiedSharedSession={value:string;expiresAt:number};
export type SessionVerifier=(value:string)=>Promise<VerifiedSharedSession>;
const headers={'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Cross-Origin-Resource-Policy':'same-origin','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",'Vary':'Cookie, Origin, Host'};
function hostname(authority:string):string|null {try{const url=new URL('http://'+authority);return url.port&&(!['localhost','127.0.0.1'].includes(url.hostname))?null:url.hostname}catch{return null}}
export function trustedSharedRequest(request:Request):{host:string;secure:boolean}|null {
 const raw=request.headers.get('host')||new URL(request.url).host;
 if(/[\s,\\/@]/.test(raw))return null;
 let host=hostname(raw);if(!host||!isSharedSessionHost(host))return null;
 const local=['localhost','127.0.0.1'].includes(host);
 const forwarded=request.headers.get('x-cbgpu-public-host');
 const useForwarded=local&&forwarded&&!['localhost','127.0.0.1'].includes(forwarded);
 if(useForwarded){if(!isSharedSessionHost(forwarded)||['localhost','127.0.0.1'].includes(forwarded))return null;host=forwarded;}
 const expected=local&&!useForwarded?new URL(request.url).origin:'https://'+host;
 const origin=request.headers.get('origin');
 if(origin&&origin!==expected)return null;
 if(request.method==='POST'&&!origin)return null;
 if(request.headers.get('sec-fetch-site')==='cross-site')return null;
 const destination=request.headers.get('sec-fetch-dest');if(destination&&destination!=='empty')return null;
 return {host,secure:!(['localhost','127.0.0.1'].includes(host))};
}
export function readSharedCookies(header:string):{value:string|null;loggedOut:boolean;names:string[]} {
 const cookies=new Map<string,string>();let duplicate=false;
 for(const part of header.split(';')){const index=part.indexOf('=');if(index<0)continue;const key=part.slice(0,index).trim();if(key===SHARED_LOGOUT_COOKIE||key===SHARED_SESSION_KEY||new RegExp('^'+SHARED_SESSION_KEY+'\\.\\d+$').test(key)){if(cookies.has(key))duplicate=true;cookies.set(key,part.slice(index+1).trim());}}
 const names=[...cookies.keys()].filter(k=>k===SHARED_SESSION_KEY||k.startsWith(SHARED_SESSION_KEY+'.'));
 if(duplicate)throw Error('Ambiguous session cookie');
 let value='';let count=0;
 for(;count<MAX_CHUNKS&&cookies.has(SHARED_SESSION_KEY+'.'+count);count++){try{value+=decodeURIComponent(cookies.get(SHARED_SESSION_KEY+'.'+count)!)}catch{throw Error('Invalid session cookie')}if(value.length>MAX)throw Error('Session cookie too large');}
 if(names.some(name=>name!==SHARED_SESSION_KEY&&!Array.from({length:count},(_,i)=>SHARED_SESSION_KEY+'.'+i).includes(name)))throw Error('Non-contiguous session cookies');
 if(!value&&cookies.has(SHARED_SESSION_KEY)){try{value=decodeURIComponent(cookies.get(SHARED_SESSION_KEY)!)}catch{throw Error('Invalid session cookie')}}
 return {value:value||null,loggedOut:cookies.get(SHARED_LOGOUT_COOKIE)==='signed-out',names};
}
export function sessionCookieHeaders(value:string|null,host:string,oldNames:string[]):string[]{
 const suffix=`; Path=/; Max-Age=${value===null?0:365*24*60*60}; ${host==='localhost'||host==='127.0.0.1'?'':'Domain=.cbgpu.com; Secure; '}HttpOnly; SameSite=Lax`;
 const chunks:string[]=[];let chunk='';for(const character of value||''){const encoded=encodeURIComponent(character);if(chunk.length+encoded.length>2800){chunks.push(chunk);chunk='';}chunk+=encoded;}if(chunk)chunks.push(chunk);
 if(chunks.length>MAX_CHUNKS)throw Error('Shared session too large');
 const out=chunks.map((part,index)=>`${SHARED_SESSION_KEY}.${index}=${part}${suffix}`);
 for(const name of new Set(oldNames)){if(name===SHARED_SESSION_KEY||!chunks.some((_,i)=>name===SHARED_SESSION_KEY+'.'+i))out.push(`${name}=; Path=/; Max-Age=0; ${host==='localhost'||host==='127.0.0.1'?'':'Domain=.cbgpu.com; Secure; '}HttpOnly; SameSite=Lax`);}
 out.push(`${SHARED_LOGOUT_COOKIE}=${value===null?'signed-out':'active'}; Path=/; Max-Age=${365*24*60*60}; ${host==='localhost'||host==='127.0.0.1'?'':'Domain=.cbgpu.com; Secure; '}HttpOnly; SameSite=Lax`);
 return out;
}
export async function handleSharedSession(request:Request,verify:SessionVerifier):Promise<Response>{
 const reply=(body:unknown,status=200)=>Response.json(body,{status,headers});
 const trusted=trustedSharedRequest(request);if(!trusted)return reply({error:'Not found'},404);
 if(!['GET','POST'].includes(request.method))return reply({error:'Method not allowed'},405);
 let existing:ReturnType<typeof readSharedCookies>;try{existing=readSharedCookies(request.headers.get('cookie')||'')}catch{return reply({error:'Invalid session cookies'},400)}
 let value=request.method==='GET'&&existing.loggedOut?null:existing.value;let intent:'login'|'sync'|'adopt'='login';
 if(request.method==='POST'){
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return reply({error:'JSON required'},415);
  let text='';let bytes=0;const decoder=new TextDecoder();try{const reader=request.body?.getReader();if(!reader)return reply({error:'Invalid session'},400);for(;;){const {done,value:part}=await reader.read();if(done)break;bytes+=part?.byteLength||0;if(bytes>MAX*2){await reader.cancel();return reply({error:'Session too large'},413)}text+=decoder.decode(part,{stream:true})}const body=JSON.parse(text);if(!body||!Object.hasOwn(body,'value')||(body.value!==null&&typeof body.value!=='string'))return reply({error:'Invalid session'},400);if(body.intent!==undefined&&!['login','sync','adopt'].includes(body.intent))return reply({error:'Invalid session intent'},400);intent=body.intent||'login';value=body.value;}catch{return reply({error:'Invalid session'},400)}
 }
 if(request.method==='POST'&&value&&((intent==='sync'&&(!existing.value||existing.loggedOut))||(intent==='adopt'&&(existing.value||existing.loggedOut)))){
  // A background refresh or stale migration must not undo a cross-origin logout/new login.
  if(existing.value&&!existing.loggedOut){value=existing.value;}else{return reply({value:null,state:existing.loggedOut?'signed-out':'empty'});}
 }
 if(!value){
  const response=reply({value:null,state:request.method==='POST'||existing.loggedOut?'signed-out':'empty'});
  if(request.method==='POST')for(const cookie of sessionCookieHeaders(null,trusted.host,existing.names))response.headers.append('Set-Cookie',cookie);
  return response;
 }
 if(value.length>MAX)return reply({error:'Session too large'},413);
 try{
  let verified=await verify(value);
  if(request.method==='POST'&&intent==='sync'&&existing.value&&existing.value!==value){
   const current=await verify(existing.value);
   const identity=(raw:string)=>{try{const session=JSON.parse(raw),claims=JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return {id:session.user.id,session:claims.session_id,expiry:claims.exp};}catch{return null}};
   const incoming=identity(verified.value),prior=identity(current.value);
   // Never let a delayed refresh replace another login or a newer token rotation.
   if(!incoming||!prior||!incoming.session||incoming.id!==prior.id||incoming.session!==prior.session||prior.expiry>incoming.expiry)verified=current;
  }
  const response=reply({value:verified.value,state:'active'});
  for(const cookie of sessionCookieHeaders(verified.value,trusted.host,existing.names))response.headers.append('Set-Cookie',cookie);
  return response;
 }catch{return reply({error:'Session validation temporarily unavailable'},503)}
}
