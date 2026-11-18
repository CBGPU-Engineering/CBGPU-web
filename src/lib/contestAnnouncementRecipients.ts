export type AnnouncementRecipient={id:string;user_id:string};
/** Collect every page before any email can be sent. Never turn a partial page error into success. */
export async function collectAnnouncementRecipients(read:(from:number,to:number,signal:AbortSignal)=>Promise<{data:AnnouncementRecipient[]|null;error:unknown}>,timeoutMs=20000):Promise<string[]>{
 const signal=AbortSignal.timeout(timeoutMs),users=new Set<string>();
 for(let page=0;;page++){
  if(page>=100||signal.aborted)throw Error('ANNOUNCEMENT_RECIPIENTS_UNAVAILABLE');
  const {data,error}=await read(page*1000,page*1000+999,signal);
  if(error||!data||data.length>1000||signal.aborted)throw Error('ANNOUNCEMENT_RECIPIENTS_UNAVAILABLE');
  for(const row of data){if(typeof row.id!=='string'||typeof row.user_id!=='string'||!row.user_id)throw Error('ANNOUNCEMENT_RECIPIENTS_UNAVAILABLE');users.add(row.user_id);}
  if(data.length<1000)return [...users];
 }
}
/** Four concurrent private lookups, all completed before the caller begins sending. */
export async function resolveAnnouncementEmails(users:string[],resolve:(userId:string)=>Promise<string|null>,timeoutMs=20000):Promise<{emails:string[];missing:number}>{
 const emails=new Set<string>();let next=0,missing=0,stopped=false,timer:ReturnType<typeof setTimeout>|undefined;
 try{
  const work=Promise.all(Array.from({length:Math.min(4,users.length)},async()=>{while(next<users.length&&!stopped){const user=users[next++];try{const email=await resolve(user);if(stopped)return;if(email)emails.add(email);else missing++;}catch(error){stopped=true;throw error}}}));
  await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>{stopped=true;reject(Error('ANNOUNCEMENT_EMAIL_LOOKUP_UNAVAILABLE'))},timeoutMs)})]);
  return {emails:[...emails],missing};
 }finally{stopped=true;if(timer)clearTimeout(timer)}
}
