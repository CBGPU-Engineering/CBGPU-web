import test from 'node:test';
import assert from 'node:assert/strict';
import {schoolGpuTime,schoolGpuPeriod,schoolGpuStatus,schoolGpuScopeMatches} from '../src/lib/schoolGpuReservationsAdmin.ts';
test('school booking temporal labels use inclusive end and preserve malformed-time uncertainty',()=>{
 const a='2026-11-23T00:00:00Z',b='2026-11-23T01:00:00Z';
 assert.equal(schoolGpuPeriod(a,b,Date.parse(a)-1),'시작 전');
 assert.equal(schoolGpuPeriod(a,b,Date.parse(a)),'예약 시간 진행 중');
 assert.equal(schoolGpuPeriod(a,b,Date.parse(b)),'종료');
 assert.equal(schoolGpuPeriod('invalid',b,Date.parse(a)),'시간 확인 필요');
 assert.equal(schoolGpuPeriod(b,a,Date.parse(a)),'시간 확인 필요');
 assert.equal(schoolGpuTime('invalid'),'시간 정보 없음');
});
test('automatically reserved school bookings never claim approval',()=>{
 assert.equal(schoolGpuStatus('RESERVED'),'예약됨');
 assert.equal(schoolGpuStatus('approved'),'승인됨');
 assert.equal(schoolGpuStatus('UNKNOWN'),'상태 확인 필요');
});
test('school response identity is exact and cannot inherit a foreign school',()=>{
 assert.equal(schoolGpuScopeMatches({school_id:'cbsh'},'cbsh'),true);
 for(const value of [{school_id:'other'},{school_id:'CBSH'},null,{},'cbsh'])assert.equal(schoolGpuScopeMatches(value,'cbsh'),false);
});
import {canSchoolGpuAction,validateSchoolGpuPage,schoolGpuAdminRequest,type SchoolGpuAdminRow,type SchoolGpuSession} from '../src/lib/schoolGpuReservationsAdmin.ts';
const row:SchoolGpuAdminRow={id:'test-booking',source:'registry',status:'RESERVED',start_time:'2026-11-23T00:00:00Z',end_time:'2026-11-24T00:00:00Z',purpose:'Synthetic research',gpu_id:'resource-test',gpu_label:'학교 GPU',owner:{id:'synthetic-owner',full_name:'테스트',student_number:'0000'},allowed_actions:['approve','cancel','revoke']};
const clock=Date.parse('2026-11-23T01:00:00Z');
test('registry reservations only expose allowed cancellation, never fake approval and never expired actions',()=>{
 assert.equal(canSchoolGpuAction(row,'approve',clock),false);
 assert.equal(canSchoolGpuAction(row,'cancel',clock),true);
 assert.equal(canSchoolGpuAction({...row,allowed_actions:[]},'cancel',clock),false);
 assert.equal(canSchoolGpuAction(row,'cancel',Date.parse(row.end_time)),false);
 assert.equal(canSchoolGpuAction({...row,source:'legacy',status:'pending',allowed_actions:['approve']},'approve',clock),true);
});
test('bounded response validator denies foreign school or legacy data outside CBSH',()=>{
 const page={school_id:'school-a',items:[row],next_cursor:null,server_now:new Date(clock).toISOString()};
 assert.equal(validateSchoolGpuPage(page,'school-a'),page);
 assert.throws(()=>validateSchoolGpuPage(page,'school-b'));
 assert.throws(()=>validateSchoolGpuPage({...page,items:[{...row,source:'legacy'}]},'school-a'));
 assert.throws(()=>validateSchoolGpuPage({...page,items:Array(51).fill(row)},'school-a'));
});
const session=(id='actor-a'):SchoolGpuSession=>({user:{id},access_token:'synthetic-fixture-token'});
const endpoint='schools/school-a/gpu/admin/reservations';
test('missing or changed actor denies requests before fetch',async()=>{
 let calls=0;const fetcher=(async()=>{calls++;throw Error('unexpected fetch')}) as typeof fetch;
 await assert.rejects(schoolGpuAdminRequest(endpoint,'GET',undefined,'actor-a',async()=>null,()=>true,fetcher));
 await assert.rejects(schoolGpuAdminRequest(endpoint,'GET',undefined,'actor-a',async()=>session('actor-b'),()=>true,fetcher));
 assert.equal(calls,0);
});
test('delayed original session cannot issue stale mutation after component/account boundary',async()=>{
 let release!:(value:SchoolGpuSession)=>void,current=true,calls=0;
 const pending=new Promise<SchoolGpuSession>(resolve=>{release=resolve});
 const work=schoolGpuAdminRequest(endpoint+'/test-booking/action','POST',{action:'cancel'},'actor-a',()=>pending,()=>current,(async()=>{calls++;throw Error('unexpected')}) as typeof fetch);
 current=false;release(session());await assert.rejects(work);assert.equal(calls,0);
});
test('action body keeps original status/end CAS and forwards only fixture bearer once',async()=>{
 const body={source:'registry',action:'cancel',expected_status:'RESERVED',expected_end_time:row.end_time};let calls=0;
 const fetcher=(async(url,init)=>{calls++;assert.equal(url,'/api/compute/'+endpoint+'/test-booking/action');assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer synthetic-fixture-token');assert.deepEqual(JSON.parse(String(init?.body)),body);assert.equal(init?.redirect,'error');return Response.json({school_id:'school-a',reservation:row})}) as typeof fetch;
 await schoolGpuAdminRequest(endpoint+'/test-booking/action','POST',body,'actor-a',async()=>session(),()=>true,fetcher);assert.equal(calls,1);
});
test('account switch while final session awaits cannot publish a late response',async()=>{
 let release!:(value:SchoolGpuSession)=>void,calls=0,current=true;
 const final=new Promise<SchoolGpuSession>(resolve=>{release=resolve});
 const work=schoolGpuAdminRequest(endpoint,'GET',undefined,'actor-a',async()=>++calls===1?session():final,()=>current,(async()=>Response.json({items:[]})) as typeof fetch);
 while(calls<2)await new Promise(resolve=>setTimeout(resolve,0));current=false;release(session());await assert.rejects(work);
});
test('ambiguous action failure is never retried and returns Korean recovery instruction',async()=>{
 let calls=0;await assert.rejects(schoolGpuAdminRequest(endpoint+'/test-booking/action','POST',{},'actor-a',async()=>session(),()=>true,(async()=>{calls++;throw Error('Synthetic network failure')}) as typeof fetch),/새로고침/);assert.equal(calls,1);
});
test('deleted legacy profiles retain historical bookings without identifying a different account',()=>{
 const old={...row,source:'legacy' as const,status:'approved',owner:{id:null,full_name:null,student_number:null},allowed_actions:[]};
 const page={school_id:'cbsh',items:[old],next_cursor:null,server_now:new Date(clock).toISOString()};
 assert.equal(validateSchoolGpuPage(page,'cbsh').items[0].owner.id,null);
 assert.throws(()=>validateSchoolGpuPage({...page,items:[{...old,source:'registry'}]},'cbsh'));
});
