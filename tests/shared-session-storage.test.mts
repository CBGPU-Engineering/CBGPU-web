import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const compile=(path:string)=>ts.transpileModule(fs.readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const storageURL='data:text/javascript;base64,'+Buffer.from(compile('../src/lib/sharedSessionStorage.ts')).toString('base64');
const {createSharedSessionStorage,isSharedSessionHost,SHARED_SESSION_KEY:K}=await import(storageURL);
const mem=()=>{const m=new Map<string,string>();return{getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>void m.set(k,v),removeItem:(k:string)=>void m.delete(k),m}};
function fixture(){let value:string|null=null,state='empty',fail=false;const calls:any[]=[];const transport=async(method:string,v?:string|null)=>{calls.push({method,value:v});if(fail)throw Error('offline');if(method==='POST'){value=v??null;state=v?'active':'signed-out';}return{value,state}};const local=mem();const s=createSharedSessionStorage({hostname:'app.cbgpu.com',local,transport});return{s,local,calls,transport,set:(v:string|null,kind=v?'active':'empty')=>{value=v;state=kind},outage:(v:boolean)=>{fail=v}};}
test('shared login trusts exact owned hosts, never tenant wildcards or privileged portals',()=>{for(const host of ['cbgpu.com','www.cbgpu.com','app.cbgpu.com','student.cbgpu.com','researcher.cbgpu.com','developer.cbgpu.com','docs.cbgpu.com','arxiv.cbgpu.com','localhost'])assert.equal(isSharedSessionHost(host),true,host);for(const host of ['admin.cbgpu.com','developers.cbgpu.com','evil.cbgpu.com','test.front.cbgpu.com','test.server.cbgpu.com','cbgpu.com.evil.com'])assert.equal(isSharedSessionHost(host),false,host);assert.equal(isSharedSessionHost('laser.cbgpu.com',true),false);assert.equal(isSharedSessionHost('laser.cbgpu.com',false),true);});
test('existing per-origin login migrates once through verified broker',async()=>{const f=fixture();f.local.setItem(K,'legacy');assert.equal(await f.s.getItem(K),'legacy');assert.deepEqual(f.calls.map(c=>c.method),['GET','POST']);assert.equal(f.local.getItem(K),'legacy');});
test('shared login replaces stale host cache',async()=>{const f=fixture();f.local.setItem(K,'old');f.set('current');assert.equal(await f.s.getItem(K),'current');assert.equal(f.local.getItem(K),'current');assert.equal(f.calls.length,1);});
test('sign-out tombstone prevents stale caches resurrecting login',async()=>{const f=fixture();f.local.setItem(K,'old');f.set(null,'signed-out');assert.equal(await f.s.getItem(K),null);assert.equal(f.local.getItem(K),null);assert.equal(f.calls.length,1);});
test('successful login and logout synchronize without document.cookie',async()=>{const f=fixture();await f.s.setItem(K,'fresh');assert.equal(await f.s.getItem(K),'fresh');await f.s.removeItem(K);assert.equal(await f.s.getItem(K),null);assert.equal(f.local.getItem(K),null);});
test('network outage preserves cached login and retries pending login',async()=>{const f=fixture();f.outage(true);await f.s.setItem(K,'fresh');assert.equal(await f.s.getItem(K),'fresh');f.outage(false);assert.equal(await f.s.getItem(K),'fresh');assert.equal(f.calls.at(-1).method,'POST');});
test('offline signout is not resurrected by old shared cookie',async()=>{const f=fixture();await f.s.setItem(K,'fresh');f.outage(true);await f.s.removeItem(K);assert.equal(await f.s.getItem(K),null);f.outage(false);assert.equal(await f.s.getItem(K),null);assert.equal(f.calls.at(-1).value,null);});
test('PKCE and unrelated keys stay host-local',async()=>{const f=fixture();await f.s.setItem(K+'-code-verifier','private-verifier');assert.equal(await f.s.getItem(K+'-code-verifier'),'private-verifier');await f.s.removeItem(K+'-code-verifier');assert.equal(f.calls.length,0);});
test('an expired shared cache cannot re-adopt old local session',async()=>{const f=fixture();await f.s.setItem(K,'fresh');f.set(null,'empty');assert.equal(await f.s.getItem(K),null);assert.equal(f.calls.at(-1).method,'GET');});
test('blocked local storage still permits verified shared sessions',async()=>{const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')},removeItem(){throw Error('blocked')}};const s=createSharedSessionStorage({hostname:'app.cbgpu.com',local:blocked,transport:async()=>({value:'verified',state:'active'})});assert.equal(await s.getItem(K),'verified');});

function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r});return{promise,resolve}}
test('concurrent broker reads share one verification; the next read still revalidates sign-out',async()=>{
 const first=deferred<{value:string|null;state:string}>(),entered=deferred<void>(),local=mem();let calls=0;
 const s=createSharedSessionStorage({hostname:'app.cbgpu.com',local,transport:async()=>{calls++;entered.resolve();return calls===1?first.promise:{value:null,state:'signed-out'}}});
 const reads=Array.from({length:7},()=>s.getItem(K));await entered.promise;assert.equal(calls,1);first.resolve({value:'verified',state:'active'});
 assert.deepEqual(await Promise.all(reads),Array(7).fill('verified'));
 assert.equal(await s.getItem(K),null);assert.equal(calls,2);assert.equal(local.getItem(K),null);
});
test('a delayed shared read cannot restore credentials after logout',async()=>{
 const first=deferred<{value:string;state:string}>(),entered=deferred<void>(),local=mem();local.setItem(K,'old');const calls:string[]=[];
 const s=createSharedSessionStorage({hostname:'app.cbgpu.com',local,transport:async(method:string)=>{calls.push(method);if(method==='GET'&&calls.length===1){entered.resolve();return first.promise}return{value:null,state:'signed-out'}}});
 const old=s.getItem(K);await entered.promise;const logout=s.removeItem(K);const next=s.getItem(K);first.resolve({value:'old',state:'active'});
 assert.equal(await old,null);await logout;assert.equal(await next,null);assert.equal(local.getItem(K),null);assert.deepEqual(calls,['GET','POST','GET']);
});
test('a delayed old read cannot overwrite a new account login',async()=>{
 const first=deferred<{value:string;state:string}>(),entered=deferred<void>(),local=mem();local.setItem(K,'old');let shared='old',reads=0;
 const s=createSharedSessionStorage({hostname:'app.cbgpu.com',local,transport:async(method:string,value?:string)=>{if(method==='POST'){shared=value!;return{value:shared,state:'active'}}if(++reads===1){entered.resolve();return first.promise}return{value:shared,state:'active'}}});
 const old=s.getItem(K);await entered.promise;const login=s.setItem(K,'new');const next=s.getItem(K);first.resolve({value:'old',state:'active'});
 assert.equal(await old,'new');await login;assert.equal(await next,'new');assert.equal(local.getItem(K),'new');assert.equal(reads,2);
});
test('a delayed login synchronization cannot overwrite a newer sign-out',async()=>{
 const first=deferred<{value:string;state:string}>(),entered=deferred<void>(),local=mem();let posts=0;
 const s=createSharedSessionStorage({hostname:'app.cbgpu.com',local,transport:async()=>{if(++posts===1){entered.resolve();return first.promise}return{value:null,state:'signed-out'}}});
 const login=s.setItem(K,'old');await entered.promise;const logout=s.removeItem(K);first.resolve({value:'old',state:'active'});
 await login;await logout;assert.equal(local.getItem(K),null);assert.equal(local.getItem(K+':broker-seen'),'1');
});
