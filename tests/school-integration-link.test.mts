import test from 'node:test';
import assert from 'node:assert/strict';
import {schoolIntegrationId,schoolIntegrationHref,schoolApplicationHref} from '../src/lib/schoolIntegrationLink.ts';
test('school introduction retains only the exact public school ID through guide and application',()=>{
 assert.equal(schoolIntegrationHref('neis-8140266'),'https://docs.cbgpu.com/school-integration?catalog_school_id=neis-8140266');
 assert.equal(schoolApplicationHref('neis-8140266'),'https://cbgpu.com/schools/new?catalog_school_id=neis-8140266');
 assert.equal(schoolIntegrationId('school-123_a'),'school-123_a');
});
test('guide links cannot turn an untrusted identifier into a redirect, path or extra parameter',()=>{
 for(const value of ['https://other.invalid','//other.invalid','../school','school?next=https://other.invalid','school#fragment','school%2Fother','a'.repeat(101),['cbsh','other'],null,undefined]){
  assert.equal(schoolIntegrationId(value),undefined);
  assert.equal(schoolIntegrationHref(value),'https://docs.cbgpu.com/school-integration');
  assert.equal(schoolApplicationHref(value),'https://cbgpu.com/schools/new');
 }
});
