import test from 'node:test';import assert from 'node:assert/strict';
import {contestKeyTarget}from'../src/lib/contestKeyTarget.ts';
const id='ABCDEF01-2345-4000-8000-000000000001';
test('contest key target extracts only CBGPU contest IDs and discards invitation/query data',()=>{
 for(const value of [id,`https://cbgpu.com/contests/${id}`,`https://app.cbgpu.com/contests/${id}/?team=private-invite`,`/contests/${id}`])assert.equal(contestKeyTarget(value),id.toLowerCase());
 for(const value of [`https://evil.invalid/contests/${id}`,`https://secret@cbgpu.com/contests/${id}`,`https://cbgpu.com:8443/contests/${id}`,`http://cbgpu.com/contests/${id}`,`javascript:alert(1)`,`https://cbgpu.com/api/contests/${id}`,'*','not-an-id'])assert.equal(contestKeyTarget(value),null);
});
