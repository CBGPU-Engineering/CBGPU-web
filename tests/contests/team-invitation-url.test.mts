import test from 'node:test';
import assert from 'node:assert/strict';
import {contestTeamInvitationUrl} from '../../src/lib/contestWorkspace.ts';
const id='10000000-0000-4000-8000-000000000001';
test('team links copied from organizer screens target participant registration on the same site',()=>{
 for(const origin of ['https://cbgpu.com','https://app.cbgpu.com']){
  const url=new URL(contestTeamInvitationUrl(id,'TESTJOIN01',origin));
  assert.equal(url.origin,origin);assert.equal(url.pathname,'/contests/'+id);assert.equal(url.search,'?team=TESTJOIN01');assert.equal(url.hash,'');
 }
});
test('team codes remain one encoded query value and cannot inject extra navigation context',()=>{
 const url=new URL(contestTeamInvitationUrl(id,'code&next=//outside.invalid#hash','https://app.cbgpu.com'));
 assert.equal(url.pathname,'/contests/'+id);assert.equal(url.searchParams.size,1);assert.equal(url.searchParams.get('team'),'code&next=//outside.invalid#hash');assert.equal(url.hash,'');
});
