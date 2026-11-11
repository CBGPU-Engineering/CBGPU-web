import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function fixture({stale=false}={}){
 const reads=[],requests=[];
 let status='pending';
 const client={from(table){
  const row={select(fields){reads.push({table,fields});return this},eq(key,value){reads.push({table,key,value});return this},
   gt(){return this},order(){return this},limit(){return this},
   maybeSingle:async()=>({data:{student_id:'2309'},error:null}),
   then(resolve){resolve({data:table==='reservations'?[{gpu_id:1,status,start_time:'2026-11-11T00:00:00Z',end_time:'2026-11-12T00:00:00Z'}]:[],error:null})}};
  return row;
 }};
 const code=ts.transpileModule(fs.readFileSync(new URL('../src/lib/cbgpuKnowledge.ts',import.meta.url),'utf8'),
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 vm.runInNewContext(code,{exports,URL,Date,Intl,AbortSignal,process:{env:{PORT:'3000'}},
  fetch:async(url,options)=>{
   assert.equal(new URL(url).hostname,'127.0.0.1');
   assert.equal(options.headers.Authorization,'Bearer owner-token');
   assert.equal(options.redirect,'error');
   requests.push(url);
   return Response.json(url.includes('/timetable')?{stale,grid:{0:{1:{subject:'OLD-SUBJECT'}}}}:
    url.includes('/servers/projects')?{projects:[{name:'Own project',status:'approved',env_vars:{SECRET:'MUST-NOT-LEAK'}}]}:
    {projects:[],gpus:[],checkedAt:new Date().toISOString()});
  },
  require(name){
   if(name==='server-only')return {};
   if(name==='./aiServer')return {aiUserClient:token=>{assert.equal(token,'owner-token');return client}};
   if(name==='./aiSources')return {aiSources:async()=>[]};
   if(name==='./studentId')return {parseStudentGradeClass:()=>({grade:2,cls:3})};
   if(name==='./serviceNavigation')return {serviceSearchPages:[{title:'GPU 예약',description:'GPU 예약 안내',href:'/dashboard',keywords:'gpu 예약'}]};
   if(name==='@/components/publications/docs')return {guides:[{title:'GPU 안내',slug:'gpu',sections:[{title:'예약',body:'예약 화면에서 GPU를 신청합니다.'}]}]};
   throw Error(name);
  }});
 return {api:exports,reads,requests,setStatus:value=>{status=value}};
}

test('each GPU question uses the current caller-scoped records',async()=>{
 const f=fixture();
 const first=await f.api.cbgpuKnowledge('owner-token','owner-id','GPU 예약');
 f.setStatus('approved');
 const second=await f.api.cbgpuKnowledge('owner-token','owner-id','GPU 예약');
 assert.ok(JSON.stringify(first).includes('pending'));
 assert.ok(JSON.stringify(second).includes('approved'));
 assert.ok(!JSON.stringify(second).includes('pending'));
 assert.ok(f.reads.filter(row=>row.table==='reservations'&&row.key==='user_id').every(row=>row.value==='owner-id'));
 assert.ok(second.checked_at);
});

test('deployment credentials never enter the model context',async()=>{
 const f=fixture();
 const result=await f.api.cbgpuKnowledge('owner-token','owner-id','서버 배포 현황');
 assert.ok(JSON.stringify(result).includes('Own project'));
 assert.ok(!JSON.stringify(result).includes('MUST-NOT-LEAK'));
 assert.ok(!JSON.stringify(result).includes('env_vars'));
});

test('stale timetable data becomes an explicit unavailable source',async()=>{
 const f=fixture({stale:true});
 const result=await f.api.cbgpuKnowledge('owner-token','owner-id','오늘 시간표');
 assert.ok(!JSON.stringify(result).includes('OLD-SUBJECT'));
 assert.ok(JSON.stringify(result).includes('현재 상태를 확인할 수 없습니다'));
});

test('relative dates use Korea time and reject impossible explicit dates',()=>{
 const {api}=fixture(),now=new Date('2026-11-10T15:01:00Z');
 assert.equal(api.requestedDate('오늘 급식',now),'2026-11-11');
 assert.equal(api.requestedDate('내일 급식',now),'2026-11-12');
 assert.equal(api.requestedDate('2026-11-32 급식',now),'2026-11-11');
});
