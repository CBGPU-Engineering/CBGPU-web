import test from 'node:test';import assert from 'node:assert/strict';
import {createNotePersistence,createSerializedWriter,NoteConflict,type NoteDraft,type ResearchNote} from '../src/lib/notePersistence.ts';
import {boundedClientRequest}from'../src/lib/boundedClientRequest.ts';
const draft=(content:string):NoteDraft=>({title:'Fixture',content,tags:['one'],is_shared:false});
const row=(content:string,version='v1'):ResearchNote=>({...draft(content),id:'fixture-note',user_id:'fixture-owner',created_at:'created',updated_at:version});
function deferred<T>(){let resolve!:(v:T)=>void;let reject!:(e:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
test('slow saves serialize; queued newer snapshots coalesce rather than overwrite out of order',async()=>{
 const first=deferred<number>(),calls:number[]=[];let active=0,max=0;
 const writer=createSerializedWriter(async(v:number)=>{calls.push(v);max=Math.max(max,++active);if(v===1)await first.promise;active--;return v});
 const a=writer.save(1),b=writer.save(2),c=writer.save(3);assert.deepEqual(calls,[1]);first.resolve(1);assert.deepEqual(await Promise.all([a,b,c]),[1,3,3]);assert.deepEqual(calls,[1,3]);assert.equal(max,1);
});
test('a failed write rejects queued work without automatically repeating mutations',async()=>{
 const first=deferred<number>(),calls:number[]=[];const writer=createSerializedWriter(async(v:number)=>{calls.push(v);return v===1?first.promise:v});
 const a=assert.rejects(writer.save(1)),b=assert.rejects(writer.save(2));first.reject(Error('lost response'));await Promise.all([a,b]);assert.deepEqual(calls,[1]);assert.equal(await writer.save(3),3);
});
test('uncertain create reconciles its stable ID before retry and never inserts a duplicate',async()=>{
 let saved:ResearchNote|null=null,creates=0,updates=0,reads=0;
 const persist=createNotePersistence({id:'fixture-note',owner:'fixture-owner',initial:null,read:async()=>{reads++;return saved},create:async d=>{creates++;saved={...row(d.content),...d};throw Error('response lost after commit')},update:async(d,version)=>{updates++;assert.equal(version,'v1');saved={...row(d.content,'v2'),...d};return saved}});
 await assert.rejects(persist(draft('last character Z')));assert.equal(saved!.content,'last character Z');assert.equal((await persist(draft('last character Z'))).content,'last character Z');assert.equal(creates,1);assert.equal(reads,1);assert.equal(updates,0);
 assert.equal((await persist(draft('newer text'))).content,'newer text');assert.equal(updates,1);
});
test('an uncertain response does not overwrite a separately updated note',async()=>{
 let saved=row('original');let updates=0;
 const persist=createNotePersistence({id:'fixture-note',owner:'fixture-owner',initial:saved,read:async()=>saved,create:async()=>assert.fail(),update:async()=>{updates++;throw Error('network')}});
 await assert.rejects(persist(draft('my edit')));saved=row('another device','v2');await assert.rejects(persist(draft('my edit')),NoteConflict);assert.equal(updates,1);assert.equal(saved.content,'another device');
});
test('optimistic version mismatch cannot report a successful save or recreate a deleted note',async()=>{
 let updates=0;const persist=createNotePersistence({id:'fixture-note',owner:'fixture-owner',initial:row('old'),read:async()=>null,create:async()=>assert.fail(),update:async(_d,v)=>{updates++;assert.equal(v,'v1');return null}});
 await assert.rejects(persist(draft('edit')),NoteConflict);assert.equal(updates,1);
});
test('request deadline aborts preparation and prevents a late SDK continuation from sending a write',async()=>{
 const ready=deferred<void>();let writes=0;
 const work=boundedClientRequest(async signal=>{await ready.promise;if(signal.aborted)throw signal.reason;writes++;return 'saved'},undefined,10);
 await assert.rejects(work);ready.resolve();await new Promise(r=>setTimeout(r,0));assert.equal(writes,0);
});
test('unmount cancels queued saves while an already submitted write can finish once',async()=>{
 const gate=deferred<number>(),calls:number[]=[];const writer=createSerializedWriter(async(v:number)=>{calls.push(v);return gate.promise});const active=writer.save(1);const pending=assert.rejects(writer.save(2));writer.cancelPending();gate.resolve(1);assert.equal(await active,1);await pending;assert.deepEqual(calls,[1]);
});
