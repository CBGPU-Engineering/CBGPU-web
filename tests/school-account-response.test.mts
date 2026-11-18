import test from 'node:test';import assert from 'node:assert/strict';
import{schoolAccountResponse}from'../src/lib/schoolAccountResponse.ts';
test('school mutations remain a single request and retain authoritative error response',async()=>{
 let calls=0;const init={method:'PATCH',headers:{Authorization:'Bearer synthetic'},body:'{"action":"APPROVE"}'};
 const result=await schoolAccountResponse('/api/schools/schools/a/members/b',init,100,async(_url,request)=>{calls++;assert.equal(request?.method,'PATCH');assert.equal(new Headers(request?.headers).get('authorization'),'Bearer synthetic');assert.equal(request?.redirect,'error');return Response.json({error:'Denied',code:'FORBIDDEN'},{status:403})});
 assert.equal(calls,1);assert.equal(result.response.status,403);assert.equal(result.data.code,'FORBIDDEN');
});
test('stalled headers or body release busy state at deadline without retrying writes',async()=>{
 for(const body of[false,true]){let calls=0;const start=Date.now();await assert.rejects(schoolAccountResponse('/api/schools/current-school',{method:'POST'},20,async()=>{calls++;return body?new Response(new ReadableStream({start(){}}),{headers:{'content-type':'application/json'}}):await new Promise<Response>(()=>{})}),/상태를 확인/);assert.equal(calls,1);assert.ok(Date.now()-start<1000)}
});
test('proxy HTML, redirects, non-object JSON and excessive bodies never masquerade as school results',async()=>{
 for(const response of[new Response('<!DOCTYPE html>'),Response.json([]),Response.json(null),Response.json({padding:'x'.repeat(8*1024*1024)})])await assert.rejects(schoolAccountResponse('/api/schools/memberships',{},100,async()=>response),/상태를 확인/);
});
test('already cancelled requests do not reach the school API',async()=>{let calls=0;const controller=new AbortController();controller.abort();await assert.rejects(schoolAccountResponse('/api/schools/memberships',{signal:controller.signal},100,async()=>{calls++;return Response.json({})}));assert.equal(calls,0)});
