import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioHandoff,studioHandoffConfig,studioLoginReturn,studioRedeemDestination,StudioAuthorityError,type StudioPrincipal} from '../src/lib/studioHandoff.ts';
import {safeAuthReturn} from '../src/lib/authReturn.ts';
const project='2541d072-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222',challenge='c'.repeat(43),ticket='t'.repeat(43);
const config={projectId:project,adapterOrigin:'http://127.0.0.1:9000',publicOrigin:'https://server-2541d072.server.cbgpu.com'};
const request=(method='POST',body:unknown={challenge},headers:Record<string,string>={})=>new Request('https://cbgpu.com/api/server/'+project+'/open',{method,headers:{host:'cbgpu.com',Origin:'https://cbgpu.com',Authorization:'Bearer fixture-caller','Content-Type':'application/json',...headers},body:method==='GET'?undefined:JSON.stringify(body)});
const principal:StudioPrincipal={userId:user,role:'owner'};

test('operator config only accepts one UUID, loopback adapter and HTTPS project origin',()=>{
 const env={CBGPU_STUDIO_PROJECT_ID:project,CBGPU_STUDIO_ADAPTER_URL:config.adapterOrigin,CBGPU_STUDIO_PUBLIC_ORIGIN:config.publicOrigin};
 assert.deepEqual(studioHandoffConfig(env),config);
 for(const patch of [{CBGPU_STUDIO_ADAPTER_URL:'http://192.168.1.1:9000'},{CBGPU_STUDIO_ADAPTER_URL:'http://127.0.0.1:9000/injected'},{CBGPU_STUDIO_PUBLIC_ORIGIN:'https://evil.invalid'},{CBGPU_STUDIO_PUBLIC_ORIGIN:config.publicOrigin+'/?return=https://evil.invalid'},{CBGPU_STUDIO_PROJECT_ID:'../../other'}])assert.equal(studioHandoffConfig({...env,...patch}),null);
});

test('login return keeps the challenge inside a safe first-party path',()=>{
 const path=studioLoginReturn(project,challenge);assert.equal(safeAuthReturn(path),path);
 assert.equal(studioLoginReturn(project,'https://evil.invalid'),'/server');
 assert.equal(studioLoginReturn('//evil.invalid',challenge),'/server');
});

test('ticket mint forwards only caller bearer and challenge; response origin is server configured',async()=>{
 let calls=0;
 const handle=createStudioHandoff({config:()=>config,authorize:async(token,id)=>{assert.equal(token,'fixture-caller');assert.equal(id,project);return principal},fetcher:async(url,init)=>{
  calls++;assert.equal(url,config.adapterOrigin+'/_cbgpu/auth/tickets');assert.deepEqual(JSON.parse(String(init?.body)),{challenge});
  assert.deepEqual(Object.fromEntries(new Headers(init?.headers)),{authorization:'Bearer fixture-caller','content-type':'application/json'});
  assert.equal(init?.redirect,'error');return Response.json({ticket,url:'https://evil.invalid',access_token:'must-not-escape'});
 }});
 const result=await handle(request('POST',{challenge},{Cookie:'private=must-not-forward'}),project);
 assert.equal(result.status,200);assert.match(result.headers.get('Cache-Control')||'',/no-store/);
 assert.deepEqual(await result.json(),{url:config.publicOrigin+'/_cbgpu/auth/redeem?ticket='+ticket});assert.equal(calls,1);
});

test('anonymous, CSRF, invalid challenge and redirect injection never mint tickets',async()=>{
 let calls=0;
 const handle=createStudioHandoff({config:()=>config,authorize:async()=>{calls++;return principal},fetcher:async()=>{throw Error('must not mint')}});
 for(const[req,status]of[
  [request('POST',{challenge},{Authorization:''}),401],
  [request('POST',{challenge},{Origin:'https://evil.invalid'}),403],
  [request('POST',{challenge:challenge.slice(1)}),400],
  [request('POST',{challenge,returnUrl:'https://evil.invalid'}),400],
  [request('POST',{challenge,projectId:user}),400],
 ]as const)assert.equal((await handle(req,project)).status,status);
 assert.equal((await handle(request(),user)).status,404);assert.equal(calls,0);
});

test('fresh authority GET works on loopback host routing and revoked/viewer identities fail closed',async()=>{
 let current:StudioPrincipal|401|403=principal;
 const handle=createStudioHandoff({config:()=>config,authorize:async()=>{if(typeof current==='number')throw new StudioAuthorityError(current);return current}});
 const get=()=>new Request('http://127.0.0.1:3000/api/server/'+project+'/open',{headers:{Host:'cbgpu.com',Authorization:'Bearer fixture-caller'}});
 const allowed=await handle(get(),project);assert.deepEqual(await allowed.json(),{allowed:true,userId:user,role:'owner'});
 current=401;assert.equal((await handle(get(),project)).status,401);
 current=403;assert.equal((await handle(get(),project)).status,403);
 current={userId:user,role:'viewer'}as unknown as StudioPrincipal;assert.equal((await handle(get(),project)).status,403);
});

test('client redemption guard rejects foreign destinations, extra parameters and credentials',()=>{
 const valid=config.publicOrigin+'/_cbgpu/auth/redeem?ticket='+ticket;
 assert.equal(studioRedeemDestination(valid,config.publicOrigin),valid);
 for(const value of ['https://evil.invalid/_cbgpu/auth/redeem?ticket='+ticket,valid+'&next=https://evil.invalid',valid+'#fragment',config.publicOrigin+'/other?ticket='+ticket,valid.replace('https://','https://user:pass@')])assert.equal(studioRedeemDestination(value,config.publicOrigin),null);
 assert.equal(studioRedeemDestination(valid,null),null);
});

test('adapter errors and malformed tickets are sanitized without leaking response text',async()=>{
 for(const response of [new Response('secret-private-provider-error',{status:503}),Response.json({ticket:'bad',error:'secret-private-provider-error'})]){
  const handle=createStudioHandoff({config:()=>config,authorize:async()=>principal,fetcher:async()=>response});
  const result=await handle(request(),project);assert.equal(result.status,503);assert.doesNotMatch(await result.text(),/secret-private/);
 }
});
