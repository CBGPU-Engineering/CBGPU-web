import assert from 'node:assert/strict';
import test from 'node:test';
import {guestDraftPayload,guestAccessPhase,guestReviewAllowed,guestRequestsForSchool} from '../src/lib/schoolGuestAccess.ts';
const now=Date.parse('2026-11-17T00:00:00Z');
const request={id:'req',school_id:'school-a',external_user_id:'guest',requester_id:'sponsor',project_name:'Research',purpose:'Collaboration',resources:['contests']as const,starts_at:'2026-11-17T01:00:00Z',ends_at:'2026-11-17T03:00:00Z',created_at:'2026-11-16T00:00:00Z',status:'APPROVED' as const};
const row={...request,resources:[...request.resources]};
test('guest request preserves exact local-offset dates and explicit scopes',()=>{
 const result=guestDraftPayload({external_email:' guest@example.test ',project_name:' Research ',purpose:' Collaboration ',resources:['contests','contests'],starts_at:'2026-11-17T10:00:00+09:00',ends_at:'2026-11-17T12:00:00+09:00'},now);
 assert.equal(result.starts_at,'2026-11-17T01:00:00.000Z');assert.equal(result.ends_at,'2026-11-17T03:00:00.000Z');assert.deepEqual(result.resources,['contests']);assert.equal(result.external_email,'guest@example.test');
 for(const change of [{ends_at:'2026-11-17T00:00:00Z'},{starts_at:'invalid'},{resources:[]},{purpose:''},{external_email:'not-email'}])assert.throws(()=>guestDraftPayload({...result,...change},now));
});
test('school lists never display rows from another school',()=>{assert.deepEqual(guestRequestsForSchool([row,{...row,id:'other',school_id:'school-b'}],'school-a'),[row]);});
test('sponsor and target cannot approve, reject or revoke their own request',()=>{
 for(const actor of ['guest','sponsor',''])for(const decision of ['APPROVE','REJECT','REVOKE']as const)assert.equal(guestReviewAllowed({...row,status:'PENDING'},actor,decision,now),false);
 assert.equal(guestReviewAllowed({...row,status:'PENDING'},'independent','APPROVE',now),true);
 assert.equal(guestReviewAllowed(row,'independent','REVOKE',now),true);
 assert.equal(guestReviewAllowed(row,'independent','APPROVE',now),false);
 assert.equal(guestReviewAllowed(row,'independent','REVOKE',Date.parse(row.ends_at)),false);
});
test('approved requests remain scheduled before start and expire at exact end',()=>{assert.equal(guestAccessPhase(row,now),'SCHEDULED');assert.equal(guestAccessPhase(row,Date.parse(row.starts_at)),'ACTIVE');assert.equal(guestAccessPhase(row,Date.parse(row.ends_at)),'EXPIRED');assert.equal(guestAccessPhase({...row,status:'REVOKED'},now),'REVOKED');});
