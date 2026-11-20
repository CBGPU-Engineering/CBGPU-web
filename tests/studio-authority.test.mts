import test from 'node:test';
import assert from 'node:assert/strict';
import {studioAuthorityCore} from '../src/lib/studioAuthorityCore.ts';
const project='2541d072-1111-4111-8111-111111111111',owner='11111111-1111-4111-8111-111111111111',editor='22222222-2222-4222-8222-222222222222',sid='33333333-3333-4333-8333-333333333333';
const token='fixture.'+Buffer.from(JSON.stringify({session_id:sid})).toString('base64url')+'.fixture';
function fixture(){
 const state={actor:owner,session:true,status:'approved',role:'editor',compute:true,allocation:null as string|null,central:true,profile:'ACTIVE',banned:false};const calls:{path:string;body:any;bearer:string|null}[]=[];
 const fetcher:typeof fetch=async(input,init)=>{
  const url=new URL(String(input)),path=url.pathname;const body=init?.body?JSON.parse(String(init.body)):undefined;calls.push({path,body,bearer:new Headers(init?.headers).get('Authorization')});
  if(path==='/auth/v1/user')return Response.json({id:state.actor});
  if(path.startsWith('/auth/v1/admin/users/'))return Response.json({id:owner,banned_until:state.banned?'2099-01-01T00:00:00Z':null});
  if(path.endsWith('/cbgpu_self_session_status'))return Response.json({valid:state.session});
  if(path==='/rest/v1/cpu_projects')return Response.json([{id:project,user_id:owner,status:state.status,access_scope:'public',execution_mode:state.allocation?'CENTRAL_V1':null,allocation_school_id:state.allocation}]);
  if(path==='/rest/v1/profiles')return Response.json([{id:url.searchParams.get('id')?.slice(3),account_status:state.profile,is_approved:true}]);
  if(path==='/teams/server/'+project)return Response.json({owner_id:owner,my_role:state.role});
  if(path.endsWith('/cbgpu_service_can_use_resource'))return Response.json(state.compute);
  if(path.endsWith('/cbgpu_central_compose_request'))return Response.json(state.central);
  throw Error('Unexpected fixture request '+path);
 };
 const run=()=>studioAuthorityCore(token,project,{env:{SUPABASE_INTERNAL_URL:'http://127.0.0.1:54321',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture-anon',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',CBGPU_ACCOUNT_V2:'1'},fetcher,deployKey:async()=>'fixture-deploy-key'});
 return{state,calls,run};
}
test('owner authority uses caller JWT for auth/session and freshly rechecks execution permission',async()=>{
 const f=fixture();assert.deepEqual(await f.run(),{userId:owner,role:'owner'});
 assert(f.calls.filter(c=>c.path.includes('auth/v1/user')||c.path.endsWith('cbgpu_self_session_status')).every(c=>c.bearer==='Bearer '+token));
 f.state.compute=false;await assert.rejects(f.run(),{status:403});
 f.state.session=false;await assert.rejects(f.run(),{status:401});
});
test('editors require fresh collaboration, both account profiles, and owner execution access',async()=>{
 const f=fixture();f.state.actor=editor;assert.deepEqual(await f.run(),{userId:editor,role:'editor'});
 assert.equal(f.calls.filter(c=>c.path.endsWith('cbgpu_service_can_use_resource')).length,2);
 f.state.role='viewer';await assert.rejects(f.run(),{status:403});
 f.state.role='editor';f.state.banned=true;await assert.rejects(f.run(),{status:403});
 f.state.banned=false;f.state.profile='SUSPENDED';await assert.rejects(f.run(),{status:403});
});
test('deleted projects are denied and central CPU checks use the existing read-only project predicate',async()=>{
 const f=fixture();f.state.status='deleted';await assert.rejects(f.run(),{status:403});
 f.state.status='approved';f.state.allocation='fixture-school';assert.deepEqual(await f.run(),{userId:owner,role:'owner'});
 const call=f.calls.find(c=>c.path.endsWith('cbgpu_central_compose_request'));assert.deepEqual(call?.body,{project,owner,school:'fixture-school',actor:owner,actor_session:sid});
 assert.equal(f.calls.some(c=>c.path.endsWith('cbgpu_platform_cpu_service')),false,'Opening must never seal or acquire an allocation');
 f.state.central=false;await assert.rejects(f.run(),{status:403});
});
test('auth, session and team rate limits are temporary failures rather than account denials',async()=>{
 for(const phase of ['auth','session','team']){
  // Recreate only the transport boundary so actual authority mapping is exercised.
  const fetcher:typeof fetch=async(input)=>{
   const path=new URL(String(input)).pathname;
   if(path==='/auth/v1/user')return phase==='auth'?Response.json({}, {status:429}):Response.json({id:phase==='team'?editor:owner});
   if(path.endsWith('cbgpu_self_session_status'))return phase==='session'?Response.json({}, {status:429}):Response.json({valid:true});
   if(path==='/rest/v1/cpu_projects')return Response.json([{id:project,user_id:owner,status:'approved',access_scope:'public'}]);
   if(path.startsWith('/auth/v1/admin/users/'))return Response.json({id:owner});
   if(path.startsWith('/teams/server/'))return Response.json({}, {status:429});
   throw Error('Unexpected request');
  };
  await assert.rejects(studioAuthorityCore(token,project,{env:{NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture-anon',SUPABASE_SERVICE_ROLE_KEY:'fixture-service'},fetcher,deployKey:async()=>'fixture-key'}),{status:503});
 }
});
