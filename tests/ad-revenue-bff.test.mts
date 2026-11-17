import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {once} from 'node:events';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url),next=require('next/server');
const bearer='Bearer synthetic.jwt.token',id='11111111-1111-4111-8111-111111111111';
function fixture(env:Record<string,string>={}){
 const calls:{url:string;init:RequestInit}[]=[],cache=new Map<string,Record<string,any>>();
 let open:(url:string,init:RequestInit)=>Promise<Response>=async()=>Response.json({ok:true},{headers:{'set-cookie':'must-not-forward=secret'}});
 function load(path:string):Record<string,any>{if(cache.has(path))return cache.get(path)!;const exports:Record<string,any>={};cache.set(path,exports);vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,process:{env},URL,AbortSignal,TextDecoder,Uint8Array,JSON,fetch:async(url:URL,init:RequestInit)=>{calls.push({url:String(url),init});return open(String(url),init)},require:(name:string)=>name==='next/server'?next:name==='@/lib/internalServiceUrl'?load('src/lib/internalServiceUrl.ts'):name==='@/lib/schoolsProxySecurity'?load('src/lib/schoolsProxySecurity.ts'):(()=>{throw Error('Unexpected module '+name)})()});return exports}
 const route=load('src/app/api/admin/ad-revenue/[[...path]]/route.ts');
 function request(method='GET',path=['analytics'],options:{authorization?:string|null;origin?:string|null;body?:string|Uint8Array;cookie?:string;query?:string;host?:string}={}){
  const headers=new Headers({host:options.host||'admin.cbgpu.com'});if(options.authorization!==null)headers.set('authorization',options.authorization??bearer);if(options.origin!==null)headers.set('origin',options.origin??'https://admin.cbgpu.com');if(options.cookie)headers.set('cookie',options.cookie);
  return new next.NextRequest('https://admin.cbgpu.com/api/admin/ad-revenue/'+path.join('/')+(options.query||''),{method,headers,...(['POST','PATCH','DELETE'].includes(method)?{body:options.body??'{}'}:{})});
 }
 async function invoke(method='GET',path=['analytics'],options:Parameters<typeof request>[2]={}){const response:Response=await route[method==='PATCH'?'PATCH':method==='POST'?'POST':'GET'](request(method,path,options),{params:Promise.resolve({path})});assert.match(response.headers.get('cache-control')||'',/private/);assert.match(response.headers.get('cache-control')||'',/no-store/);assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');assert.equal(response.headers.get('set-cookie'),null);return response}
 return{env,calls,invoke,upstream:(callback:typeof open)=>open=callback};
}
test('real NextRequest: default off never contacts upstream; cookie-only and malformed Bearers never borrow identity',async()=>{
 const f=fixture();assert.equal((await f.invoke()).status,404);assert.equal(f.calls.length,0);f.env.CBGPU_AD_REVENUE_ENABLED='1';
 for(const authorization of [null,'','Basic dXNlcg==','Bearer abc token','Bearer token,other'])assert.equal((await f.invoke('GET',['analytics'],{authorization,cookie:'sb-cbgpu-auth-token=synthetic-private-cookie'})).status,401);
 assert.equal(f.calls.length,0);
});
test('real NextRequest: exact paths/methods and UUID boundary, cross-origin POST/PATCH rejected before upstream',async()=>{
 const f=fixture({CBGPU_AD_REVENUE_ENABLED:'1'});
 for(const[method,path]of [['GET',[]],['GET',['preview']],['POST',['analytics']],['PATCH',['experiments','not-a-uuid']],['PATCH',['experiments',id,'extra']],['DELETE',['experiments',id]],['GET',['..','imports']]]as[string,string[]][])assert.equal((await f.invoke(method,path)).status,404);
 for(const[method,path]of [['POST',['preview']],['POST',['imports']],['POST',['experiments']],['PATCH',['experiments',id]]]as[string,string[]][]){for(const origin of [null,'https://evil.example','https://admin.cbgpu.com.evil.example'])assert.equal((await f.invoke(method,path,{origin})).status,403)}
 assert.equal(f.calls.length,0);
 for(const[method,path]of [['GET',['analytics']],['GET',['imports']],['GET',['experiments']],['POST',['preview']],['POST',['imports']],['POST',['experiments']],['PATCH',['experiments',id]]]as[string,string[]][])assert.equal((await f.invoke(method,path)).status,200);
 assert.equal(f.calls.length,7);
});
test('real NextRequest: streamed byte bound and UTF-8/JSON validation happen before fetch',async()=>{
 const f=fixture({CBGPU_AD_REVENUE_ENABLED:'1'});
 for(const body of ['{bad json}',JSON.stringify({csv:'x'.repeat(3*1024*1024)}),new Uint8Array([0xff,0xfe,0xfd])])assert.equal((await f.invoke('POST',['preview'],{body})).status,400);
 assert.equal(f.calls.length,0);assert.equal((await f.invoke('POST',['preview'],{body:JSON.stringify({csv:'synthetic'})})).status,200);
});
test('real NextRequest: fixed trusted upstream, no cookie forwarding, no redirect following, private errors',async()=>{
 const f=fixture({CBGPU_AD_REVENUE_ENABLED:'1',CBGPU_AD_REVENUE_API_URL:'http://127.0.0.1:3549/operator-base'});
 assert.equal((await f.invoke('GET',['analytics'],{cookie:'private=must-not-forward',query:'?from=2026-11-01&to=2026-11-17&upstream=https://evil.example'})).status,200);
 const call=f.calls[0];assert.equal(new URL(call.url).origin,'http://127.0.0.1:3549');assert.equal(new URL(call.url).pathname,'/v1/admin/ad-revenue/analytics');assert.equal((call.init.headers as Record<string,string>).Authorization,bearer);assert.equal(Object.keys(call.init.headers||{}).some(key=>key.toLowerCase()==='cookie'),false);assert.equal(call.init.cache,'no-store');assert.equal(call.init.redirect,'error');
 f.env.CBGPU_AD_REVENUE_API_URL='https://attacker.example';assert.equal((await f.invoke()).status,503);assert.equal(f.calls.length,1);
 f.env.CBGPU_AD_REVENUE_API_URL='http://127.0.0.1:3549';f.upstream(async()=>{throw Error('synthetic unavailable after possible commit')});const before=f.calls.length,uncertain=await f.invoke('POST',['imports']);assert.equal(uncertain.status,503);assert.equal((await uncertain.json()).error,'The request outcome could not be confirmed. Check imported reports or experiment records before retrying.');assert.equal(f.calls.length,before+1,'uncertain writes are never retried automatically');
 f.upstream(async()=>Response.json({error:'Fresh platform access required'},{status:403}));assert.equal((await f.invoke()).status,403);
});
test('actual HTTP redirect is rejected, not followed to a new report endpoint',async()=>{
 let redirected=0;const server=createServer((req,res)=>{if(req.url?.startsWith('/redirected')){redirected++;res.writeHead(200,{'content-type':'application/json'});res.end('{}')}else{res.writeHead(302,{location:'/redirected'});res.end()}});server.listen(0,'127.0.0.1');await once(server,'listening');
 try{const f=fixture({CBGPU_AD_REVENUE_ENABLED:'1',CBGPU_AD_REVENUE_API_URL:'http://127.0.0.1:'+(server.address()as{port:number}).port});f.upstream((url,init)=>fetch(url,init));assert.equal((await f.invoke()).status,503);assert.equal(redirected,0)}finally{server.close()}
});
