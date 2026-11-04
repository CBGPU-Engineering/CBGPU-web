import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/app/api/admin/careers/route.ts',import.meta.url),'utf8');
function handler({user={id:'admin'},admin=true,dbError=false}={}){
 let reads=0;
 const client={auth:{getUser:async()=>({data:{user},error:null})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{is_admin:admin},error:null})})})})};
 const exports={};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://example.test',NEXT_PUBLIC_SUPABASE_ANON_KEY:'public'}},require(name){if(name==='next/server')return {NextResponse:{json:(body,options)=>({body,...options})}};if(name==='@supabase/supabase-js')return {createClient:()=>client};if(name==='node:child_process')return {execFile(){}};if(name==='node:util')return {promisify:()=>async()=>{reads++;if(dbError)throw Error('db');return {stdout:'[]'};}};throw Error(name);}});
 return {get:token=>exports.GET({headers:{get:()=>token}}),reads:()=>reads};
}
test('anonymous requests never read careers DB',async()=>{const h=handler();assert.equal((await h.get(null)).status,401);assert.equal(h.reads(),0);});
test('invalid login never reads careers DB',async()=>{const h=handler({user:null});assert.equal((await h.get('Bearer test')).status,401);assert.equal(h.reads(),0);});
test('ordinary accounts cannot read applications',async()=>{const h=handler({admin:false});assert.equal((await h.get('Bearer test')).status,403);assert.equal(h.reads(),0);});
test('verified administrators can read without caching',async()=>{const h=handler();const r=await h.get('Bearer test');assert.equal(r.status,200);assert.equal(r.headers['Cache-Control'],'private, no-store');assert.equal(h.reads(),1);});
test('database failure returns no applicant data',async()=>{const h=handler({dbError:true});const r=await h.get('Bearer test');assert.equal(r.status,503);assert.equal(r.body.applications,undefined);});
