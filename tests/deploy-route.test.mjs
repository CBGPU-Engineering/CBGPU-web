import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {NextRequest,NextResponse} from 'next/server.js';
import {WindowRateLimiter} from '../src/lib/requestSecurity.ts';
const code=ts.transpileModule(fs.readFileSync(new URL('../src/app/api/deploy/[...path]/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const owner='11111111-1111-4111-8111-111111111111';
function fixture({approved=true,active=true}={}){
 const exports={},backendCalls=[],filters=[],writes=[];
 const rows=[{id:'22222222-2222-4222-8222-222222222222',user_id:owner,name:'Existing server',deploy_type:'docker',status:'approved',created_at:'2026-11-01'}];
 const client={from(table){assert.equal(table,'cpu_projects');const query={insert(v){writes.push(v);this.saved=v;return this},update(v){writes.push(v);return this},single(){return Promise.resolve({data:{id:rows[0].id,...this.saved},error:null})},maybeSingle(){return Promise.resolve({data:rows[0],error:null})},select(){return this},eq(key,value){filters.push([key,value]);return this},neq(){return this},order(){return this},then(resolve){return Promise.resolve({data:rows,error:null}).then(resolve)}};return query}};
 vm.runInNewContext(code,{exports,URL,Date,Map,Buffer,AbortSignal,process:{env:{}},fetch:async(url,options)=>{assert.equal(options.headers['x-cbgpu-owner'],owner);backendCalls.push(url);return Response.json(url.endsWith('/servers')?{shared_project_ids:[]}:url.includes('/teams/')?{my_role:'owner'}:{projects:[{id:'existing-frontend',collaboration_role:'owner'}]})},require(name){
  if(name==='next/server')return {NextResponse};if(name==='node:net')return {};
  if(name==='node:fs/promises')return {readFile:async()=>Buffer.from('synthetic-key')};
  if(name==='@/lib/preprintsServer')return {publicationUser:async()=>approved?{id:owner}:null,preprintsClient:()=>client};
  if(name==='@/lib/deployAuth')return {activeDeploymentSession:async()=>active};
  if(name==='@/lib/requestSecurity')return {WindowRateLimiter};throw Error(name);
 }});
 return {filters,backendCalls,writes,request(path,{host='researcher.cbgpu.com',method='GET',origin,body}={}){const headers={host,authorization:'Bearer synthetic-session'};if(origin)headers.origin=origin;if(body)headers['content-type']='application/json';return exports[method](new NextRequest('https://'+host+'/api/deploy/'+path,{method,headers,body:body?JSON.stringify(body):undefined}),{params:Promise.resolve({path:path.split('/')})})}};
}
test('research and development workspace lists existing frontend and server projects',async()=>{
 const h=fixture();let r=await h.request('projects');assert.equal(r.status,200);assert.equal((await r.json()).projects[0].id,'existing-frontend');r=await h.request('servers/projects');assert.equal(r.status,200);const {projects}=await r.json();assert.equal(projects.length,1);assert.equal(projects[0].collaboration_role,'owner');assert.ok(h.filters.some(([key,value])=>key==='user_id'&&value===owner));assert.equal(h.backendCalls.length,2);
});
test('all supported deployment origins retain their authenticated listing route',async()=>{
 for(const host of ['researcher.cbgpu.com','developer.cbgpu.com','app.cbgpu.com','cbgpu.com']){const h=fixture();for(const path of ['projects','servers/projects'])assert.equal((await h.request(path,{host})).status,200)}
});
test('host repair does not bypass approval, active-session checks or origin validation',async()=>{
 for(const options of [{approved:false},{active:false}]){const h=fixture(options);for(const path of ['projects','servers/projects'])assert.equal((await h.request(path)).status,401);assert.equal(h.backendCalls.length,0)}
 const h=fixture();assert.equal((await h.request('projects',{host:'docs.cbgpu.com'})).status,404);assert.equal((await h.request('projects',{method:'POST',origin:'https://attacker.invalid'})).status,403);assert.equal(h.backendCalls.length,0);
});

test('server create and settings accept 8/16 GB but reject values above the 16 GB cap',async()=>{
 for(const memory of ['8g','16g']){
  const h=fixture();const response=await h.request('servers/projects',{method:'POST',origin:'https://researcher.cbgpu.com',body:{name:'Memory fixture',deploy_type:'docker',docker_image:'nginx:alpine',container_port:80,host_port:18080,memory_limit:memory}});assert.equal(response.status,201,JSON.stringify(await response.clone().json()));assert.equal(h.writes[0].memory_limit,memory);
  const edit=fixture();const saved=await edit.request('servers/projects/22222222-2222-4222-8222-222222222222',{method:'PATCH',origin:'https://researcher.cbgpu.com',body:{memory_limit:memory}});assert.equal(saved.status,200);assert.equal(edit.writes[0].memory_limit,memory);
 }
 for(const memory of ['32g','0g','unlimited']){const h=fixture();const response=await h.request('servers/projects',{method:'POST',origin:'https://researcher.cbgpu.com',body:{name:'Invalid memory',deploy_type:'docker',docker_image:'nginx:alpine',host_port:18080,memory_limit:memory}});assert.equal(response.status,400);assert.equal(h.writes.length,0)}
});
