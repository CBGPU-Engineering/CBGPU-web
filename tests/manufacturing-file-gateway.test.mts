import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import path from'node:path';import vm from'node:vm';import ts from'typescript';import{createHash}from'node:crypto';import{NextRequest,NextResponse}from'next/server.js';
const TOKEN='eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzeW50aGV0aWMifQ.fixture',KEY='10000000-0000-4000-8000-000000000001/print/model.3mf';
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
function load(fetcher:(url:URL,options:any)=>Promise<Response>=async()=>{throw Error('unexpected upstream')},env:Record<string,string>={CBGPU_MULTISCHOOL_V1:'1',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-public-anon'}){
 const cache=new Map<string,any>();function source(file:string):any{if(cache.has(file))return cache.get(file);const exports:any={};cache.set(file,exports);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URL,Headers,Request,Response,Date,Map,Set,Promise,Error,AbortController,AbortSignal,ReadableStream,Uint8Array,TextDecoder,setTimeout,clearTimeout,setInterval,clearInterval,process:{env},fetch:fetcher,require:(name:string)=>{if(name==='server-only')return{};if(name==='node:crypto')return{createHash};if(name==='next/server')return{NextRequest,NextResponse};assert(name.startsWith('.'));return source(path.resolve(path.dirname(file),name+'.ts'))}});return exports}
 return{file:source(path.resolve('src/lib/manufacturingFileProxy.ts')),storage:source(path.resolve('src/lib/manufacturingStoragePath.ts')),proxy:()=>source(path.resolve('src/proxy.ts')).proxy};
}
function req(options:{host?:string;method?:string;key?:string;headers?:Record<string,string>;signal?:AbortSignal;metadata?:boolean}={}){const host=options.host||'app.cbgpu.com',url=new URL('https://'+host+'/api/manufacturing/file-read');url.searchParams.set('key',options.key??KEY);if(options.metadata)url.searchParams.set('metadata','1');return new Request(url,{method:options.method||'GET',headers:{host,Authorization:'Bearer '+TOKEN,...options.headers},signal:options.signal})}
function cookie(token=TOKEN){return'sb-cbgpu-auth-token.0='+encodeURIComponent(JSON.stringify({access_token:token}))}
test('file authority uses current caller only; equipment cannot borrow main shared cookie or a malformed bearer',()=>{
 const {file}=load();for(const host of ['app.cbgpu.com','cbgpu.com','admin.cbgpu.com','print.cbgpu.com','laser.cbgpu.com'])assert.equal(file.manufacturingFileToken(req({host})),TOKEN);
 for(const host of ['x.front.cbgpu.com','x.server.cbgpu.com','gpu.cbgpu.com','developers.cbgpu.com','unknown.invalid'])assert.equal(file.manufacturingFileToken(req({host,headers:{'x-cbgpu-public-host':'app.cbgpu.com'}})),null);
 const main=new Request('https://app.cbgpu.com/api/manufacturing/file-read',{headers:{host:'app.cbgpu.com',cookie:cookie()}});assert.equal(file.manufacturingFileToken(main),TOKEN);
 for(const host of ['admin.cbgpu.com','print.cbgpu.com','laser.cbgpu.com'])assert.equal(file.manufacturingFileToken(new Request('https://'+host+'/api/manufacturing/file-read',{headers:{host,cookie:cookie()}})),null);
 assert.equal(file.manufacturingFileToken(req({headers:{Authorization:'Basic invalid',cookie:cookie()}})),null);assert.equal(file.manufacturingFileToken(req({headers:{'sec-fetch-site':'cross-site'}})),null);
 assert.equal(file.manufacturingFileToken(new Request('https://app.cbgpu.com/',{headers:{host:'app.cbgpu.com:443.evil',Authorization:'Bearer '+TOKEN}})),null);
});
test('signed/public/render/metadata raw storage reads rewrite through fresh authority without signed token or transform parameters',()=>{
 const h=load(),run=h.proxy();for(const pathname of ['/object/sign/','/object/public/','/object/authenticated/','/render/image/sign/','/object/info/authenticated/']){
  const raw='/backend/storage/v1'+pathname+'manufacturing/'+KEY+'?token=OLD_CAPABILITY&width=500&download=private-name';
  const response=run(new NextRequest('https://app.cbgpu.com'+raw,{headers:{host:'app.cbgpu.com'}}));const rewrite=new URL(response.headers.get('x-middleware-rewrite')!);
  assert.equal(rewrite.pathname,'/api/manufacturing/file-read');assert.equal(rewrite.searchParams.get('key'),KEY);assert.equal(rewrite.searchParams.get('metadata'),pathname.includes('/info/')?'1':null);assert.equal(rewrite.searchParams.has('token'),false);assert.equal(rewrite.searchParams.has('width'),false);assert.match(response.headers.get('cache-control')!,/private, no-store/);
 }
 assert.equal(h.storage.manufacturingStorageReadPath('/backend/storage/v1/object/authenticated/avatars/a.png'),null);
 for(const pathname of ['/backend/storage/v1/object/sign/manufacturing/x/%2e%2e/secret','/backend/storage/v1/object/sign/manufacturing/x/%5csecret','/backend/storage/v1/object/sign/manufacturing/%'])assert.throws(()=>h.storage.manufacturingStorageReadPath(pathname));
 const legacy=load(undefined,{}).proxy();assert.equal(legacy(new NextRequest('https://app.cbgpu.com/backend/storage/v1/object/sign/manufacturing/'+KEY+'?token=legacy',{headers:{host:'app.cbgpu.com'}})).headers.get('x-middleware-rewrite'),null);
 assert.equal(load(undefined,{CBGPU_MULTISCHOOL_V1:'malformed'}).proxy()(new NextRequest('https://app.cbgpu.com/backend/storage/v1/object/sign/manufacturing/'+KEY,{headers:{host:'app.cbgpu.com'}})).status,503);
});
test('real gateway adapter calls fresh self-only SQL oracle then caller-bound fixed Storage with safe headers',async()=>{
 const calls:any[]=[];const h=load(async(url,options)=>{calls.push({url:String(url),options});if(String(url).includes('/rpc/'))return Response.json(true);return new Response('original private bytes',{headers:{'Content-Type':'text/html','set-cookie':'foreign=1','location':'https://evil.invalid','Content-Length':'22'}})});
 const response=await h.file.manufacturingFileProxy(req({headers:{cookie:'must-not-forward=1',Range:'bytes=0-21'}}));assert.equal(response.status,200);assert.equal(await response.text(),'original private bytes');assert.equal(calls.length,2);
 assert.equal(calls[0].url,'http://127.0.0.1:54321/rest/v1/rpc/cbgpu_manufacturing_file_access');assert.deepEqual(JSON.parse(calls[0].options.body),{p_object_name:KEY});assert.equal(calls[0].options.headers.Authorization,'Bearer '+TOKEN);assert.equal(calls[0].options.headers.apikey,'synthetic-public-anon');assert.equal(calls[0].options.headers.cookie,undefined);
 assert.equal(calls[1].url,'http://127.0.0.1:54321/storage/v1/object/authenticated/manufacturing/'+KEY);assert.equal(calls[1].options.headers.Range,'bytes=0-21');for(const call of calls){assert.equal(call.options.redirect,'error');assert.equal(call.options.cache,'no-store')}
 assert.equal(response.headers.get('content-type'),'application/octet-stream');assert.match(response.headers.get('content-disposition')!,/^attachment;/);assert.match(response.headers.get('content-security-policy')!,/^sandbox;/);assert.equal(response.headers.get('set-cookie'),null);assert.equal(response.headers.get('location'),null);assert.equal(response.headers.get('cross-origin-resource-policy'),'same-origin');
});
test('metadata and invalid fixed-origin configuration never forward signed query or range into metadata',async()=>{
 const calls:any[]=[];const h=load(async(url,options)=>{calls.push({url:String(url),options});return String(url).includes('/rpc/')?Response.json(true):Response.json({size:42})});
 const response=await h.file.manufacturingFileProxy(req({metadata:true,headers:{Range:'bytes=0-5'}}));assert.deepEqual(await response.json(),{size:42});assert.equal(calls[1].url,'http://127.0.0.1:54321/storage/v1/object/info/authenticated/manufacturing/'+KEY);assert.equal(calls[1].options.headers.Range,undefined);
 let requests=0;const bad=load(async()=>{requests++;return Response.json(true)},{CBGPU_MULTISCHOOL_V1:'1',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-public-anon',SUPABASE_INTERNAL_URL:'https://untrusted.invalid'});assert.equal((await bad.file.manufacturingFileProxy(req())).status,503);assert.equal(requests,0);
});
test('missing/stale/revoked authority, malformed RPC and storage failures never return file or provider details',async()=>{
 for(const authority of [()=>Response.json(false),()=>Response.json({allowed:true}),()=>new Response('private SQL internals',{status:500}),()=>new Response('revoked',{status:401}),()=>new Response('x'.repeat(1025))]){let storage=0;const h=load(async(url)=>{if(String(url).includes('/rpc/'))return authority();storage++;return new Response('private')});const response=await h.file.manufacturingFileProxy(req());assert.ok([404,503].includes(response.status));assert.equal(storage,0);assert.doesNotMatch(await response.text(),/private|internals|revoked/)}
 for(const status of [302,400,401,403,404,500]){const h=load(async(url)=>String(url).includes('/rpc/')?Response.json(true):new Response('secret object path',{status,headers:{location:'https://evil.invalid'}}));const response=await h.file.manufacturingFileProxy(req());assert.equal(response.status,status>=400&&status<500?404:503);assert.equal(response.headers.get('location'),null);assert.doesNotMatch(await response.text(),/secret|evil/)}
});
test('read-only routes preserve HEAD/range and metadata without accepting file mutations',async()=>{
 let opened=0;const {file}=load();const handle=file.createManufacturingFileProxy({enabled:()=>true,authorize:async()=>true,open:async(_t:string,_k:string,metadata:boolean,method:string,range:string)=>{opened++;assert.equal(method,'HEAD');assert.equal(range,'bytes=0-5');return new Response('ignored',{headers:{'content-length':'7'}})}});
 const response=await handle(req({method:'HEAD',metadata:true,headers:{Range:'bytes=0-5'}}));assert.equal(await response.text(),'');assert.equal(response.headers.get('content-type'),'application/json');assert.equal(opened,1);
 assert.equal((await handle(req({method:'DELETE'}))).status,405);assert.equal((await handle(req({headers:{Range:'bytes=0-1,3-4'}}))).status,416);assert.equal(opened,1);
});
test('slow authority/open and request abort are bounded, release slots and never start a later file read',async()=>{
 const {file}=load();let opens=0,releaseProof:(value:boolean)=>void=()=>{};
 const handle=file.createManufacturingFileProxy({enabled:()=>true,maxStreams:1,authorityTimeoutMs:20,authorize:()=>new Promise(r=>releaseProof=r),open:async()=>{opens++;return new Response('must-not-read')}});
 const pending=handle(req());await delay(0);assert.equal((await handle(req())).status,429);assert.equal((await pending).status,503);releaseProof(true);await delay(0);assert.equal(opens,0);
 const aborted=new AbortController();const next=handle(req({signal:aborted.signal}));await delay(0);aborted.abort();assert.equal((await next).status,503);assert.equal(opens,0);
 const openSlow=file.createManufacturingFileProxy({enabled:()=>true,openingTimeoutMs:20,authorize:async()=>true,open:()=>new Promise(()=>{})});assert.equal((await openSlow(req())).status,503);
});
test('in-flight file is cancelled on fresh authority revocation, timeout, caller cancellation and read failure',async()=>{
 for(const kind of ['revoke','authority-failure','deadline','abort','cancel','read-failure']){
  const {file}=load();let proofs=0,cancelled=false,allowed=true,failing=true;const requestAbort=new AbortController();let source:ReadableStreamDefaultController<Uint8Array>|undefined;
  const handle=file.createManufacturingFileProxy({enabled:()=>true,maxStreams:1,heartbeatMs:10,authorityTimeoutMs:10,deadlineMs:kind==='deadline'?25:1000,authorize:async()=>{proofs++;if(proofs>1&&kind==='authority-failure'&&failing)throw Error('private failure');return allowed},open:async()=>new Response(new ReadableStream<Uint8Array>({start(c){source=c;c.enqueue(new TextEncoder().encode('prefix'))},cancel(){cancelled=true}}))});
  const response=await handle(req({signal:requestAbort.signal}));assert.equal(response.status,200);assert.equal((await handle(req())).status,429);const reader=response.body!.getReader();assert.equal(new TextDecoder().decode((await reader.read()).value),'prefix');
  const pending=reader.read();if(kind==='revoke')allowed=false;if(kind==='abort')requestAbort.abort();if(kind==='cancel')await reader.cancel();if(kind==='read-failure')source!.error(Error('storage failed'));
  if(kind==='cancel')assert.equal((await pending).done,true);else await assert.rejects(pending,/authority|unavailable/);
  if(kind!=='read-failure')assert.equal(cancelled,true);if(kind==='revoke'||kind==='authority-failure')assert.ok(proofs>=2);
  allowed=true;failing=false;const resumed=await handle(req());assert.equal(resumed.status,200);await resumed.body!.cancel();
 }
});
