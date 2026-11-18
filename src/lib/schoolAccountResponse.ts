import {boundedSchoolBody} from './schoolsProxySecurity.ts';
/** One bounded request, including its body. Mutations are never retried. */
export async function schoolAccountResponse(url:string,init:RequestInit,timeoutMs=30000,fetcher:typeof fetch=fetch){
 const unavailable='학교 요청 결과를 확인하지 못했어요. 새로고침 후 상태를 확인해주세요.';
 if(!url.startsWith('/api/schools/')||url.includes('#'))throw Error(unavailable);
 const controller=new AbortController();let response:Response|undefined,timer:ReturnType<typeof setTimeout>|undefined;
 const abort=()=>controller.abort();
 if(init.signal?.aborted)abort();else init.signal?.addEventListener('abort',abort,{once:true});
 try{
  const interrupted=new Promise<never>((_,reject)=>{
   const failed=()=>reject(Error(unavailable));
   if(controller.signal.aborted)failed();else controller.signal.addEventListener('abort',failed,{once:true});
   timer=setTimeout(()=>controller.abort(),timeoutMs);
  });
  const work=(async()=>{
   if(controller.signal.aborted)throw Error(unavailable);
   response=await fetcher(url,{...init,redirect:'error',cache:'no-store',signal:controller.signal,headers:{...Object.fromEntries(new Headers(init.headers)),Accept:'application/json'}});
   if(response.redirected||!/^application\/(?:json|[\w.+-]+\+json)(?:\s*;|$)/i.test(response.headers.get('content-type')??''))throw Error(unavailable);
   const data:unknown=JSON.parse(await boundedSchoolBody(response.body,8*1024*1024));
   if(!data||typeof data!=='object'||Array.isArray(data))throw Error(unavailable);
   return{response,data:data as Record<string,any>};
  })();
  return await Promise.race([work,interrupted]);
 }catch{throw Error(unavailable)}finally{
  if(timer)clearTimeout(timer);init.signal?.removeEventListener('abort',abort);
  if(controller.signal.aborted&&response?.body&&!response.body.locked)void response.body.cancel().catch(()=>{});
 }
}
