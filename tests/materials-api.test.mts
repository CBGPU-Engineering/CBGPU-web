import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync(new URL('../src/lib/materialsApi.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(response:Response){const exports:Record<string,any>={};vm.runInNewContext(code,{exports,Error,TypeError,AbortController,setTimeout,clearTimeout,fetch:async(url:string,options:RequestInit)=>{assert.equal(url,'/api/files/quota');assert.equal(options.cache,'no-store');assert.equal((options.headers as Record<string,string>).Authorization,'Bearer synthetic-only');return response},require(){return{supabase:{auth:{getSession:async()=>({data:{session:{access_token:'synthetic-only'}}})}}}}});return exports;}
test('materials quota preserves object replies and old-server optional endpoint behavior',async()=>{assert.deepEqual(await fixture(Response.json({used_bytes:2})).fetchMaterialsJson('/quota'),{used_bytes:2});for(const status of [404,405])assert.equal(await fixture(new Response('old server',{status})).fetchMaterialsJson('/quota'),null)});
test('materials HTML/proxy errors never escape as JSON syntax errors or private body content',async()=>{for(const status of [200,502])await assert.rejects(()=>fixture(new Response('<!DOCTYPE html>private proxy',{status})).fetchMaterialsJson('/quota'),error=>{assert.match((error as Error).message,/다시 확인/);assert.doesNotMatch((error as Error).message,/private|Unexpected|DOCTYPE/);return true})});
