import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedSchoolContext,scopedSchoolPath} from '../src/lib/schoolContext.ts';
const membership={school_id:'school-b',status:'ACTIVE',verified:true,student_number:'B-001',school:{id:'school-b',status:'APPROVED'}};
const dto={current_school_id:'school-b',items:[membership]};
test('server-selected verified school is used without primary-school inference',()=>{
 assert.deepEqual(selectedSchoolContext(dto),{id:'school-b',studentNumber:'B-001'});
 assert.equal(scopedSchoolPath('/api/timetable?grade=1&class=2','school-b'),'/api/timetable?grade=1&class=2&school_id=school-b');
 assert.equal(scopedSchoolPath('/api/meal',null),'/api/meal');
});
test('pending, revoked, suspended, mismatched and ambiguous memberships fail closed',()=>{
 for(const change of [{verified:false},{status:'REVERIFICATION_REQUIRED'},{school:{id:'school-b',status:'SUSPENDED'}},{school:{id:'cbsh',status:'APPROVED'}}])assert.equal(selectedSchoolContext({...dto,items:[{...membership,...change}]}),null);
 assert.equal(selectedSchoolContext({...dto,current_school_id:'cbsh'}),null);
 assert.equal(selectedSchoolContext({...dto,items:[membership,membership]}),null);
 assert.equal(selectedSchoolContext({current_school_id:'../private',items:[]}),null);
 assert.equal(selectedSchoolContext(null),null);
});
