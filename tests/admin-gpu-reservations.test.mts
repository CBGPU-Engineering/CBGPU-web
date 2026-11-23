import test from 'node:test';
import assert from 'node:assert/strict';
import {filterAdminGpuReservations,matchesAdminGpuView,type AdminGpuReservation} from '../src/lib/adminGpuReservations.ts';
const now=Date.parse('2026-11-23T03:00:00Z');
const booking=(id:string,status:string,start:number,end:number,gpu=1):AdminGpuReservation=>({id,status,gpu_id:gpu,start_time:new Date(now+start).toISOString(),end_time:new Date(now+end).toISOString(),purpose:'School research',profiles:{full_name:'Demo member',student_id:'2211'}});
const rows=[booking('active','approved',-3600000,3600000),booking('future','approved',3600000,7200000,2),booking('past','approved',-7200000,-3600000),booking('pending','pending',3600000,7200000),booking('expired-pending','pending',-7200000,-3600000),booking('rejected','rejected',3600000,7200000)];
test('all reservations retains approved and historical records; review never becomes the only list',()=>{
 assert.deepEqual(filterAdminGpuReservations(rows,{now}).map(row=>row.id),rows.map(row=>row.id));
 assert.deepEqual(filterAdminGpuReservations(rows,{view:'approved',now}).map(row=>row.id),['active','future','past']);
 assert.deepEqual(filterAdminGpuReservations(rows,{view:'pending',now}).map(row=>row.id),['pending']);
 assert.deepEqual(filterAdminGpuReservations(rows,{view:'ended',now}).map(row=>row.id),['past','expired-pending']);
});
test('current use and upcoming remain separate from approval, with exact start/end boundaries',()=>{
 assert.deepEqual(filterAdminGpuReservations(rows,{view:'active',now}).map(row=>row.id),['active']);
 assert.deepEqual(filterAdminGpuReservations(rows,{view:'upcoming',now}).map(row=>row.id),['future']);
 const exact=booking('boundary','approved',0,3600000);
 assert.equal(matchesAdminGpuView(exact,'active',now),true);
 assert.equal(matchesAdminGpuView(exact,'active',now+3600000),false);
 assert.equal(matchesAdminGpuView(exact,'ended',now+3600000),true);
});
test('GPU, multiword purpose/name/student ID and record ID searches combine without modifying source rows',()=>{
 const before=JSON.stringify(rows);
 assert.deepEqual(filterAdminGpuReservations(rows,{view:'approved',gpu:'2',query:'2211 research',now}).map(row=>row.id),['future']);
 assert.deepEqual(filterAdminGpuReservations(rows,{query:'GPU 2',now}).map(row=>row.id),['future']);
 assert.deepEqual(filterAdminGpuReservations(rows,{query:'expired-pending',now}).map(row=>row.id),['expired-pending']);
 assert.equal(JSON.stringify(rows),before);
});
test('missing profiles preserve reservation history and search through recorded purpose',()=>{
 const row={...rows[0],profiles:null,purpose:'Independent project',user_email:null};
 assert.equal(filterAdminGpuReservations([row],{query:'independent',now}).length,1);
 assert.equal(filterAdminGpuReservations([row],{query:'unknown',now}).length,0);
 assert.equal(matchesAdminGpuView({...row,start_time:'invalid',end_time:'invalid'},'active',now),false);
});

test('history cursors retain exact timestamp precision and ID tie-breaks, including null-date history',async()=>{
 const {adminGpuHistoryBefore}=await import('../src/lib/adminGpuReservations.ts');const id='11111111-1111-4111-8111-111111111111',created_at='2026-11-23T03:00:00.123456+00:00';
 assert.equal(adminGpuHistoryBefore({id,created_at}),`created_at.lt.${created_at},and(created_at.eq.${created_at},id.lt.${id}),created_at.is.null`);
 assert.equal(adminGpuHistoryBefore({id,created_at:null}),`and(created_at.is.null,id.lt.${id})`);
 assert.throws(()=>adminGpuHistoryBefore({id:'bad',created_at}));
 assert.throws(()=>adminGpuHistoryBefore({id,created_at:'2026-11-23),id.gt.0'}));
});
