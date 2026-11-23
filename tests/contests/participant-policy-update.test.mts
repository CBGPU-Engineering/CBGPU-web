import test from 'node:test';import assert from 'node:assert/strict';
import {changeContestParticipantPolicy,type ObservedContestPolicy} from '../../src/lib/contestParticipantPolicyUpdate.ts';
const owner='00000000-0000-4000-8000-000000000001',observed:ObservedContestPolicy={id:'00000000-0000-4000-8000-000000000002',host_id:owner,school_id:'school-a',access_scope:'MULTI_SCHOOL',allowed_school_ids:['school-b'],participant_policy:'HIGH_SCHOOL_STUDENTS'};
const session=async()=>({user:{id:owner},access_token:'synthetic-fixture-token'});
const config={url:'https://synthetic.invalid',anonKey:'synthetic-public-fixture-key'};
test('qualification update preserves scope and listing, uses exact CAS filters and original actor token',async()=>{
 let writes=0;const fetcher=(async(url,init)=>{writes++;const u=new URL(String(url));assert.equal(u.searchParams.get('school_id'),'eq.school-a');assert.equal(u.searchParams.get('host_id'),'eq.'+owner);assert.equal(u.searchParams.get('access_scope'),'eq.MULTI_SCHOOL');assert.equal(u.searchParams.get('allowed_school_ids'),'eq.{school-b}');assert.equal(u.searchParams.get('participant_policy'),'eq.HIGH_SCHOOL_STUDENTS');assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer synthetic-fixture-token');assert.deepEqual(JSON.parse(String(init?.body)),{participant_policy:'MIDDLE_SCHOOL_STUDENTS'});assert.equal(init?.redirect,'error');return Response.json([{...observed,participant_policy:'MIDDLE_SCHOOL_STUDENTS'}])}) as typeof fetch;
 await changeContestParticipantPolicy(observed,'MIDDLE_SCHOOL_STUDENTS',owner,()=>true,{...config,session,fetch:fetcher});assert.equal(writes,1);assert.equal(observed.participant_policy,'HIGH_SCHOOL_STUDENTS');
});
test('stale owner or deferred actor read cannot issue a policy mutation',async()=>{
 let writes=0,active=true;let release!:(value:Awaited<ReturnType<typeof session>>)=>void;const pending=new Promise<Awaited<ReturnType<typeof session>>>(resolve=>{release=resolve});
 const deps={...config,session:()=>pending,fetch:(async()=>{writes++;throw Error('unexpected')}) as typeof fetch};
 const work=changeContestParticipantPolicy(observed,'SCHOOL_TEACHERS',owner,()=>active,deps);active=false;release(await session());await assert.rejects(work);assert.equal(writes,0);
 await assert.rejects(changeContestParticipantPolicy(observed,'SCHOOL_TEACHERS','different-owner',()=>true,{...deps,session}));assert.equal(writes,0);
});
test('zero changed rows and ambiguous writes never retry or falsely claim saved qualification',async()=>{
 let writes=0;await assert.rejects(changeContestParticipantPolicy(observed,'SECONDARY_SCHOOL_STUDENTS',owner,()=>true,{...config,session,fetch:(async()=>{writes++;return Response.json([])}) as typeof fetch}),/새로고침/);assert.equal(writes,1);
 writes=0;await assert.rejects(changeContestParticipantPolicy(observed,'SCHOOL_TEACHERS',owner,()=>true,{...config,session,fetch:(async()=>{writes++;throw Error('synthetic timeout')}) as typeof fetch}),/변경 결과/);assert.equal(writes,1);
});
test('a response with a different school audience cannot be published as a successful qualification-only edit',async()=>{
 await assert.rejects(changeContestParticipantPolicy(observed,'SCHOOL_TEACHERS',owner,()=>true,{...config,session,fetch:(async()=>Response.json([{...observed,allowed_school_ids:['different-school'],participant_policy:'SCHOOL_TEACHERS'}])) as typeof fetch}),/새로고침/);
});
