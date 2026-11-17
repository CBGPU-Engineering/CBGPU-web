import test from 'node:test';
import assert from 'node:assert/strict';
import {manufacturingHistoryPath} from '../src/lib/manufacturingHistoryPath.ts';
test('personal fabrication read routes survive school-resource loss without admitting creation or management',()=>{
 for(const kind of ['print','laser']){
  assert.equal(manufacturingHistoryPath('/manufacturing/'+kind),true);
  assert.equal(manufacturingHistoryPath('/manufacturing/'+kind+'/11111111-1111-4111-8111-111111111111'),true);
  for(const tail of ['/new','/manage','/catalog','/../new','/%2e%2e/new','/11111111-1111-4111-8111-111111111111/edit'])assert.equal(manufacturingHistoryPath('/manufacturing/'+kind+tail),false);
 }
 for(const path of ['/manufacturing','/admin/manufacturing','/dashboard','/schools/cbsh/members'])assert.equal(manufacturingHistoryPath(path),false);
});
