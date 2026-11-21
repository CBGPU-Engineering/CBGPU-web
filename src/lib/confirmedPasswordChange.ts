import{confirmedAccountSession}from'./confirmedAccountSession.ts';
type Session={user:{id:string};access_token:string};
function sessionId(token:string){try{const value=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id;return typeof value==='string'&&value?value:null}catch{return null}}
export async function changeConfirmedPassword(input:{owner:string;email:string;currentPassword:string;newPassword:string},current:()=>boolean,deps:{readSession:()=>Promise<{data:{session:Session|null}}> ;verify:(signal:AbortSignal)=>Promise<string>;update:(token:string,signal:AbortSignal)=>Promise<void>;cleanup:()=>Promise<void>},timeoutMs=20000){
 const controller=new AbortController(),lease=()=>current()&&!controller.signal.aborted;
 let timer:ReturnType<typeof setTimeout>;
 const expired=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('비밀번호 변경 응답을 확인하지 못했어요. 입력한 내용은 유지했어요. 잠시 후 다시 확인해 주세요.'))},timeoutMs)});
 const work=(async()=>{try{
  const original=await confirmedAccountSession(input.owner,lease,deps.readSession);
  if(await deps.verify(controller.signal)!==input.owner)throw Error('확인한 계정이 달라요. 현재 계정에서 다시 시도해 주세요.');
  const active=await confirmedAccountSession(input.owner,lease,deps.readSession);
  if(active.access_token!==original.access_token&&(!sessionId(original.access_token)||sessionId(active.access_token)!==sessionId(original.access_token)))throw Error('로그인 세션이 바뀌었어요. 현재 계정에서 다시 확인해 주세요.');
  // The original main-session JWT remains the password-update caller. Never use the temporary verification session.
  await deps.update(original.access_token,controller.signal);
 }finally{await deps.cleanup().catch(()=>{})}})();
 try{await Promise.race([work,expired])}finally{clearTimeout(timer!)}
}
