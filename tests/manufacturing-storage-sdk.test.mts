/** Exercise the installed Storage SDK, rather than replacing its download implementation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(relative:string){const exports:Record<string,any>={};const code=ts.transpileModule(fs.readFileSync(new URL(relative,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{exports,Blob,URL,URLSearchParams,fetch,process:{env:{}}});return exports;}
const {ManufacturingFileLease}=load('../src/lib/manufacturing/fileAccess.ts');
const {manufacturingStorageReadPath}=load('../src/lib/manufacturingStoragePath.ts');

test('installed Storage SDK sends the current bearer to the manufacturing gateway path for preview and each download',async()=>{
 const requests:{path:string;authorization:string|null}[]=[];
 let allowed=true,token='synthetic.current.bearer';
 const sdk=createClient('https://print.cbgpu.com/backend','synthetic-anon-key',{
  accessToken:async()=>token,
  global:{fetch:async(input,init)=>{
   const request=new Request(input,init),url=new URL(request.url);
   requests.push({path:url.pathname,authorization:request.headers.get('authorization')});
   assert.equal(url.origin,'https://print.cbgpu.com');
   const parsed=manufacturingStorageReadPath(url.pathname);
   assert.equal(parsed?.key,'requester/print/model + 한국어.3mf');
   assert.equal(parsed.metadata,false);
   return allowed?new Response('synthetic model bytes',{headers:{'content-type':'application/octet-stream'}}):Response.json({error:'FILE_NOT_AVAILABLE'},{status:404});
  }},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
 });
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'manager'}}}})},storage:sdk.storage};
 let created=0;const lease=new ManufacturingFileLease({createObjectURL:()=>`blob:fixture:${++created}`,revokeObjectURL:()=>{}});
 assert.equal(await lease.preview(client,'manager','requester/print/model + 한국어.3mf',()=>true),'blob:fixture:1');
 token='synthetic.refreshed.bearer';
 assert.equal(await lease.download(client,'manager','requester/print/model + 한국어.3mf',()=>true),'blob:fixture:2');
 assert.deepEqual(requests.map(r=>r.authorization),['Bearer synthetic.current.bearer','Bearer synthetic.refreshed.bearer']);
 allowed=false;
 await assert.rejects(lease.download(client,'manager','requester/print/model + 한국어.3mf',()=>true),(error:any)=>error.status===403);
 assert.equal(requests.length,3);assert.equal(created,2);lease.invalidate();
});

test('portal private file adapter stays same-origin despite a canonical main-host Storage URL',async()=>{
 const {sameOriginManufacturingFileClient}=load('../src/lib/manufacturing/fileAccess.ts');
 let current='synthetic.portal.bearer';const calls:{url:string;init:RequestInit}[]=[];
 const client=sameOriginManufacturingFileClient({auth:{getSession:async()=>({data:{session:{user:{id:'operator'},access_token:current}}})}},async(url:string,init:RequestInit)=>{calls.push({url,init});return new Response('synthetic bytes')});
 const output=await client.storage.from('manufacturing').download('owner/print/model + 한국어.3mf');
 assert.equal(await output.data.text(),'synthetic bytes');
 assert.equal(calls[0].url,'/api/manufacturing/file-read?key=owner%2Fprint%2Fmodel+%2B+%ED%95%9C%EA%B5%AD%EC%96%B4.3mf');
 assert.equal(calls[0].init.credentials,'omit');assert.equal(calls[0].init.cache,'no-store');assert.equal(calls[0].init.redirect,'error');
 assert.deepEqual({...calls[0].init.headers},{Authorization:'Bearer synthetic.portal.bearer'});
 current='synthetic.refreshed.bearer';await client.storage.from('manufacturing').download('owner/laser/model.dxf');
 assert.equal((calls[1].init.headers as any).Authorization,'Bearer synthetic.refreshed.bearer');
 await client.storage.from('other-bucket').download('any');assert.equal(calls.length,2);
});

test('same-origin file adapter fails closed on missing SDK bearer and propagates authority denial',async()=>{
 const {sameOriginManufacturingFileClient}=load('../src/lib/manufacturing/fileAccess.ts');let called=0;
 const missing=sameOriginManufacturingFileClient({auth:{getSession:async()=>({data:{session:null}})}},async()=>{called++;throw Error('must not fetch')});
 assert.equal((await missing.storage.from('manufacturing').download('owner/print/file')).error.status,401);assert.equal(called,0);
 const denied=sameOriginManufacturingFileClient({auth:{getSession:async()=>({data:{session:{user:{id:'operator'},access_token:'synthetic.bearer.token'}}})}},async()=>new Response('not available',{status:404}));
 const result=await denied.storage.from('manufacturing').download('foreign/print/file');assert.equal(result.error.status,404);assert.equal(result.data,null);
});
