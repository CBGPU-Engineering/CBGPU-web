import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync(new URL('../src/lib/aiClient.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(fetcher:typeof fetch){
 const exports:Record<string,any>={};
 const supabase={auth:{getSession:async()=>({data:{session:{access_token:'synthetic-only',user:{id:'test-user'}}}})}};
 vm.runInNewContext(code,{exports,Error,TypeError,JSON,File,Blob,DOMException,AbortController,setTimeout,clearTimeout,Date,fetch:fetcher,
  require(name:string){if(name==='./nativeBridge')return{getNativeBridge:()=>null};assert.equal(name,'./supabase');return{supabase}}
 });
 return exports;
}
test('AI proxy HTML and malformed success replies produce recovery text while preserving HTTP denial status',async()=>{for(const status of [200,502])await assert.rejects(()=>fixture(async()=>new Response('<!DOCTYPE html>private',{status})).aiRequest('/jobs'),(e:any)=>{assert.match(e.message,/다시 확인/);assert.doesNotMatch(e.message,/private|Unexpected/);if(status===502)assert.equal(e.status,502);return true});await assert.rejects(()=>fixture(async()=>Response.json({message:'권한이 필요해요.'},{status:403})).aiRequest('/jobs'),(e:any)=>e.status===403&&e.message==='권한이 필요해요.')});
test('AI caller cancellation stays AbortError and never submits a pre-cancelled mutation',async()=>{let calls=0;const h=fixture(async()=>{calls++;return Response.json({ok:true})});const c=new AbortController();c.abort();await assert.rejects(()=>h.aiRequest('/jobs','POST',{kind:'ocr'},c.signal),(e:any)=>e.name==='AbortError');assert.equal(calls,0)});
test('AI polling deadline bounds a hanging response body without submitting another request',async()=>{let calls=0;const h=fixture(async(_url,init)=>{calls++;return{ok:true,json:()=>new Promise((_resolve,reject)=>init!.signal!.addEventListener('abort',()=>reject(Error('aborted'))))} as Response});const start=Date.now();await assert.rejects(()=>h.waitForAiJob('job',{timeout:20}),/내 작업/);assert.equal(calls,1);assert.ok(Date.now()-start<1000)});
test('AI job result is validated before progress/success and valid success is preserved',async()=>{for(const job of [null,{id:'another',state:'succeeded'},{id:'job',state:'unknown'}]){let progress=0;await assert.rejects(()=>fixture(async()=>Response.json({job})).waitForAiJob('job',{onProgress(){progress++}}),/작업 상태/);assert.equal(progress,0)}const h=fixture(async()=>Response.json({job:{id:'job',state:'succeeded',result:{text:'done'}}}));assert.equal((await h.waitForAiJob('job')).result.text,'done')});
