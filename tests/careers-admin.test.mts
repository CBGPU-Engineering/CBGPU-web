import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import os from 'node:os';
import path from 'node:path';
import {parseEnv} from 'node:util';
const source=fs.readFileSync(new URL('../src/app/api/admin/careers/route.ts',import.meta.url),'utf8');
function handler({user={id:'admin'},admin=true,dbError=false,active=undefined,activeError='ENOENT'}:{user?:{id:string}|null;admin?:boolean;dbError?:boolean;active?:string;activeError?:string}={}){
 let reads=0,files=0;const calls: Array<{command:string;args:string[];options:Record<string,any>}>=[];
 const client={auth:{getUser:async()=>({data:{user},error:null})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{is_admin:admin},error:null})})})})};
 const exports: Record<string, any> = {};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,{exports,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://example.test',NEXT_PUBLIC_SUPABASE_ANON_KEY:'public',NODE_ENV:'test'}},require(name){
  if(name==='next/server')return {NextResponse:{json:(body,options)=>({body,...options})}};
  if(name==='@supabase/supabase-js')return {createClient:()=>client};
  if(name==='node:child_process')return {execFile(){}};
  if(name==='node:path')return path;if(name==='node:os')return os;
  if(name==='node:fs/promises')return {readFile:async(file:string)=>{files++;if(file==='/fixture/careers.env')return 'CAREERS_DATABASE_URL=postgresql://fixture:private-fixture@127.0.0.1/example\n';if(active!==undefined)return active;throw Object.assign(Error('fixture configuration unavailable'),{code:activeError});}};
  if(name==='node:util')return {parseEnv,promisify:()=>async(command,args,options)=>{reads++;calls.push({command,args,options});if(dbError)throw Error('db');return {stdout:'[]'};}};
  throw Error(name);
 }});
 return {get:token=>exports.GET({headers:{get:()=>token}}),reads:()=>reads,files:()=>files,calls};
}
test('anonymous requests never read careers storage or configuration',async()=>{const h=handler();assert.equal((await h.get(null)).status,401);assert.equal(h.reads(),0);assert.equal(h.files(),0);});
test('invalid login never reads careers DB',async()=>{const h=handler({user:null});assert.equal((await h.get('Bearer test')).status,401);assert.equal(h.reads(),0);assert.equal(h.files(),0);});
test('ordinary accounts cannot read applications',async()=>{const h=handler({admin:false});assert.equal((await h.get('Bearer test')).status,403);assert.equal(h.reads(),0);assert.equal(h.files(),0);});
test('verified administrators use native read-only compatibility before handoff',async()=>{const h=handler();const r=await h.get('Bearer test');assert.equal(r.status,200);assert.equal(r.headers['Cache-Control'],'private, no-store');assert.equal(h.reads(),1);assert(h.calls[0].command.endsWith('/cbgpu-careers'));assert.equal(h.calls[0].args[0],'--legacy-list');assert.equal(h.calls[0].options.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,undefined);});
test('database failure returns no applicant data',async()=>{const h=handler({dbError:true});const r=await h.get('Bearer test');assert.equal(r.status,503);assert.equal(r.body.applications,undefined);});
test('PostgreSQL activation selects native reader without exposing credentials',async()=>{const h=handler({active:JSON.stringify({store:'postgres',env_file:'/fixture/careers.env'})});const r=await h.get('Bearer test');assert.equal(r.status,200);assert.equal(h.calls[0].args[0],'--list');assert(h.calls[0].options.env.CAREERS_DATABASE_URL.includes('private-fixture'));assert(!JSON.stringify(r).includes('private-fixture'));});
test('invalid activation never silently returns stale legacy data',async()=>{for(const active of ['null','{}','not-json',JSON.stringify({store:'postgres',env_file:'relative.env'}),JSON.stringify({store:'unknown',env_file:'/fixture/careers.env'})]){const h=handler({active});assert.equal((await h.get('Bearer test')).status,503);assert.equal(h.reads(),0);}});
test('unreadable activation fails closed',async()=>{const h=handler({activeError:'EACCES'});assert.equal((await h.get('Bearer test')).status,503);assert.equal(h.reads(),0);});
