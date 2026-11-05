import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/app/api/study/automation/route.ts',import.meta.url),'utf8');
function fixture({user={id:'owner'},session=true}={}){
 const owners=[],writes=[];const exports={};
 const row={enabled:false,run_time:'07:30:00'};
 const query={select(){return this},eq(k,v){owners.push([k,v]);return this},maybeSingle:async()=>({data:row,error:null}),update(v){writes.push(v);return this},then(resolve){resolve({error:null})}};
 const mocks={
  '@/lib/preprintsServer':{publicationUser:async()=>user,preprintsClient:()=>({from:()=>query})},
  '@/lib/deployAuth':{activeDeploymentSession:async()=>session},
  '@/lib/requestSecurity':{WindowRateLimiter:class{allow(){return true}},readJsonBody:r=>r.json()},
  '@/lib/studyAutomation':{validateAutomation(){throw Error('invalid settings')},nextAutomaticStudyDate(){return '2026-11-05'}},
  '@/lib/studyAutomationServer':{automationRuns:async id=>{owners.push(['history',id]);return []}},
 };
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Response,URL,Date,Set,Error,require:n=>{if(!mocks[n])throw Error(n);return mocks[n]}});
 return {exports,owners,writes};
}
const req=(method='GET',host='app.cbgpu.com',origin='https://app.cbgpu.com',body)=>new Request('https://'+host+'/api/study/automation',{method,headers:{host,origin},...(body?{body:JSON.stringify(body)}:{})});
test('automation settings reject anonymous and revoked sessions without DB access',async()=>{for(const options of [{user:null},{session:false}]){const h=fixture(options);assert.equal((await h.exports.GET(req())).status,401);assert.equal(h.owners.length,0)}});
test('automation settings reject foreign hosts and cross-site mutations',async()=>{const h=fixture();assert.equal((await h.exports.GET(req('GET','evil.test'))).status,404);assert.equal((await h.exports.POST(req('POST','app.cbgpu.com','https://evil.test',{action:'disable'}))).status,403);assert.equal(h.writes.length,0)});
test('reads and disable always use authenticated owner, never posted owner',async()=>{const h=fixture();const r=await h.exports.POST(req('POST','app.cbgpu.com','https://app.cbgpu.com',{action:'disable',user_id:'victim'}));assert.equal(r.status,200);assert.ok(h.owners.every(([,v])=>v==='owner'));assert.equal(h.writes[0].enabled,false);assert.equal(r.headers.get('cache-control'),'private, no-store')});
