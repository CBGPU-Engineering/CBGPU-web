import {NextResponse} from 'next/server';
import {AiFailure,aiJson} from './aiServer';
const owners=new Map<string,number>();let total=0;
export function takeAiStream(owner:string){if((owners.get(owner)||0)>=4||total>=64)throw new AiFailure('실시간 연결이 많아요. 사용하지 않는 AI 창을 닫아 주세요.',429);owners.set(owner,(owners.get(owner)||0)+1);total++;let released=false;return()=>{if(released)return;released=true;total--;const n=(owners.get(owner)||1)-1;if(n)owners.set(owner,n);else owners.delete(owner)}}
/**
 * A greeting can be answered without reserving a GPU. Any task, tool history,
 * context-dependent reply, or explicit tool selection uses normal inference.
 */
export function agentGreeting(body:Record<string,unknown>):string|null{
 const choice=body.tool_choice;
 if((choice!==undefined&&choice!=='auto'&&choice!=='none')||body.response_format!==undefined)return null;
 const limit=body.max_tokens??body.max_completion_tokens;
 if(limit!==undefined&&(!Number.isInteger(limit)||Number(limit)<32||Number(limit)>4096))return null;
 if(!Array.isArray(body.messages)||body.messages.length>256)return null;
 const english=/^(?:(?:hi|hello|hey)\s*)[.!]*$/i;
 const korean=/^(?:안녕(?:하세요|하십니까)?\s*)[.!]*$/;
 let reply:null|string=null;
 for(const message of body.messages){
  if(!message||typeof message.content!=='string'||message.tool_calls!==undefined||message.tool_call_id!==undefined)return null;
  if(message.role==='system'||message.role==='developer'||message.role==='assistant')continue;
  if(message.role!=='user')return null;
  const lines=message.content.trim().split(/\r?\n/).filter(line=>line.trim());
  if(!lines.length)return null;
  reply=lines.every(line=>korean.test(line.trim()))?'안녕하세요! 무엇을 도와드릴까요?'
   :lines.every(line=>english.test(line.trim()))?'Hello! How can I help?':null;
  if(!reply)return null;
 }
 return body.messages.at(-1)?.role==='user'?reply:null;
}

export function greetingResponse(model:string,content:string,stream:boolean,includeUsage:boolean){
 const base={id:'chatcmpl-'+crypto.randomUUID(),created:Math.floor(Date.now()/1000),model};
 // This response is served directly without consuming inference tokens.
 const usage={prompt_tokens:0,completion_tokens:0,total_tokens:0};
 const headers={'Cache-Control':'private, no-store'};
 if(!stream)return NextResponse.json({...base,object:'chat.completion',choices:[{index:0,message:{role:'assistant',content},finish_reason:'stop'}],usage},{headers});
 const chunk={...base,object:'chat.completion.chunk'};
 const chunks=[
  {...chunk,choices:[{index:0,delta:{role:'assistant',content},finish_reason:null}]},
  {...chunk,choices:[{index:0,delta:{},finish_reason:'stop'}]},
 ];
 const frames=chunks.map(value=>'data: '+JSON.stringify(value)+'\n\n');
 if(includeUsage)frames.push('data: '+JSON.stringify({...chunk,choices:[],usage})+'\n\n');
 return new NextResponse(frames.join('')+'data: [DONE]\n\n',{headers:{...headers,'Content-Type':'text/event-stream','X-Accel-Buffering':'no'}});
}

/** Forward real inference deltas while the private GPU job is running.
 * Tool calls are emitted only after validation; keep-alives are never answer text.
 */
