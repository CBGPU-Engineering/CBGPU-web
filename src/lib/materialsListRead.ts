/** A list read has one deadline, even when an SDK waits before it starts fetch. No retries. */
export async function readMaterialsList<T>(read:(signal:AbortSignal)=>PromiseLike<T>,signal?:AbortSignal,timeoutMs=15_000):Promise<T>{
 const controller=new AbortController();
 const abort=()=>controller.abort(signal?.reason);
 if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 let rejectAbort:()=>void=()=>{};
 const interrupted=new Promise<never>((_,reject)=>{
  rejectAbort=()=>reject(controller.signal.reason??new DOMException('Materials read cancelled','AbortError'));
  if(controller.signal.aborted)rejectAbort();else controller.signal.addEventListener('abort',rejectAbort,{once:true});
 });
 const timer=setTimeout(()=>controller.abort(new DOMException('Materials read deadline exceeded','TimeoutError')),timeoutMs);
 try{
  return await Promise.race([Promise.resolve().then(()=>{
   if(controller.signal.aborted)throw controller.signal.reason;
   return read(controller.signal);
  }),interrupted]);
 }finally{
  clearTimeout(timer);signal?.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',rejectAbort);
 }
}
