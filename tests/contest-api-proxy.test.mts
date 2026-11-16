import test from 'node:test';
import assert from 'node:assert/strict';
import {contestApiProxy} from '../src/lib/contestApiProxy.ts';
const id='00000000-0000-4000-8000-000000000001';
const key='k'.repeat(40);
test('external contest registration forwards only explicit credentials to the fixed Rust listener',async()=>{
 let called=false;
 const fetcher:typeof fetch=async(url,init)=>{
  called=true;assert.equal(url,`http://127.0.0.1:3545/v1/contests/${id}/registrations`);
  const headers=new Headers(init?.headers);assert.equal(headers.get('authorization'),'Bearer caller-token');
  assert.equal(headers.get('x-cbgpu-contest-key'),key);assert.equal(headers.get('cookie'),null);assert.equal(headers.get('x-cbgpu-owner'),null);
  assert.equal(init?.redirect,'error');assert.deepEqual(JSON.parse(String(init?.body)),{attendee_name:'Participant',answers:{},kind:'individual'});
  return Response.json({registration:{status:'waitlisted'}},{status:201,headers:{'Set-Cookie':'bad=1'}});
 };
 const request=new Request('https://cbgpu.com/api/ai/v1/contests/'+id+'/registrations',{method:'POST',headers:{authorization:'Bearer caller-token','content-type':'application/json',cookie:'cbgpu=private','x-cbgpu-owner':'forged'},body:JSON.stringify({attendee_name:'Participant',answers:{},kind:'individual'})});
 const result=await contestApiProxy(request,[id,'registrations'],{key:async()=>key,fetch:fetcher});
 assert.equal(called,true);assert.equal(result.status,201);assert.equal(result.headers.get('set-cookie'),null);
 assert.equal(result.headers.get('access-control-allow-origin'),'*');assert.equal(result.headers.get('access-control-allow-credentials'),null);
 assert.equal((await result.json()).registration.status,'waitlisted');
});
test('cookies cannot authenticate, preflight does not touch credentials, and arbitrary routes cannot reach upstream',async()=>{
 const deps={key:async()=>{throw Error('Must not read key')}};
 const base='https://cbgpu.com/api/ai/v1/contests';
 assert.equal((await contestApiProxy(new Request(base,{headers:{cookie:'sb-cbgpu-auth-token=secret'}}),[],deps)).status,401);
 assert.equal((await contestApiProxy(new Request(base,{method:'OPTIONS'}),[],deps)).status,204);
 for(const path of [['..','auth'],['http:','evil'],[id,'approve'],['keys'],[id,'registrations','another-user']])assert.equal((await contestApiProxy(new Request(base,{headers:{authorization:'Bearer token'}}),path,deps)).status,404);
 assert.equal((await contestApiProxy(new Request(base+'?select=private',{headers:{authorization:'Bearer token'}}),[],deps)).status,404);
});
test('bounded and malformed JSON is rejected before forwarding or reading the internal key',async()=>{
 const deps={key:async()=>{throw Error('Must not read key')}};
 for(const [body,status]of [['{',400],['[]',400],['"'+'x'.repeat(256*1024)+'"',413]] as const){
  const request=new Request('https://cbgpu.com/api/ai/v1/contests/register',{method:'POST',headers:{authorization:'Bearer token','content-type':'application/json'},body});
  assert.equal((await contestApiProxy(request,['register'],deps)).status,status);
 }
});
test('list pagination is bounded and other PostgREST query parameters never pass through',async()=>{
 const base='https://cbgpu.com/api/ai/v1/contests';
 const fetcher:typeof fetch=async(url)=>{assert.equal(url,'http://127.0.0.1:3545/v1/contests?limit=20&offset=10');return Response.json({contests:[]})};
 assert.equal((await contestApiProxy(new Request(base+'?limit=20&offset=10',{headers:{authorization:'Bearer token'}}),[],{key:async()=>key,fetch:fetcher})).status,200);
 for(const query of ['limit=101','offset=10001','limit=1&limit=2','limit=-1','offset=NaN','select=*','limit=0']){
  assert.equal((await contestApiProxy(new Request(base+'?'+query,{headers:{authorization:'Bearer token'}}),[],{key:async()=>{throw Error('Must not forward')}})).status,404);
 }
});
