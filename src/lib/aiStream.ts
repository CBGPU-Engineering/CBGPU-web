import {NextResponse} from 'next/server';
import {AiFailure,aiJson} from './aiServer';
const owners=new Map<string,number>();let total=0;
export function takeAiStream(owner:string){if((owners.get(owner)||0)>=4||total>=64)throw new AiFailure('실시간 연결이 많아요. 사용하지 않는 AI 창을 닫아 주세요.',429);owners.set(owner,(owners.get(owner)||0)+1);total++;let released=false;return()=>{if(released)return;released=true;total--;const n=(owners.get(owner)||1)-1;if(n)owners.set(owner,n);else owners.delete(owner)}}
/** Forward real inference deltas while the private GPU job is running.
 * Tool calls are emitted only after validation; keep-alives are never answer text.
 */
export function aiStream(request:Request,owner:string,id:string,model:string,includeUsage=false){
 const release=takeAiStream(owner);let previous='',roleSent=false;const created=Math.floor(Date.now()/1000);
 let stopped=false,finished=false;const encoder=new TextEncoder();
 const stop=()=>{stopped=true;if(!finished)void aiJson('jobs/'+id+'/cancel',owner,'POST',{}).catch(()=>{})};
 const stream=new ReadableStream<Uint8Array>({async start(controller){
  const send=(value:unknown)=>{if(!stopped)controller.enqueue(encoder.encode('data: '+JSON.stringify(value)+'\n\n'))};
  request.signal.addEventListener('abort',stop,{once:true});let heartbeat=0;
  try{
   controller.enqueue(encoder.encode(': queued\n\n'));const deadline=Date.now()+300_000;
   while(!stopped&&Date.now()<deadline){
    const {job}=await aiJson('jobs/'+id,owner);
    const partial=typeof job.partial==='string'?job.partial:'';
    if(partial&&job.state!=='succeeded'){if(previous&&!partial.startsWith(previous))throw Error('GPU 재시작으로 생성이 다시 시작됐어요. 작업 내역에서 이어서 확인해 주세요.');if(partial.length>previous.length){send({id:'chatcmpl-'+id,object:'chat.completion.chunk',created,model,choices:[{index:0,delta:{...(!roleSent?{role:'assistant'}:{}),content:partial.slice(previous.length)},finish_reason:null}]});roleSent=true;previous=partial}}
    if(job.state==='paused'&&previous)throw Error('GPU 예약에 양보했어요. 작업 내역에서 계속 확인할 수 있어요.');
    if(job.state==='succeeded'){
     const result=job.result,choice=result.choices[0],message=choice.message;if(previous&&message.content&&!message.content.startsWith(previous)&&previous.trimEnd()!==message.content.trimEnd())throw Error('생성이 재시작됐어요. 작업 내역에서 최종 결과를 확인해 주세요.');const base={id:'chatcmpl-'+id,object:'chat.completion.chunk',created,model};
     send({...base,choices:[{index:0,delta:{role:'assistant',...(message.content?{content:message.content.startsWith(previous)?message.content.slice(previous.length):previous.trimEnd()===message.content.trimEnd()?'':message.content}:{}),...(message.tool_calls?{tool_calls:message.tool_calls.map((t:Record<string,unknown>,index:number)=>({index,...t}))}:{})},finish_reason:null}]});
     send({...base,choices:[{index:0,delta:{},finish_reason:choice.finish_reason||'stop'}]});if(includeUsage)send({...base,choices:[],usage:result.usage});finished=true;break;
    }
    if(['failed','cancelled','deleted'].includes(job.state))throw Error(job.error||'AI job stopped');
    if(Date.now()-heartbeat>10_000){controller.enqueue(encoder.encode(': waiting for local GPU\n\n'));heartbeat=Date.now()}
    await new Promise(r=>setTimeout(r,180));
   }
   if(!finished&&!stopped){send({error:{message:'No GPU became available in time. Check your CBGPU AI jobs.',type:'timeout'}});void aiJson('jobs/'+id+'/cancel',owner,'POST',{}).catch(()=>{})}
  }catch(e){if(!stopped)send({error:{message:e instanceof Error?e.message:'Local AI failed',type:'server_error'}})}
  finally{release();request.signal.removeEventListener('abort',stop);if(!stopped){controller.enqueue(encoder.encode('data: [DONE]\n\n'));controller.close()}}
 },cancel(){stop();release()}});
 return new NextResponse(stream,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-store','X-Accel-Buffering':'no'}});
}
