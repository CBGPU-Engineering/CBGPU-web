import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import {NextResponse} from 'next/server.js';
class AiFailure extends Error { status:number; constructor(message:string,status:number){super(message);this.status=status} }
function load(api,clock:Pick<DateConstructor,'now'>=Date){const exports: Record<string, any> = {};const code=ts.transpileModule(fs.readFileSync(new URL('../src/lib/aiStream.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{exports,Date:clock,ReadableStream,TextEncoder,setTimeout,Error,require(n){if(n==='next/server')return{NextResponse};if(n==='./aiServer')return{aiJson:api,AiFailure};throw Error(n)}});return exports.aiStream}
test('SSE coding transport preserves tool call IDs, JSON arguments, finish reason and usage',async()=>{const api=async()=>({job:{state:'succeeded',result:{id:'fixture',model:'cbgpu-coder',choices:[{message:{role:'assistant',content:null,tool_calls:[{id:'call-fixture',type:'function',function:{name:'read',arguments:'{"filePath":"README.md"}'}}]},finish_reason:'tool_calls'}],usage:{prompt_tokens:10,completion_tokens:5,total_tokens:15}}}});const response=load(api)(new Request('https://cbgpu.com/api/ai/v1/chat/completions'),'owner','job','cbgpu-coder',true);assert.equal(response.headers.get('content-type'),'text/event-stream');const text=await response.text();const events=text.split('\n').filter(l=>l.startsWith('data: ')&&!l.includes('[DONE]')).map(l=>JSON.parse(l.slice(6)));assert.equal(events[0].choices[0].delta.tool_calls[0].index,0);assert.equal(events[0].choices[0].delta.tool_calls[0].id,'call-fixture');assert.deepEqual(JSON.parse(events[0].choices[0].delta.tool_calls[0].function.arguments),{filePath:'README.md'});assert.equal(events[1].choices[0].finish_reason,'tool_calls');assert.equal(events[2].usage.total_tokens,15);assert.ok(text.endsWith('data: [DONE]\n\n'))});
test('a failed model emits an explicit error rather than an invented success',async()=>{const response=load(async()=>({job:{state:'failed',error:'Synthetic failure'}}))(new Request('https://cbgpu.com/api/ai/v1/chat/completions'),'owner','job','cbgpu-chat');const text=await response.text();assert.ok(text.includes('Synthetic failure'));assert.ok(!text.includes('chat.completion.chunk'));assert.ok(text.includes('[DONE]'))});
test('client disconnect cancels only the associated private job',async()=>{const calls=[],abort=new AbortController();const api=async(path,owner,method)=>{calls.push({path,owner,method});return{job:{state:'queued'}}};const response=load(api)(new Request('https://cbgpu.com/api/ai/v1/chat/completions',{signal:abort.signal}),'owner-A','job-A','cbgpu-chat');const reader=response.body.getReader();await reader.read();abort.abort();await new Promise(r=>setTimeout(r,20));assert.ok(calls.some(c=>c.path==='jobs/job-A/cancel'&&c.owner==='owner-A'&&c.method==='POST'));await reader.cancel()});

test('tokens arrive before completion without replaying the final answer',async()=>{let phase=0;const api=async()=>({job:++phase===1?{state:'running',partial:'안녕'}:phase===2?{state:'running',partial:'안녕하세요'}:{state:'succeeded',result:{choices:[{message:{content:'안녕하세요!'},finish_reason:'stop'}],usage:{total_tokens:4}}}});const response=load(api)(new Request('https://cbgpu.com/api/ai/v1/chat/completions'),'owner','job','cbgpu-chat');const reader=response.body.getReader();let text='';while(!text.includes('안녕')){const chunk=await reader.read();text+=new TextDecoder().decode(chunk.value)}assert.equal(phase,1,'first answer text must arrive while job is running');while(true){const chunk=await reader.read();if(chunk.done)break;text+=new TextDecoder().decode(chunk.value)}const events=text.split('\n').filter(l=>l.startsWith('data: ')&&!l.includes('[DONE]')).map(l=>JSON.parse(l.slice(6)));assert.equal(events.flatMap(e=>e.choices||[]).map(c=>c.delta?.content||'').join(''),'안녕하세요!');assert.ok(events.filter(e=>e.choices?.[0]?.delta?.content).length>=3)});

test('slow coding requests send observed progress as SDK-visible chunks before any validated tools',async()=>{
 let time=0,phase=0;
 const api=async()=>{
  const state=['queued','running','running','running','succeeded'][phase++];
  time += phase===3?3000:11000;
  return {job:{state,result:{choices:[{message:{tool_calls:[{id:'call-test',type:'function',function:{name:'ping',arguments:'{}'}}]},finish_reason:'tool_calls'}]}}};
 };
 const response=load(api,{now:()=>time})(new Request('https://cbgpu.com/api/ai/v1/chat/completions'),'owner','job','cbgpu-qwen38',false,720_000,true);
 const text=await response.text();
 const events=text.split('\n').filter(line=>line.startsWith('data: {')).map(line=>JSON.parse(line.slice(6)));
 assert.deepEqual(events.slice(0,3).map(event=>event.cbgpu_progress.state),['queued','running','running']);
 assert.ok(events.slice(0,3).every(event=>event.choices.length===0&&event.usage===undefined));
 assert.equal(events[3].choices[0].delta.tool_calls[0].function.name,'ping');
 assert.equal(events[4].choices[0].finish_reason,'tool_calls');
 assert.ok(text.endsWith('data: [DONE]\n\n'));
});

test('an intermittent status error is retried on the same job and never enqueues again',async()=>{
 const calls=[];
 let checks=0;
 const api=async(path,owner,method)=>{
  calls.push([path,owner,method]);
  if(++checks<=2)throw new AiFailure('Temporary lookup failure',checks===1?404:503);
  return {job:{state:'succeeded',result:{choices:[{message:{content:'Verified result'},finish_reason:'stop'}]}}};
 };
 const response=load(api)(new Request('https://cbgpu.com/api/ai/v1/chat/completions'),'owner','job','cbgpu-qwen38',false,9000,true);
 const output=await response.text();
 assert.ok(output.includes('Verified result'));
 assert.ok(!output.includes('error'));
 assert.deepEqual(calls,Array.from({length:3},()=>['jobs/job','owner',undefined]));
});

test('a disconnected client cancels an unfinished job only once',async()=>{
 const abort=new AbortController(),cancellations=[];
 const api=async(path)=>{
  if(path.endsWith('/cancel'))cancellations.push(path);
  return {job:{state:'running'}};
 };
 const response=load(api)(new Request('https://cbgpu.com/api/ai/v1/chat/completions',{signal:abort.signal}),'owner','job','cbgpu-qwen38');
 const reader=response.body.getReader();
 await reader.read();
 abort.abort();
 await reader.cancel();
 assert.deepEqual(cancellations,['jobs/job/cancel']);
});

test('a scheduler interruption after text keeps the job available in history',async()=>{
 const operations=[];
 let phase=0;
 const api=async(path)=>{
  operations.push(path);
  return {job:++phase===1?{state:'running',partial:'Draft response'}:{state:'paused'}};
 };
 const response=load(api)(new Request('https://cbgpu.com/api/ai/v1/chat/completions'),'owner','job','cbgpu-qwen38');
 const text=await response.text();
 assert.ok(text.includes('Draft response'));
 assert.ok(text.includes('작업 내역에서 결과를 확인'));
 assert.deepEqual(operations,['jobs/job','jobs/job']);
});
