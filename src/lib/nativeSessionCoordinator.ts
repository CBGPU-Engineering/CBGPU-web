/** Native and WebView clients must never independently rotate the same session. */
export type Tokens={access_token:string;refresh_token:string};
type Persisted={accessToken:string;refreshToken:string};
type Bridge={getPersistedSession:()=>Promise<{session:Persisted|null}>;syncSession:(tokens:Persisted)=>Promise<unknown>};
type Fork={source_session:Tokens;session:Tokens|null;error?:string};
type Options={webSession:()=>Promise<Tokens|null>;saveWeb:(tokens:Tokens)=>Promise<unknown>;fork:(tokens:Tokens)=>Promise<Fork>};
function identity(token:string):{sub?:string;session_id?:string}{
 try{return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))}catch{return {}}
}
const native=(s:Tokens)=>({accessToken:s.access_token,refreshToken:s.refresh_token});
export function createNativeSessionCoordinator(options:Options){
 let generation=0,busy:Promise<void>|null=null;
 const run=(operation:(epoch:number)=>Promise<void>)=>{
  if(busy)return busy;
  const epoch=generation;
  const task=Promise.resolve().then(()=>operation(epoch));busy=task;
  void task.finally(()=>{if(busy===task)busy=null}).catch(()=>{});
  return task;
 };
 return {
  cancel(){generation++;busy=null},
  syncWeb(session:Tokens,bridge:Bridge){return run(async epoch=>{
   const saved=(await bridge.getPersistedSession()).session;
   if(epoch!==generation)return;
   // These claims only avoid unnecessary synchronization; the server verifies
   // identity and refresh credentials before issuing any new session.
   const web=identity(session.access_token),other=saved?identity(saved.accessToken):{};
   if(web.sub&&web.sub===other.sub&&web.session_id&&other.session_id&&web.session_id!==other.session_id)return;
   const result=await options.fork(session);if(epoch!==generation)return;
   await options.saveWeb(result.source_session);if(epoch!==generation)return;
   if(!result.session)throw new Error(result.error||'Native session unavailable');
   await bridge.syncSession(native(result.session));
  })},
  restore(bridge:Bridge){return run(async epoch=>{
   const saved=(await bridge.getPersistedSession()).session;
   if(!saved||epoch!==generation)return;
   const result=await options.fork({access_token:saved.accessToken,refresh_token:saved.refreshToken});
   if(epoch!==generation)return;
   // Preserve the refreshed native credential even if creating a WebView
   // session failed. Network trouble must never clear the native login.
   await bridge.syncSession(native(result.source_session));if(epoch!==generation)return;
   if(!result.session)throw new Error(result.error||'Web session unavailable');
   const current=await options.webSession();if(epoch!==generation||current)return;
   await options.saveWeb(result.session);
  })},
 };
}
