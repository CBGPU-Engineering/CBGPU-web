import test from 'node:test';import assert from 'node:assert/strict';
import {build} from 'esbuild';import vm from 'node:vm';import{createRequire}from'node:module';
const compiled=await build({entryPoints:[new URL('../src/lib/edusetStudent.ts',import.meta.url).pathname],bundle:true,platform:'node',format:'cjs',write:false});const module={exports:{}} as {exports:any};vm.runInNewContext(compiled.outputFiles[0].text,{module,exports:module.exports,require:createRequire(import.meta.url),Request,Response,URL,Buffer,Date,Set,Map,TextDecoder});const{handleStudentStudy,StudyFailure}=module.exports;
import {runAutomaticStudy} from '../src/lib/studyAutomation.ts';
const now=new Date('2026-11-19T00:00:00Z'),date='2026-11-19';
const token='fixture.'+Buffer.from(JSON.stringify({userId:'student'})).toString('base64url')+'.signature';
function fixture(failure?:'rejected'|'lost'|'foreign'|'unconfirmed'|'ambiguous'|'date-changed'){
 const calls:{path:string;method:string;body:any}[]=[],states:string[]=[],records:any[]=[],holds=new Set<string>();let clock=now;
 const policy={timelimit:{assign:Array(7).fill({start:{h:7,m:30},end:{h:15,m:30}})},timetable:{assign:Array(7).fill('day'),presets:{day:[{},{}]}}};
 const rooms=[{id:31,name:'교실',hasSeats:true,width:2,height:1},{id:32,name:'정원실',hasSeats:false,width:2,height:1}],seats=[{id:41,name:'1',x:0,y:0},{id:42,name:'2',x:1,y:0}];
 const deps={authorize:async()=> 'synthetic-owner',getConnection:async()=>token,limit:()=>true,now:()=>clock,reserveWrite:async()=>({mark:async(state:string)=>{states.push(state)}}),send:async(path:string,credential:string,method='GET',body?:any)=>{
  assert.equal(credential,token);calls.push({path,method,body});
  if(path==='/users/student')return{id:'student',role:'STUDENT'};
  if(path==='/students/student')return{id:'student',name:'Synthetic',grade:1,classNo:1,number:1};
  if(path==='/policies/selfstudy')return policy;
  if(path==='/rooms')return rooms;if(path==='/teachers')return[{id:51,name:'담당'}];
  if(path==='/rooms/31/composition')return{seats};if(path==='/rooms/31/seats/occupations?date='+date){if(failure==='foreign')return[{seatId:41,period:1,studentId:'other-student',type:'occupied'}];if(failure==='unconfirmed')return[];if(failure==='ambiguous'&&holds.size)return[{seatId:41,period:1,studentId:'student',type:'occupied'},{seatId:41,period:1,studentId:'other',type:'occupied'}];return[...holds].map(h=>({seatId:Number(h.split(':')[0]),period:Number(h.split(':')[1]),studentId:'student',type:'occupied'}));}if(path==='/selfstudy/search')return records;
  if(path.match(/^\/rooms\/31\/seats\/(41|42)\/occupy$/)&&method==='POST'){
   assert.equal(states.at(-1),'submitting','durable lease must protect the first school write');
   if(failure==='rejected')throw new StudyFailure('Seat is occupied',409);
   holds.add(path.split('/')[4]+':'+body.period);if(failure==='date-changed')clock=new Date('2026-11-20T00:00:00Z');
   if(failure==='lost')throw Error('Reservation reply lost');return{ok:true};
  }
  if(path==='/selfstudy'&&method==='POST'){
   if(body.seatId&&!holds.has(body.seatId+':'+body.period))throw new StudyFailure('Seat #'+body.seatId+' is not reserved.',400);
   const item={id:records.length+1,type:'selfstudy',student:{id:'student'},date:body.date,period:body.period,status:'PENDING',room:rooms.find(r=>r.id===body.roomId),seat:body.seatId?seats.find(s=>s.id===body.seatId):null};records.push(item);return item;
  }
  throw Error('Unexpected fixture request '+path);
 }};
 const call=(body?:unknown)=>handleStudentStudy(new Request('https://cbgpu.com/api/study/student',{method:body?'POST':'GET',headers:{host:'cbgpu.com',origin:'https://cbgpu.com','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),deps);
 return{call,calls,states,records,seats,holds};
}
const apply={action:'apply',date,roomId:31,seatId:41,teacherId:51,period:1,reason:'자율학습'};
test('personal seated application reserves its exact seat before creating the official application',async()=>{
 const f=fixture(),response=await f.call(apply);assert.equal(response.status,200);assert.equal((await response.json()).ok,true);
 const writes=f.calls.filter(c=>c.method==='POST'&&c.path!=='/selfstudy/search');assert.deepEqual(writes.map(c=>c.path),['/rooms/31/seats/41/occupy','/selfstudy']);assert.deepEqual(JSON.parse(JSON.stringify(writes[0].body)),{period:1,date:date+'T00:00:00.000Z'});assert.deepEqual(f.states,['submitting','confirmed']);
});
test('automatic nearest-seat application uses the same real student reservation pipeline and preserves existing periods',async()=>{
 const f=fixture();f.records.push({id:100,type:'selfstudy',student:{id:'student'},date:date+'T00:00:00.000Z',period:1,status:'APPROVED',room:{id:31,name:'교실'},seat:{id:41,name:'1'}});
 const finished:any[]=[],claimed=new Set<number>();await runAutomaticStudy({enabled:true,run_time:'07:30',room_id:'31',seat_id:'41',teacher_id:'51',reason:'자율학습',periods:[2,1]},now,{
  context:async()=>await(await f.call()).json(),seats:async()=>f.seats,occupied:async()=>[41],claim:async p=>{if(claimed.has(p))return false;claimed.add(p);return true},finish:async r=>{finished.push(r)},apply:async body=>{const response=await f.call(body);return{ok:response.ok,status:response.status,...await response.json()}}
 });
 assert.deepEqual(finished.map(r=>r.status),['already_applied','applied']);assert.equal(f.calls.filter(c=>c.path==='/selfstudy').length,1);assert.equal(f.calls.find(c=>c.path.endsWith('/occupy'))?.path,'/rooms/31/seats/42/occupy');
});
test('rejected or lost seat reservation never submits an application or blindly retries the seat',async()=>{
 for(const failure of ['rejected','lost'] as const){const f=fixture(failure),response=await f.call(apply);assert.equal(response.status,failure==='rejected'?409:503);assert.equal(f.calls.filter(c=>c.path.endsWith('/occupy')).length,1);assert.equal(f.calls.filter(c=>c.path==='/selfstudy').length,0);assert.equal(f.states.at(-1),failure==='rejected'?'rejected':'uncertain')}
});
test('capacity applications do not reserve a seat, and existing applications never acquire another reservation',async()=>{
 const f=fixture();assert.equal((await f.call({...apply,roomId:32,seatId:undefined})).status,200);assert.equal(f.calls.filter(c=>c.path.endsWith('/occupy')).length,0);
 const g=fixture();g.records.push({id:1,type:'selfstudy',student:{id:'student'},date:date+'T00:00:00.000Z',period:1,status:'PENDING',room:{id:31,name:'교실'}});assert.equal((await g.call(apply)).status,409);assert.equal(g.calls.filter(c=>c.path.endsWith('/occupy')).length,0);
});

test('pre-existing own seat holds are reused; foreign holds and unconfirmed ownership never create applications',async()=>{
 const own=fixture();own.holds.add('41:1');assert.equal((await own.call(apply)).status,200);assert.equal(own.calls.filter(c=>c.path.endsWith('/occupy')).length,0);
 for(const failure of ['foreign','unconfirmed'] as const){const f=fixture(failure);assert.equal((await f.call(apply)).status,failure==='foreign'?409:502);assert.equal(f.calls.filter(c=>c.path==='/selfstudy').length,0);assert.equal(f.calls.filter(c=>c.path.endsWith('/occupy')).length,failure==='foreign'?0:1);assert.equal(f.states.at(-1),failure==='foreign'?'released':'uncertain')}
});

test('ambiguous ownership or a changed school date after the hold never reaches application creation',async()=>{
 for(const failure of ['ambiguous','date-changed'] as const){const f=fixture(failure);assert.equal((await f.call(apply)).status,failure==='ambiguous'?502:409);assert.equal(f.calls.filter(c=>c.path.endsWith('/occupy')).length,1);assert.equal(f.calls.filter(c=>c.path==='/selfstudy').length,0);assert.equal(f.calls.filter(c=>c.path.endsWith('/release')).length,0)}
});
test('personal transport permits the fixed seat-hold endpoint without enabling release or a general write proxy',async()=>{
 const code=await build({entryPoints:[new URL('../src/lib/edusetStudentClient.ts',import.meta.url).pathname],bundle:true,platform:'node',format:'cjs',write:false,plugins:[{name:'server-marker',setup(b){b.onResolve({filter:/^server-only$/},()=>({path:'server-only',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'',loader:'js'}))}}]});
 const transport={exports:{}} as {exports:any},seen:any[]=[];vm.runInNewContext(code.outputFiles[0].text,{module:transport,exports:transport.exports,require:createRequire(import.meta.url),Response,URL,Buffer,Date,AbortSignal,fetch:async(url:string,init:RequestInit)=>{seen.push({url,init});return Response.json({ok:true})}});
 await transport.exports.sendSchoolStudent('/rooms/31/seats/41/occupy',token,'POST',{period:1,date:date+'T00:00:00.000Z'});assert.equal(seen.length,1);assert.equal(seen[0].url,'https://api.cbsh.edu-set.com/rooms/31/seats/41/occupy');assert.equal(seen[0].init.headers.Authorization,'Bearer '+token);assert.equal(seen[0].init.redirect,'error');
 for(const path of ['/rooms/31/seats/41/release','/rooms/31/seats/41/occupy?studentId=other','/rooms/31/seats/../occupy','https://other.invalid/occupy'])await assert.rejects(()=>transport.exports.sendSchoolStudent(path,token,'POST',{}));assert.equal(seen.length,1);
});
