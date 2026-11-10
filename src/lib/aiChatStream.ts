import {supabase} from './supabase';
export type ChatEvent={type:string;id?:string;text?:string;offset?:number;message?:Record<string,unknown>|string};
export async function watchChat(id:string,owner:string,signal:AbortSignal,onEvent:(event:ChatEvent)=>void){
 const {data:{session}}=await supabase.auth.getSession();if(!session||session.user.id!==owner)throw Error('로그인이 필요해요.');
 const response=await fetch('/api/ai/chats/'+id+'/events',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store',signal});
 if(!response.ok||!response.body)throw Error('실시간 연결을 열지 못했어요.');
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
 try{while(!signal.aborted){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end).trimEnd();buffer=buffer.slice(end+1);if(line.startsWith('data: ')){const raw=line.slice(6);if(raw==='[DONE]')return;onEvent(JSON.parse(raw))}}}}finally{reader.releaseLock()}
}
