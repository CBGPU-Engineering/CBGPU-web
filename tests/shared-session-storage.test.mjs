import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const js=ts.transpileModule(fs.readFileSync(new URL('../src/lib/sharedSessionStorage.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {createSharedSessionStorage,isSharedSessionHost}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
// Minimal browser cookie jar: honours Max-Age=0 (delete) and enforces the ~4KB cookie size limit.
function jar(){const m=new Map();return{store:m,read:()=>[...m].map(([k,v])=>`${k}=${v}`).join('; '),write(c){const [pair,...attrs]=c.split(';');const i=pair.indexOf('=');const name=pair.slice(0,i).trim(),val=pair.slice(i+1);assert.ok(c.length<4096,'cookie over 4KB: '+name+' '+c.length);if(attrs.some(a=>a.trim()==='Max-Age=0'))m.delete(name);else m.set(name,val)}}}
const mem=()=>{const m=new Map();return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>void m.set(k,v),removeItem:k=>void m.delete(k),m}};
const K='sb-cbgpu-auth-token';
const make=(host='app.cbgpu.com')=>{const cookies=jar(),local=mem();return{cookies,local,s:createSharedSessionStorage({hostname:host,cookies,local})}};
test('which hosts share the login',()=>{
 for(const h of ['cbgpu.com','www.cbgpu.com','app.cbgpu.com','researcher.cbgpu.com','docs.cbgpu.com','arxiv.cbgpu.com','localhost']) assert.equal(isSharedSessionHost(h),true,h);
 for(const h of ['admin.cbgpu.com','manufacturing.cbgpu.com','print.cbgpu.com','laser.cbgpu.com','developers.cbgpu.com','evil.example.com','cbgpu.com.evil.com']) assert.equal(isSharedSessionHost(h),false,h);
});
test('small session round-trips through a cookie',()=>{const {s,cookies}=make();s.setItem(K,'{"a":1}');assert.equal(s.getItem(K),'{"a":1}');assert.equal([...cookies.store.keys()].join(),K+'.0')});
test('a large session is split into several cookies and rebuilt exactly',()=>{
 const {s,cookies}=make();const big=JSON.stringify({access_token:'x'.repeat(2500),refresh_token:'y'.repeat(300),user:{email:'a@b.c',meta:'z'.repeat(2500)}});
 s.setItem(K,big);assert.ok(cookies.store.size>=3);assert.equal(s.getItem(K),big);
});
test('shrinking a session removes stale chunks',()=>{const {s,cookies}=make();s.setItem(K,'a'.repeat(5000));assert.ok(cookies.store.size>=3);s.setItem(K,'short');assert.equal(cookies.store.size,1);assert.equal(s.getItem(K),'short')});
test('an existing localStorage login is adopted once and nobody is logged out',()=>{
 const {s,cookies,local}=make();local.setItem(K,'{"legacy":true}');
 assert.equal(s.getItem(K),'{"legacy":true}');assert.equal(cookies.store.size,1);assert.equal(local.getItem(K),null,'old copy removed after adoption');
 // another site (fresh localStorage) now sees the shared cookie
 const other=createSharedSessionStorage({hostname:'researcher.cbgpu.com',cookies,local:mem()});assert.equal(other.getItem(K),'{"legacy":true}');
});
test('sign-out clears the cookie and the local copy',()=>{const {s,cookies,local}=make();local.setItem(K,'x');s.setItem(K,'{"a":1}');s.removeItem(K);assert.equal(cookies.store.size,0);assert.equal(local.getItem(K),null);assert.equal(s.getItem(K),null)});
test('missing or blocked storage does not throw',()=>{
 const cookies=jar();const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')},removeItem(){throw Error('blocked')}};
 const s=createSharedSessionStorage({hostname:'app.cbgpu.com',cookies,local:blocked});assert.equal(s.getItem('none'),null);s.setItem(K,'v');assert.equal(s.getItem(K),'v');s.removeItem(K);
});
test('if the cookie cannot be stored the old copy is kept (nobody is logged out)',()=>{
 const cookies={read:()=>'',write(){}};const local=mem();local.setItem(K,'{"legacy":true}');
 const s=createSharedSessionStorage({hostname:'app.cbgpu.com',cookies,local});assert.equal(s.getItem(K),'{"legacy":true}');assert.equal(local.getItem(K),'{"legacy":true}');
});
test('a stale per-site copy cannot resurrect a signed-out session on another site',()=>{
 const cookies=jar();const a=createSharedSessionStorage({hostname:'app.cbgpu.com',cookies,local:mem()});
 const localB=mem();localB.setItem(K,'{"old":"b"}');const b=createSharedSessionStorage({hostname:'docs.cbgpu.com',cookies,local:localB});
 a.setItem(K,'{"user":"a"}');assert.equal(b.getItem(K),'{"user":"a"}');assert.equal(localB.getItem(K),null,'stale copy removed');
 a.removeItem(K);assert.equal(b.getItem(K),null);
});
