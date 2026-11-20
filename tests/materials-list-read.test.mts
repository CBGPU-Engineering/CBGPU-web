import test from 'node:test';
import assert from 'node:assert/strict';
import {readMaterialsList} from '../src/lib/materialsListRead.ts';

test('material list deadline releases the page even if the SDK never resolves',async()=>{
 let calls=0,signal!:AbortSignal;
 await assert.rejects(readMaterialsList(s=>{calls++;signal=s;return new Promise(()=>{})},undefined,10),{name:'TimeoutError'});
 assert.equal(signal.aborted,true);assert.equal(calls,1);
});
test('cancelled account reads do not start or retry and late responses cannot win',async()=>{
 const cancelled=new AbortController();cancelled.abort();let calls=0;
 await assert.rejects(readMaterialsList(async()=>{calls++;return []},cancelled.signal),{name:'AbortError'});
 assert.equal(calls,0);
 const controller=new AbortController();let resolve!:(value:string[])=>void;
 const pending=readMaterialsList(()=>new Promise<string[]>(r=>{resolve=r}),controller.signal);
 await Promise.resolve();controller.abort();resolve(['previous-account']);
 await assert.rejects(pending,{name:'AbortError'});
});
test('successful bounded material reads preserve data',async()=>{
 assert.deepEqual(await readMaterialsList(async()=>[{id:'fixture'}]),[{id:'fixture'}]);
});
