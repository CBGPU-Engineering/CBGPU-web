import {boundedSchoolBody} from './schoolsProxySecurity.ts';
/** A read-only school request has one deadline covering headers and streamed JSON. */
export async function schoolLifeRead(url:string,init:RequestInit={},timeoutMs=30000):Promise<{response:Response;value:Record<string,any>}>{
 if(!/^\/api\/(?:meal|timetable)(?:\?|$)/.test(url)||init.method&&init.method!=='GET')throw Error('학교 정보 조회 경로를 확인해 주세요.');
 const controller=new AbortController();let response:Response|undefined;
 const abort=()=>controller.abort(init.signal?.reason);
 if(init.signal?.aborted)abort();else init.signal?.addEventListener('abort',abort,{once:true});
 let timer:ReturnType<typeof setTimeout>|undefined;
 const unavailable='학교 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';
 try{
  if(controller.signal.aborted)throw Error(unavailable);
  const work=(async()=>{
   response=await fetch(url,{...init,method:'GET',cache:'no-store',redirect:'error',signal:controller.signal,headers:{...Object.fromEntries(new Headers(init.headers)),Accept:'application/json'}});
   if(response.redirected||!/^application\/(?:json|[\w.+-]+\+json)(?:\s*;|$)/i.test(response.headers.get('content-type')??''))throw Error(unavailable);
   const value:unknown=JSON.parse(await boundedSchoolBody(response.body,1048576));
   if(!value||typeof value!=='object'||Array.isArray(value))throw Error(unavailable);
   return {response,value:value as Record<string,any>};
  })();
  const interrupted=new Promise<never>((_,reject)=>{
   const failed=()=>reject(Error(controller.signal.reason?.name==='TimeoutError'?'학교 정보 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.':unavailable));
   if(controller.signal.aborted)failed();else controller.signal.addEventListener('abort',failed,{once:true});
   timer=setTimeout(()=>controller.abort(new DOMException('School read deadline exceeded','TimeoutError')),timeoutMs);
  });
  return await Promise.race([work,interrupted]);
 }catch(error){if(error instanceof Error&&[unavailable,'학교 정보 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.'].includes(error.message))throw error;throw Error(unavailable)}
 finally{if(timer)clearTimeout(timer);init.signal?.removeEventListener('abort',abort);if(controller.signal.aborted&&response?.body&&!response.body.locked)void response.body.cancel().catch(()=>{});}
}
