import test from 'node:test';
import assert from 'node:assert/strict';
import {userFacingError} from '../src/lib/userFacingError.ts';

const fallback='결과를 확인하지 못했어요. 목록에서 상태를 확인해 주세요.';
test('known error descriptions map exactly without changing statuses or inventing success',()=>{
 assert.equal(userFacingError('Not authorized',fallback),'이 작업을 수행할 권한을 확인해 주세요.');
 assert.equal(userFacingError('JWT expired.',fallback),'로그인이 만료됐어요. 다시 로그인해 주세요.');
 assert.match(userFacingError('SESSION_EXPIRED',fallback),/다시 로그인/);
 assert.match(userFacingError('Too many requests',fallback),/잠시 후/);
 assert.equal(userFacingError('Not authorized for project secret-project',fallback),fallback);
});
test('unknown English, empty, nonstring and oversized error descriptions use caller recovery text',()=>{
 for(const value of ['', '   ',null,undefined,42,{message:'Forbidden'},'Gateway returned internal trace', '오류'.repeat(501)])assert.equal(userFacingError(value,fallback),fallback);
});
test('Korean recovery details and ordinary product names retain their meaning',()=>{
 for(const value of ['선택한 시간에 다른 예약이 있어요. 다른 시간을 골라 주세요.','Docker 이미지와 포트를 확인해 주세요.','SQL 파일의 형식을 확인해 주세요.','HTML 파일은 올릴 수 없어요.','API 키는 환경변수에 보관해 주세요.','파일은 50MB 이하로 올려 주세요.'])assert.equal(userFacingError(value,fallback),value);
});
test('HTML, SQL diagnostics, mixed Korean stacks and credentials never become screen errors',()=>{
 for(const value of ['<html>프록시 오류 secret</html>','오류: SQLSTATE 23505 secret','오류: duplicate key value violates unique constraint secret','오류: SELECT secret FROM private_profiles','오류\n at save (/srv/private.ts:2:4)','오류 TypeError: private','연결 오류 postgres://user:password@host/db','인증 오류 Bearer secret-token','오류\u0000secret','오류: permission denied for table private_profiles','오류: row-level security policy private_profiles'])assert.equal(userFacingError(value,fallback),fallback);
});
test('caller-specific fallback is returned verbatim and not recursively normalized',()=>{
 assert.equal(userFacingError('unknown upstream', '배포 목록을 다시 확인해 주세요.'),'배포 목록을 다시 확인해 주세요.');
 assert.equal(userFacingError('unknown upstream', 'AI 작업에서 상태를 확인해 주세요.'),'AI 작업에서 상태를 확인해 주세요.');
});

// Exercise actual client boundaries with synthetic responses; no network or account access.
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function clientFixture(respond:(url:string,options?:RequestInit)=>Promise<Response>){
 const cache=new Map<string,any>();
 function load(name:string):any{
  if(name==='./userFacingError')return{userFacingError};
  if(name==='./supabase')return{supabase:{auth:{getSession:async()=>({data:{session:{access_token:'synthetic-only',user:{id:'owner'}}}})}}};
  if(name==='./nativeBridge')return{getNativeBridge:()=>null};
  if(cache.has(name))return cache.get(name);
  const exports:Record<string,any>={};cache.set(name,exports);
  const source=fs.readFileSync(new URL('../src/lib/'+name.slice(2)+'.ts',import.meta.url),'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:load,Error,TypeError,JSON,File,Blob,DOMException,AbortController,setTimeout,clearTimeout,Date,fetch:respond});
  return exports;
 }
 return load;
}
test('successful user-authored titles, code, logs, warnings and AI answers bypass the formatter',async()=>{
 const content={title:'<html>user title</html>',content:'SELECT private FROM examples',logs:'Traceback user log',result:{text:'Not authorized'},warning:'Project saved; execution was not requested.'};
 const load=clientFixture(async()=>Response.json(content));
 for(const name of ['./aiClient','./deploymentApi','./deployDomains']){
  const client=load(name);const value=name==='./aiClient'?await client.aiRequest('/jobs'):name==='./deploymentApi'?await client.deploymentApi('projects'):await client.serverDomains();
  assert.deepEqual(JSON.parse(JSON.stringify(value)),content);
 }
});
test('AI response status and failed-job details remain separate from formatted descriptions',async()=>{
 let calls=0;const load=clientFixture(async()=>{calls++;return Response.json({message:'오류 SQLSTATE 23505 secret'},{status:403})});
 await assert.rejects(()=>load('./aiClient').aiRequest('/jobs','POST',{draft:'kept'}),(error:any)=>error.status===403&&/AI 요청/.test(error.message)&&!error.message.includes('secret'));
 assert.equal(calls,1);
 const failed=clientFixture(async()=>Response.json({job:{id:'job',state:'failed',error:'Traceback: secret',logs:'user log'}}));
 let observed:any;await assert.rejects(()=>failed('./aiClient').waitForAiJob('job',{onProgress(job:any){observed=job}}),/작업이 중단/);
 assert.equal(observed.logs,'user log');assert.equal(observed.error,'Traceback: secret');
});
test('domain failure description is normalized without retrying or changing the error type',async()=>{
 let calls=0;const load=clientFixture(async()=>{calls++;throw new TypeError('Failed to fetch')});
 await assert.rejects(()=>load('./deployDomains').serverDomains('project','draft'),(error:any)=>error instanceof TypeError&&/도메인 설정 결과/.test(error.message));
 assert.equal(calls,1);
 const denied=clientFixture(async()=>Response.json({message:'Forbidden'},{status:403}));
 await assert.rejects(()=>denied('./deployDomains').serverDomains('project','draft'),/수행할 권한/);
});

test('server strings cannot resolve inherited object properties as known errors',()=>{
 for(const key of ['__proto__','constructor','toString']){const value=userFacingError(key,fallback);assert.equal(typeof value,'string');assert.equal(value,fallback)}
});
