import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const result=await build({entryPoints:[new URL('../../src/lib/contestSchoolPolicy.ts',import.meta.url).pathname],bundle:true,platform:'node',format:'cjs',write:false});
const module={exports:{}} as {exports:{contestSchoolPolicyError:(value:Record<string,unknown>,school:string|null)=>string|null}};
vm.runInNewContext(result.outputFiles[0].text,{module,exports:module.exports,require:createRequire(import.meta.url)});
const validate=module.exports.contestSchoolPolicyError;
const base={school_id:'school-b',access_scope:'SCHOOL',allowed_school_ids:[],participant_policy:'ALL_ELIGIBLE'};
test('new school contest requires exact fresh school context; no CBsh default',()=>{
 assert.equal(validate(base,'school-b'),null);
 assert.ok(validate(base,null));assert.ok(validate(base,'cbsh'));
});
test('joint audience requires selected distinct schools; public and school clear that list',()=>{
 assert.ok(validate({...base,access_scope:'MULTI_SCHOOL'},'school-b'));
 assert.equal(validate({...base,access_scope:'MULTI_SCHOOL',allowed_school_ids:['cbsh']},'school-b'),null);
 for(const ids of [['cbsh','cbsh'],['school-b'],['../cbsh'],Array.from({length:101},(_,i)=>'school-'+i)])assert.ok(validate({...base,access_scope:'MULTI_SCHOOL',allowed_school_ids:ids},'school-b'));
 assert.ok(validate({...base,allowed_school_ids:['cbsh']},'school-b'));
});
test('national high school policy is explicit and distinct from discovery visibility',()=>{
 assert.equal(validate({...base,access_scope:'PUBLIC',participant_policy:'HIGH_SCHOOL_STUDENTS'},'school-b'),null);
 assert.ok(validate({...base,participant_policy:'TEACHER'},'school-b'));
 assert.ok(validate({...base,access_scope:'FORGED'},'school-b'));
});
test('middle, secondary and teacher cohorts are explicit while legacy high-only remains unchanged',()=>{
 for(const participant_policy of ['ALL_ELIGIBLE','HIGH_SCHOOL_STUDENTS','MIDDLE_SCHOOL_STUDENTS','SECONDARY_SCHOOL_STUDENTS','SCHOOL_TEACHERS']){
  assert.equal(validate({...base,participant_policy},'school-b'),null);
  assert.equal(validate({...base,access_scope:'PUBLIC',participant_policy},'school-b'),null);
  assert.ok(validate({...base,participant_policy},'other-school'));
 }
 assert.equal(base.participant_policy,'ALL_ELIGIBLE');
 assert.ok(validate({...base,participant_policy:'ANYONE_AUTOMATICALLY'},'school-b'));
});
