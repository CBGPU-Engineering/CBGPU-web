import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import ts from 'typescript';
// Transpile the TS source directly so the test also runs on Node versions without type stripping.
const js=ts.transpileModule(fs.readFileSync(new URL('../src/lib/studyConnection.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {deriveStudyConnection:derive}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const H=3600_000,now=Date.parse('2026-11-09T12:00:00Z');
const base=(x={})=>({status:'healthy',checked_at:new Date(now-2*60_000).toISOString(),rooms:82,failed_rooms:0,connection_expires_at:new Date(now+60*H).toISOString(),detail:'ok',...x});
test('healthy is ok and reports minutes and hours left',()=>{const r=derive(base(),now);assert.equal(r.state,'ok');assert.equal(r.minutesAgo,2);assert.equal(r.hoursLeft,60);assert.equal(r.rooms,82)});
test('last day before expiry is a warning',()=>{assert.equal(derive(base({connection_expires_at:new Date(now+10*H).toISOString()}),now).state,'warning')});
test('expired, missing token and school failures are critical',()=>{
 assert.equal(derive(base({connection_expires_at:new Date(now-H).toISOString()}),now).state,'critical');
 assert.equal(derive(base({status:'unavailable',detail:'shared_connection_missing'}),now).label,'토큰이 등록되지 않았어요');
 assert.equal(derive(base({status:'unavailable',detail:'school_http_401'}),now).state,'critical');
});
test('failed rooms warn, overdue or missing result is critical/unknown',()=>{
 assert.equal(derive(base({status:'degraded',failed_rooms:2}),now).state,'warning');
 assert.equal(derive(base({checked_at:new Date(now-30*60_000).toISOString()}),now).label,'점검이 멈췄어요');
 assert.equal(derive(null,now).state,'unknown');
});
