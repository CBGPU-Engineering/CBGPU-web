import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import vm from'node:vm';import ts from'typescript';
const responseCode=ts.transpileModule(fs.readFileSync(new URL('../src/lib/deploymentResponse.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const responseExports:Record<string,any>={};vm.runInNewContext(responseCode,{exports:responseExports,Error});
const code=ts.transpileModule(fs.readFileSync(new URL('../src/lib/deploymentApi.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(value:unknown,status=200,raw=false){const exports:Record<string,any>={};vm.runInNewContext(code,{exports,Error,TypeError,JSON,AbortController,setTimeout,clearTimeout,fetch:async()=>raw?new Response(value as string,{status}):Response.json(value,{status}),require(name:string){if(name==='./deploymentResponse')return responseExports;assert.equal(name,'./supabase');return{supabase:{auth:{getSession:async()=>({data:{session:{access_token:'synthetic-only'}}})}}}}});return exports;}
test('server project API preserves a partial-admission result instead of claiming execution',async()=>{const h=fixture({project:{id:'preserved',execution_mode:'CENTRAL_V1'},deployment_requested:false,warning:'Project saved; execution was not requested.'});const result=await h.serverProjectRequest(undefined,{draft:false});assert.equal(result.data.id,'preserved');assert.equal(result.error,null);assert.equal(result.deployment_requested,false);assert.equal(result.warning,'Project saved; execution was not requested.')});
test('legacy project replies and transport denial remain compatible',async()=>{const normal=await fixture({project:{id:'legacy'}}).serverProjectRequest('legacy');assert.equal(normal.data.id,'legacy');assert.equal(normal.deployment_requested,undefined);assert.equal(normal.warning,null);const denied=await fixture({message:'Not authorized'},403).serverProjectRequest('legacy');assert.equal(denied.data,null);assert.equal(denied.error.message,'Not authorized');assert.equal(denied.warning,null)});

test('proxy HTML, malformed JSON and empty replies produce recoverable errors without raw provider content',async()=>{
 for(const [body,status] of [['<!DOCTYPE html><h1>secret proxy</h1>',502],['',200],['not JSON',200],['null',200],['[]',200]] as const){
  const result=await fixture(body,status,true).serverProjectRequest();
  assert.equal(result.data,null);assert.match(result.error.message,/다시 확인/);assert.doesNotMatch(result.error.message,/secret|DOCTYPE|Unexpected/);
 }
});
test('mutations are sent once and an aborted body read clears its deadline',async()=>{
 let calls=0,cleared=0;const timers:Function[]=[];const exports:Record<string,any>={};
 vm.runInNewContext(code,{exports,Error,TypeError,JSON,AbortController,setTimeout(fn:Function){timers.push(fn);return 7},clearTimeout(id:number){assert.equal(id,7);cleared++},fetch:async(_url:string,options:RequestInit)=>{calls++;assert.equal(options.method,'POST');assert.equal(options.cache,'no-store');return{ok:true,json:()=>new Promise((_resolve,reject)=>{options.signal!.addEventListener('abort',()=>reject(new Error('aborted')));queueMicrotask(()=>timers[0]())})}},require(name:string){if(name==='./deploymentResponse')return responseExports;return{supabase:{auth:{getSession:async()=>({data:{session:{access_token:'synthetic'}}})}}}}});
 const result=await exports.serverProjectRequest(undefined,{name:'draft'});assert.equal(calls,1);assert.equal(cleared,1);assert.match(result.error.message,/처리 상태/);
});
