import {NextResponse} from 'next/server';
import {aiJson} from './aiServer';
import {takeAiStream} from './aiStream';
export function conversationStream(request:Request,owner:string,id:string,initial:{message:Record<string,unknown>|null}){
 const release=takeAiStream(owner),encoder=new TextEncoder();let closed=false;
 const stop=()=>{closed=true};
 const stream=new ReadableStream<Uint8Array>({async start(controller){
  const send=(value:unknown)=>{if(!closed)controller.enqueue(encoder.encode('data: '+JSON.stringify(value)+'\n\n'))};
  request.signal.addEventListener('abort',stop,{once:true});let previous='',lastState='',lastHeartbeat=0,snapshot=initial;
  try{
   controller.enqueue(encoder.encode(': connected\n\n'));const deadline=Date.now()+300000;
   while(!closed&&Date.now()<deadline){
    const message=snapshot.message;if(!message){send({type:'done'});break}
    const text=typeof message.content==='string'?message.content:'';const state=String(message.state);
    if(text!==previous){send({type:text.startsWith(previous)?'delta':'replace',id:message.id,offset:previous.length,text:text.startsWith(previous)?text.slice(previous.length):text});previous=text}
    if(state!==lastState){send({type:'state',message:{...message,content:undefined}});lastState=state}
    if(!['queued','running','paused'].includes(state)){send({type:'done',message});break}
    if(Date.now()-lastHeartbeat>10000){controller.enqueue(encoder.encode(': waiting\n\n'));lastHeartbeat=Date.now()}
    await new Promise(r=>setTimeout(r,180));if(closed)break;snapshot=await aiJson('chats/'+id+'/live',owner);
   }
  }catch(e){send({type:'error',message:e instanceof Error?e.message:'실시간 연결을 다시 확인하고 있어요.'})}
  finally{release();request.signal.removeEventListener('abort',stop);if(!closed){controller.enqueue(encoder.encode('data: [DONE]\n\n'));controller.close()}}
 },cancel(){closed=true;release()}});
 return new NextResponse(stream,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-store','X-Accel-Buffering':'no'}});
}
