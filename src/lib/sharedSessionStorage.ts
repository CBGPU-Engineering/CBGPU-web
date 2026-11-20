/** Shared login broker. Parent-domain credentials are written only by the server as HttpOnly cookies. */
export const SHARED_SESSION_KEY = 'sb-cbgpu-auth-token';
export type LocalStore = Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export type SharedSessionReply = {value:string|null;state:'active'|'empty'|'signed-out'};
export type SharedSessionIntent = 'login'|'sync'|'adopt';
export type SharedSessionTransport = (method:'GET'|'POST',value?:string|null,intent?:SharedSessionIntent)=>Promise<SharedSessionReply>;
const TRUSTED = new Set(['cbgpu.com','www.cbgpu.com','app.cbgpu.com','student.cbgpu.com','researcher.cbgpu.com','developer.cbgpu.com','docs.cbgpu.com','arxiv.cbgpu.com','manufacturing.cbgpu.com','print.cbgpu.com','laser.cbgpu.com','localhost','127.0.0.1']);
const EQUIPMENT = new Set(['manufacturing.cbgpu.com','print.cbgpu.com','laser.cbgpu.com']);
export function isSharedSessionHost(hostname:string,portalGate=false):boolean {
 const host=hostname.toLowerCase();return TRUSTED.has(host)&&!(portalGate&&EQUIPMENT.has(host));
}
export function createSharedSessionStorage(options:{hostname:string;local:LocalStore;transport:SharedSessionTransport}) {
 const {local,transport}=options;
 const read=(key:string)=>{try{return local.getItem(key)}catch{return null}};
 const write=(key:string,value:string|null)=>{try{if(value===null)local.removeItem(key);else local.setItem(key,value)}catch{/* Native/session memory remains available when storage is blocked. */}};
 const marker=SHARED_SESSION_KEY+':broker-seen';
 let queue=Promise.resolve();
 // Share only in-flight reads, never cache verification across completed calls.
 // A login/logout fences older responses before they can rewrite local credentials.
 let epoch=0;
 let pendingRead:{epoch:number;promise:Promise<string|null>}|null=null;
 const serialize=<T>(fn:()=>Promise<T>):Promise<T>=>{const result=queue.then(fn,fn);queue=result.then(()=>{},()=>{});return result};
 return {
  async getItem(key:string):Promise<string|null>{
   if(key!==SHARED_SESSION_KEY)return read(key); // PKCE verifier and other SDK state never become parent cookies.
   if(pendingRead?.epoch===epoch)return pendingRead.promise;
   const readEpoch=epoch;
   const result=serialize(async()=>{
    if(epoch!==readEpoch)return read(key);
    const cached=read(key);
    try{
     if(read(marker)==='logout-pending'){await transport('POST',null);if(epoch!==readEpoch)return read(key);write(marker,'1');return null;}
     if(['login-pending','sync-pending'].includes(read(marker)||'')&&cached){const saved=await transport('POST',cached,read(marker)==='login-pending'?'login':'sync');if(epoch!==readEpoch)return read(key);if(saved.value){write(key,saved.value);write(marker,'1');return saved.value;}}
     const shared=await transport('GET');
     if(epoch!==readEpoch)return read(key);
     if(shared.state==='active'&&shared.value){write(key,shared.value);write(marker,'1');return shared.value;}
     if(shared.state==='signed-out'){write(key,null);write(marker,'1');return null;}
     // Adopt a pre-broker local session once. A previously shared cache cannot undo global sign-out/cookie expiry.
     if(cached&&!read(marker)){
      const adopted=await transport('POST',cached,'adopt');
      if(epoch!==readEpoch)return read(key);
      if(adopted.value){write(key,adopted.value);write(marker,'1');return adopted.value;}
     }
     write(key,null);return null;
    }catch{return epoch===readEpoch?cached:read(key);} // A network/Auth outage must not destroy a previously valid local/native session.
   });
   pendingRead={epoch:readEpoch,promise:result};
   const clear=()=>{if(pendingRead?.promise===result)pendingRead=null};
   void result.then(clear,clear);
   return result;
  },
  async setItem(key:string,value:string):Promise<void>{
   if(key!==SHARED_SESSION_KEY){write(key,value);return;}
   const writeEpoch=++epoch;
   const previous=read(key);
   let intent:SharedSessionIntent='login';
   try{const before=JSON.parse(previous||'null'),after=JSON.parse(value);const id=(v:{access_token?:string})=>v?.access_token?JSON.parse(atob(v.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id:null;const prior=id(before),next=id(after);if(prior&&prior===next)intent='sync';}catch{/* An explicit new/legacy login has no comparable session identity. */}
   write(key,value);write(marker,intent+'-pending'); // Preserve successful login and retry synchronization after an outage.
   await serialize(async()=>{try{const saved=await transport('POST',value,intent);if(epoch!==writeEpoch)return;write(key,saved.value);write(marker,'1');}catch{/* Retry on a later read/auth refresh. */}});
  },
  async removeItem(key:string):Promise<void>{
   const writeEpoch=key===SHARED_SESSION_KEY?++epoch:epoch;
   write(key,null);if(key!==SHARED_SESSION_KEY)return;
   write(marker,'logout-pending');
   await serialize(async()=>{try{await transport('POST',null);if(epoch===writeEpoch)write(marker,'1');}catch{/* Keep local sign-out and retry before reading shared cookies. */}});
  },
 };
}
export function browserSharedSessionStorage(){
 if(typeof window==='undefined'||!isSharedSessionHost(window.location.hostname,Boolean((window as {__CBGPU_PORTAL_GATE?:boolean}).__CBGPU_PORTAL_GATE)))return undefined;
 return createSharedSessionStorage({hostname:window.location.hostname,local:{getItem:k=>window.localStorage.getItem(k),setItem:(k,v)=>window.localStorage.setItem(k,v),removeItem:k=>window.localStorage.removeItem(k)},transport:async(method,value,intent)=>{
  const response=await fetch('/api/auth/shared-session',{method,credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15_000),headers:method==='POST'?{'Content-Type':'application/json'}:undefined,body:method==='POST'?JSON.stringify({value,intent}):undefined});
  if(!response.ok)throw Error('Shared session temporarily unavailable');
  return await response.json() as SharedSessionReply;
 }});
}
