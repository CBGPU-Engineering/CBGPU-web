import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import vm from 'node:vm';
import fs from 'node:fs';

const exports: Record<string, any> = {};
const code=ts.transpileModule(fs.readFileSync(new URL('../src/lib/serviceDiscovery.ts',import.meta.url),'utf8'),
 {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(code,{exports,URL,require:()=>({
 workspaceServicePaths:{student:['/ai','/study','/community'],researcher:['/ai','/notes','/community']},
 workspaces:{student:{host:'student.cbgpu.com'},researcher:{host:'researcher.cbgpu.com'}},
})});

test('app deep links preserve chat IDs, page queries and the current shared-service mode',()=>{
 const destination=exports.serviceDestination('/ai?c=chat-id','student',true);
 const url=new URL(destination,'https://app.cbgpu.com');
 assert.equal(url.searchParams.get('c'),'chat-id');
 assert.equal(url.searchParams.get('mode'),'student');
 assert.equal(url.searchParams.get('native'),'1');
 const note=new URL(exports.serviceDestination('/notes?note=note-id#preview','student',true),'https://app.cbgpu.com');
 assert.equal(note.searchParams.get('note'),'note-id');
 assert.equal(note.searchParams.get('mode'),'researcher');
 assert.equal(note.hash,'#preview');
});

test('community keeps the selected user space inside the app',()=>{for(const mode of['student','researcher']){const value=exports.serviceDestination('/community',mode,true);assert.equal(new URL(value,'https://app.cbgpu.com').pathname,'/community');assert.equal(new URL(value,'https://app.cbgpu.com').searchParams.get('mode'),mode);assert.equal(value.startsWith('https://cbgpu.com'),false)}});