export function aiStream(request:Request,owner:string,id:string,model:string,includeUsage=false,waitMilliseconds=300_000,reportProgress=false,release=takeAiStream(owner)){
 let previous='',roleSent=false;const base={id:'chatcmpl-'+id,object:'chat.completion.chunk',created:Math.floor(Date.now()/1000),model};
 let stopped=false,finished=false,cancelSent=false;const encoder=new TextEncoder();
 const cancelJob=()=>{if(finished||cancelSent)return;cancelSent=true;void aiJson('jobs/'+id+'/cancel',owner,'POST',{}).catch(()=>{})};
 const stop=()=>{stopped=true;cancelJob()};
 const stream=new ReadableStream<Uint8Array>({async start(controller){
  const send=(value:unknown)=>{if(!stopped)controller.enqueue(encoder.encode('data: '+JSON.stringify(value)+'\n\n'))};
  request.signal.addEventListener('abort',stop,{once:true});let heartbeat=-Infinity,lastState='',pollErrors=0;
  try{
   if(request.signal.aborted){cancelJob();return}
   controller.enqueue(encoder.encode(': queued\n\n'));const deadline=Date.now()+waitMilliseconds;
   while(!stopped&&Date.now()<deadline){
    let job;
    try{
     ({job}=await aiJson('jobs/'+id,owner));
     pollErrors=0;
    }catch(error){
     // Recover a temporary status lookup failure on the same job. Re-enqueuing
     // here would replay the request and could duplicate the agent's next action.
     if(!reportProgress||!(error instanceof AiFailure)||![404,502,503,504].includes(error.status)||++pollErrors>2)throw error;
     await new Promise(resolve=>setTimeout(resolve,250*pollErrors));continue;
    }
    if(stopped)break;
    const partial=typeof job.partial==='string'?job.partial:'';
    if(previous&&(job.state==='paused'||(partial&&!partial.startsWith(previous)&&job.state!=='succeeded'))){
     // The scheduler can resume the job, but replaying its tokens into this
     // response would corrupt text already received by the client.
     finished=true;
     throw Error('GPU에서 작업이 다시 시작될 수 있어요. 작업 내역에서 결과를 확인해 주세요.');
    }
    if(partial&&job.state!=='succeeded'&&partial.length>previous.length){send({...base,choices:[{index:0,delta:{...(!roleSent?{role:'assistant'}:{}),content:partial.slice(previous.length)},finish_reason:null}]});roleSent=true;previous=partial}
    if(job.state==='succeeded'){
     finished=true;
     const result=job.result,choice=result.choices[0],message=choice.message;if(previous&&message.content&&!message.content.startsWith(previous)&&previous.trimEnd()!==message.content.trimEnd())throw Error('생성이 재시작됐어요. 작업 내역에서 최종 결과를 확인해 주세요.');
     send({...base,choices:[{index:0,delta:{role:'assistant',...(message.content?{content:message.content.startsWith(previous)?message.content.slice(previous.length):previous.trimEnd()===message.content.trimEnd()?'':message.content}:{}),...(message.tool_calls?{tool_calls:message.tool_calls.map((t:Record<string,unknown>,index:number)=>({index,...t}))}:{})},finish_reason:null}]});
     send({...base,choices:[{index:0,delta:{},finish_reason:choice.finish_reason||'stop'}]});if(includeUsage)send({...base,choices:[],usage:result.usage});break;
    }
    if(['failed','cancelled','deleted'].includes(job.state)){finished=true;throw Error(job.error||'AI job stopped')}
    const now=Date.now();
    if(reportProgress&&['queued','running','paused'].includes(job.state)&&(job.state!==lastState||now-heartbeat>=10_000)){
     // OpenAI SDKs discard SSE comments. Send the confirmed job state in a
     // content-free chunk so tools and assistant text still arrive only when ready.
     send({...base,choices:[],cbgpu_progress:{state:job.state}});
     lastState=job.state;heartbeat=now;
    }else if(!reportProgress&&now-heartbeat>=10_000){
     controller.enqueue(encoder.encode(': waiting for local GPU\n\n'));heartbeat=now;
    }
    await new Promise(r=>setTimeout(r,180));
   }
   if(!finished&&!stopped){send({error:{message:'GPU 대기 시간이 길어졌어요. 잠시 후 다시 시도해 주세요.',type:'timeout',code:'job_timeout'}});cancelJob()}
  }catch(e){if(!stopped){send({error:{message:e instanceof Error?e.message:'Local AI failed',type:'server_error',code:'job_stream_failed'}});cancelJob()}}
  finally{release();request.signal.removeEventListener('abort',stop);if(!stopped){controller.enqueue(encoder.encode('data: [DONE]\n\n'));controller.close()}}
 },cancel(){stop();release()}});
 return new NextResponse(stream,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-store','X-Accel-Buffering':'no'}});
}
