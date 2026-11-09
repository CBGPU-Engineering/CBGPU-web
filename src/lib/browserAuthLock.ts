import {processLock} from '@supabase/supabase-js';

export class BrowserAuthLockTimeout extends Error {
 readonly isAcquireTimeout=true;
 constructor(){super('로그인 상태를 확인하는 중입니다. 잠시 후 다시 시도해 주세요.');this.name='BrowserAuthLockTimeout'}
}
/** Queue foreground/background session work without disabling cross-tab exclusion. */
export async function browserAuthLock<T>(name:string,acquireTimeout:number,fn:()=>Promise<T>):Promise<T>{
 // A zero-timeout refresh competes with normal page reads on Firefox/WebViews.
 // Wait for the same exclusive lock instead of failing immediately or stealing it.
 const timeout=acquireTimeout===0?10_000:acquireTimeout;
 if(typeof navigator==='undefined'||!navigator.locks)return processLock(name,timeout,fn);
 const controller=new AbortController();let acquired=false;
 const timer=timeout>0?setTimeout(()=>controller.abort(),timeout):null;
 try{
  return await navigator.locks.request(name,{mode:'exclusive',signal:controller.signal},async lock=>{
   if(!lock)throw new BrowserAuthLockTimeout();acquired=true;if(timer)clearTimeout(timer);
   return fn();
  });
 }catch(error){if(!acquired&&controller.signal.aborted)throw new BrowserAuthLockTimeout();throw error}
 finally{if(timer)clearTimeout(timer)}
}
