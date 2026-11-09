import test from 'node:test';import assert from 'node:assert/strict';
import {selectSelfStudyEntries} from '../src/lib/studyLookup.ts';
const study=(id,room,seat)=>({id,type:'selfstudy',room:{id:room},student:{id:1,name:'Fixture student'},seat:seat?{id:seat}:null,period:1,status:'APPROVED'});
test('mixed official outstay and selfstudy responses preserve seated and capacity applications',()=>{
 const rows=[study(1,10,11),{id:2,type:'outstay',student:{id:2},from:'2026-11-09',to:'2026-11-09'},study(3,20,null)];
 assert.throws(()=>rows.filter(e=>e.room.id===10));
 const selected=selectSelfStudyEntries(rows);assert.equal(selected.length,2);assert.equal(selected.filter(e=>e.room.id===10).length,1);assert.equal(selected.filter(e=>e.room.id===20).length,1);assert.equal(selected[1].seat,null);assert.equal(rows.length,3,'source data is not mutated');
});
test('outstay-only days are valid empty study results; malformed real applications fail closed',()=>{
 assert.deepEqual(selectSelfStudyEntries([{type:'outstay',student:{id:2}}]),[]);
 for(const rows of [null,{},[{type:'selfstudy',student:{id:1},period:1}],[{type:'selfstudy',room:{id:1},period:1}],[{...study(1,1,1),period:0}]])assert.throws(()=>selectSelfStudyEntries(rows));
 assert.equal(selectSelfStudyEntries([{...study(1,1,1),period:'2'}])[0].period,2);
});
