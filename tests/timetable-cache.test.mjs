import test from 'node:test';import assert from 'node:assert/strict';
import {createTimetableLoader,usableTimetableSnapshot} from '../src/lib/timetableCache.ts';
const initial=Date.parse('2026-11-09T00:00:00Z');
function raw(week='2026-11-09'){return {시작일:week,자료481:[],자료147:[null,[null,[null,[0,1001]]]],자료446:['','Teacher'],자료492:['','Math'],학급수:[0,1]}}
function memory(){let saved=null;return {read:async()=>saved,write:async value=>{saved=value},value:()=>saved}}
test('deduplicates concurrent requests and persists a good snapshot across loader restarts',async()=>{
 let calls=0;const store=memory();const loader=createTimetableLoader(async()=>{calls++;await new Promise(r=>setTimeout(r,5));return raw()},store,()=>initial);
 const result=await Promise.all(Array.from({length:15},()=>loader.get()));assert.equal(calls,1);assert.ok(result.every(x=>!x.stale));assert.equal(store.value().at,initial);
 const restarted=createTimetableLoader(async()=>{throw Error('network')},store,()=>initial+6*60_000);const fallback=await restarted.get();assert.equal(fallback.stale,true);assert.equal(fallback.at,initial);
});
test('outages retain original verification time, back off even refresh requests, and recover',async()=>{
 let now=initial,calls=0,down=false;const loader=createTimetableLoader(async()=>{calls++;if(down)throw Error('offline');return raw()},memory(),()=>now);
 await loader.get();down=true;now+=6*60_000;assert.equal((await loader.get()).stale,true);const before=calls;
 for(let i=0;i<8;i++)assert.equal((await loader.get(true)).at,initial);assert.equal(calls,before);
 down=false;now+=61_000;const fresh=await loader.get();assert.equal(fresh.stale,false);assert.equal(fresh.at,now);
});
test('last week, expired, future-dated and invalid snapshots are never shown as this week',async()=>{
 const snapshot={version:1,at:initial,raw:raw()};assert.equal(usableTimetableSnapshot(snapshot,initial),true);
 assert.equal(usableTimetableSnapshot({...snapshot,raw:raw('2026-11-02')},initial),false);
 assert.equal(usableTimetableSnapshot(snapshot,initial+49*3600_000),false);
 assert.equal(usableTimetableSnapshot({...snapshot,at:initial+3600_000},initial),false);
 assert.equal(usableTimetableSnapshot({...snapshot,raw:{}},initial),false);
 const nextMonday=Date.parse('2026-11-16T00:00:00Z');const store={read:async()=>({...snapshot,at:nextMonday-3600_000}),write:async()=>{}};
 await assert.rejects(createTimetableLoader(async()=>{throw Error('offline')},store,()=>nextMonday).get());
 const sunday=Date.parse('2026-11-08T03:00:00Z');assert.equal(usableTimetableSnapshot({...snapshot,at:sunday},sunday),true);
});
test('failed or empty responses cannot overwrite the last valid stored schedule',async()=>{
 let now=initial,bad=false;const store=memory(),loader=createTimetableLoader(async()=>bad?{資料:[]}:raw(),store,()=>now);await loader.get();bad=true;now+=6*60_000;
 assert.equal((await loader.get()).stale,true);assert.equal(store.value().at,initial);assert.ok(store.value().raw.자료147);
});
