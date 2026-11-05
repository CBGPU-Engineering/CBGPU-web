import test from 'node:test';import assert from 'node:assert/strict';
import {automationDue,koreaClock,nearestAvailableSeats,nextAutomaticStudyDate,runAutomaticStudy,validateAutomation} from '../src/lib/studyAutomation.ts';
const config={enabled:true,run_time:'07:30',room_id:'room',seat_id:'2',teacher_id:'teacher',reason:'자율학습',periods:[3,1,2]};
const now=new Date('2026-11-05T00:00:00Z');
const seats=[{id:1,name:'1',x:0,y:0},{id:2,name:'2',x:1,y:0},{id:3,name:'3',x:2,y:0},{id:4,name:'4',x:1,y:1}];
function fixture({existing=[],occupied=[],reply={ok:true,status:200},afterWrite=false}={}){
 const claims=new Set(),writes=[],results=[];let entries=[...existing];
 const context=async()=>({student:{id:'student'},date:'2026-11-05',open:true,periods:[1,2,3],entries:[...entries],rooms:[{id:'room',name:'교실',hasSeats:true}],teachers:[{id:'teacher'}]});
 const deps={context,seats:async()=>seats,occupied:async()=>occupied,claim:async p=>{if(claims.has(p))return false;claims.add(p);return true},finish:async r=>results.push(r),apply:async input=>{writes.push(input);if(reply.ok||afterWrite)entries.push({period:input.period});return reply}};
 return {deps,claims,writes,results};
}
test('only weekdays, at or after chosen KST minute and no later than 15:30',()=>{
 assert.equal(automationDue(config,new Date('2026-11-04T22:29:00Z')),false);
 assert.equal(automationDue(config,new Date('2026-11-04T22:30:00Z')),true);
 assert.equal(automationDue(config,new Date('2026-11-05T06:30:00Z')),true);
 assert.equal(automationDue(config,new Date('2026-11-05T06:31:00Z')),false);
 for(const day of ['2026-11-07','2026-11-08'])assert.equal(automationDue(config,new Date(day+'T00:00:00Z')),false);
 assert.equal(koreaClock(new Date('2026-11-05T15:00:00Z')).date,'2026-11-06');
 assert.equal(automationDue({...config,enabled:false},now),false);
});
test('validates 07:30–15:30, sorts periods and drops untrusted owner fields',()=>{
 assert.deepEqual(validateAutomation({...config,user_id:'another-user'}),{...config,periods:[1,2,3]});
 for(const run_time of ['07:29','15:31','08:70','7:30'])assert.throws(()=>validateAutomation({...config,run_time}));
 for(const periods of [[],[0],[1,20]])assert.throws(()=>validateAutomation({...config,periods}));
});
test('past times begin next weekday instead of immediately submitting',()=>{
 assert.equal(nextAutomaticStudyDate('07:30',now),'2026-11-06');
 assert.equal(nextAutomaticStudyDate('09:00',now),'2026-11-05');
 assert.equal(nextAutomaticStudyDate('07:30',new Date('2026-11-06T00:00:00Z')),'2026-11-09');
 assert.equal(nextAutomaticStudyDate('10:00',new Date('2026-11-07T00:00:00Z')),'2026-11-09');
 assert.equal(automationDue({...config,starts_on:'2026-11-06'},now),false);
});
test('prefers exact seat, then squared physical distance with stable ties',()=>{
 assert.equal(nearestAvailableSeats(seats,2,[])[0].id,2);
 assert.deepEqual(nearestAvailableSeats(seats,'2',[2]).map(x=>x.id),[1,3,4]);
 assert.equal(nearestAvailableSeats(seats,2,[1,'2',3])[0].id,4);
 assert.throws(()=>nearestAvailableSeats(seats,99,[]));
});
test('sorts periods and never changes an existing application',async()=>{
 const f=fixture({existing:[{period:2}],occupied:[2,1]});await runAutomaticStudy(config,now,f.deps);
 assert.deepEqual(f.writes.map(x=>x.period),[1,3]);assert.ok(f.writes.every(x=>x.seatId===3));assert.equal(f.results[1].status,'already_applied');
 await runAutomaticStudy(config,now,f.deps);assert.equal(f.writes.length,2);
});
test('weekends and closed school windows do not claim or submit anything',async()=>{
 const f=fixture();await runAutomaticStudy(config,new Date('2026-11-07T00:00:00Z'),f.deps);assert.equal(f.claims.size,0);
 const get=f.deps.context;f.deps.context=async()=>({...await get(),open:false});await runAutomaticStudy(config,now,f.deps);assert.equal(f.claims.size,0);assert.equal(f.writes.length,0);
});
test('full rooms never submit and malformed layout never guesses a seat',async()=>{
 const f=fixture({occupied:[1,2,3,4]});await runAutomaticStudy(config,now,f.deps);assert.equal(f.writes.length,0);assert.ok(f.results.every(x=>x.status==='no_seats'));
 const g=fixture();g.deps.seats=async()=>[];await runAutomaticStudy(config,now,g.deps);assert.equal(g.writes.length,0);assert.equal(g.results[0].status,'uncertain');
});
test('a lost response is reconciled without a second submission',async()=>{
 const f=fixture({reply:{ok:false,status:503},afterWrite:true});await runAutomaticStudy({...config,periods:[1]},now,f.deps);assert.equal(f.writes.length,1);assert.equal(f.results[0].status,'already_applied');
 const g=fixture({reply:{ok:false,status:503}});await runAutomaticStudy(config,now,g.deps);assert.equal(g.writes.length,1);assert.equal(g.results[0].status,'uncertain');
});
