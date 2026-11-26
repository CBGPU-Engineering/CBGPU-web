import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
import * as schoolsProxySecurity from '../src/lib/schoolsProxySecurity.ts';
const compile=(path:string)=>ts.transpileModule(fs.readFileSync(new URL('../src/lib/'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const authCode=compile('studyAuth.ts'),modeCode=compile('deployAccess.ts'),automationCode=compile('studyAutomationServer.ts');
class StudyFailure extends Error{status:number;code?:string;constructor(message:string,status=400,code?:string){super(message);this.status=status;this.code=code}}
const uid='11111111-1111-4111-8111-111111111111';
function fixture(env:Record<string,string>={CBGPU_MULTISCHOOL_V1:'1'}){
 let valid=true,allowed=true,unavailable=false,authValid=true,authChecks=0;const calls:{name:string,args?:unknown}[]=[];let profiles=0;
 const mode:Record<string,any>={};vm.runInNewContext(modeCode,{exports:mode,process:{env}});
 const exports:Record<string,any>={};const token='synthetic-caller-token';
 vm.runInNewContext(authCode,{exports,Buffer,Date,Map,AbortSignal,fetch,process:{env:{NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-anon',...env}},require(name:string){
  if(name==='./schoolsProxySecurity.ts')return schoolsProxySecurity;
  if(name==='./deployAccess')return mode;if(name==='./edusetStudent')return{StudyFailure};if(name==='./internalServiceUrl')return{trustedInternalServiceUrl:(value:string)=>new URL(value)};
  if(name==='@supabase/supabase-js')return{createClient(url:string,key:string,options:any){assert.equal(key,'public-anon');assert.equal(url,'http://127.0.0.1:54321/');assert.equal(options.global.headers.Authorization,'Bearer '+token);assert.equal(options.auth.persistSession,false);assert.equal(options.auth.autoRefreshToken,false);return{auth:{getUser:async(value:string)=>{assert.equal(value,token);authChecks++;return{data:{user:authValid?{id:uid}:null},error:null}}},from(){profiles++;throw Error('Approval/profile lookup must not grant scoped study');},rpc:async(name:string,args:unknown)=>{calls.push({name,args});if(unavailable)return{error:{code:'PGRST202'},data:null};if(name==='cbgpu_self_session_status')return{error:null,data:{valid,approved:false}};assert.equal(name,'cbgpu_can_use_resource');assert.equal(JSON.stringify(args),JSON.stringify({resource:'study',target_school:'cbsh'}));return{error:null,data:allowed}}}}};throw Error(name);
 }});
 const request=new Request('https://cbgpu.com/api/study/student',{headers:{authorization:'Bearer '+token,'x-cbgpu-auth':token}});
 return{request,check:()=>exports.requireStudyUser(request),lookup:()=>exports.requireApprovedUser(request),revoke:()=>allowed=false,expire:()=>valid=false,invalid:()=>authValid=false,fail:()=>unavailable=true,counts:()=>({authChecks,profiles,rpcs:calls.length}),exports};
}
test('approved external study guest uses fresh session and exact resource scope, never profile approval or positive cache',async()=>{
 const f=fixture();assert.equal((await f.check()).id,uid);assert.equal((await f.check()).id,uid);assert.deepEqual(f.counts(),{authChecks:2,profiles:0,rpcs:4});f.revoke();await assert.rejects(f.check(),(e:any)=>e.status===403);assert.equal(f.counts().authChecks,3);
});
test('revoked shared lookup and expired guest grants deny403 without logout loops; expired self-session denies401',async()=>{
 const f=fixture({CBGPU_ACCOUNT_V2:'true'});assert.equal(await f.lookup(),true);f.revoke();await assert.rejects(f.lookup(),(e:any)=>e.status===403);
 const expired=fixture();expired.expire();await assert.rejects(expired.check(),(e:any)=>e.status===401);assert.equal(expired.counts().rpcs,1);
 const invalid=fixture();invalid.invalid();await assert.rejects(invalid.check(),(e:any)=>e.status===401);assert.equal(invalid.counts().rpcs,0);
});
test('missing oracle, outages and malformed server flags fail503, never legacy fallback',async()=>{
 const f=fixture();f.fail();await assert.rejects(f.check(),(e:any)=>e.status===503);assert.equal(f.counts().profiles,0);
 for(const env of [{CBGPU_MULTISCHOOL_V1:'wrong'},{CBGPU_ACCOUNT_V2:'true',CBGPU_MULTISCHOOL_V1:'wrong'}]){const bad=fixture(env);await assert.rejects(bad.check(),(e:any)=>e.status===503);assert.equal(bad.counts().authChecks,0);}
});
test('automation rechecks trusted stored owner before each request and never writes after mid-run revocation',async()=>{
 let allowed=true,outage=false,checks=0,sends=0;let boundary:any;
 const exports:Record<string,any>={};vm.runInNewContext(automationCode,{exports,Request,Date,process:{env:{}},require(name:string){
  if(name==='./schoolsProxySecurity.ts')return schoolsProxySecurity;
  if(name==='server-only')return{};if(name==='./studyAuth')return{studyScopedMode:()=>true};if(name==='./preprintsServer')return{preprintsClient:()=>({rpc:async(name:string,args:any)=>{checks++;assert.equal(name,'cbgpu_service_can_use_resource');assert.equal(JSON.stringify(args),JSON.stringify({user_id:uid,resource:'study',target_school:'cbsh'}));return{data:allowed,error:outage?{code:'unavailable'}:null}}})};
  if(name==='./edusetStudent')return{StudyFailure,handleStudentStudy:async(_req:Request,deps:any)=>{boundary=deps;await deps.send('/rooms','private-personal-school-token');allowed=false;await deps.send('/selfstudy','private-personal-school-token','POST',{});return Response.json({ok:true})}};
  if(name==='./edusetStudentStore')return{savedSchoolToken:async()=> 'private-personal-school-token',forgetSchoolConnection:async()=>{throw Error('Must not delete connection on authority denial')}};
  if(name==='./edusetStudentClient')return{sendSchoolStudent:async()=>{sends++;return[]}};if(name==='./studySubmissionStore')return{};throw Error(name);
 }});
 await assert.rejects(exports.automaticSchoolRequest(uid,{}),(e:any)=>e.status===403);assert.equal(sends,1);assert.equal(checks,3);assert.ok(boundary);
 outage=true;allowed=true;await assert.rejects(exports.personalSchoolRead(uid,'/rooms'),(e:any)=>e.status===503);assert.equal(sends,1);
 await assert.rejects(exports.automaticSchoolRequest('caller-forged-id',{}),(e:any)=>e.status===403);assert.equal(sends,1);
});

test('CBGPU session revocation during a personal school read preserves the saved EduSet connection',async()=>{
 const exports:Record<string,any>={};vm.runInNewContext(compile('edusetStudent.ts'),{exports,Buffer,Date,Map,Set,Response,URL,require:(name:string)=>{if(name==='./schoolsProxySecurity.ts')return schoolsProxySecurity;if(name==='./requestSecurity')return{readJsonBody:async(r:Request)=>r.json()};throw Error(name)}});
 let forgotten=0;
 const token='fixture.'+Buffer.from(JSON.stringify({userId:'student'})).toString('base64url')+'.signature';
 const response=await exports.handleStudentStudy(new Request('https://cbgpu.com/api/study/student',{headers:{host:'cbgpu.com'}}),{authorize:async()=>uid,limit:()=>true,getConnection:async()=>token,disconnect:async()=>{forgotten++},send:async()=>{throw new exports.StudyFailure('CBGPU session expired',401,'cbgpu_session_expired')}});
 assert.equal(response.status,401);assert.equal((await response.json()).code,'cbgpu_session_expired');assert.equal(forgotten,0);
});
