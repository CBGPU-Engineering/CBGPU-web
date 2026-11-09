import test from 'node:test';import assert from 'node:assert/strict';
import {browserAuthLock} from '../src/lib/browserAuthLock.ts';
const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');
function install(locks){Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks}})}
function restore(){if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator}
test('a zero-timeout refresh queues behind an existing holder rather than immediately failing or stealing',async()=>{
 const queues=new Map();let active=0,max=0;const options=[];
 install({request(name,opts,fn){options.push(opts);const previous=queues.get(name)||Promise.resolve();const work=previous.catch(()=>{}).then(()=>fn({name}));queues.set(name,work);return work}});
 try{let release,held;const ready=new Promise(r=>held=r);
 const first=browserAuthLock('shared',500,async()=>{active++;max=Math.max(max,active);held();await new Promise(r=>release=r);active--;return 'first'});
 await ready;const second=browserAuthLock('shared',0,async()=>{active++;max=Math.max(max,active);active--;return 'second'});
 await new Promise(r=>setTimeout(r,5));assert.equal(active,1);release();assert.deepEqual(await Promise.all([first,second]),['first','second']);assert.equal(max,1);assert.ok(options.every(o=>!o.ifAvailable&&!o.steal&&o.mode==='exclusive'));
 }finally{restore()}
});
test('bounded lock failure is marked for SDK refresh handling and never runs the operation without a lock',async()=>{
 install({request(name,{signal}){return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}))}});
 try{let ran=false;await assert.rejects(browserAuthLock('busy',10,async()=>{ran=true}),e=>e.isAcquireTimeout===true&&e.name==='BrowserAuthLockTimeout');assert.equal(ran,false)}finally{restore()}
});
test('platforms without Web Locks still serialize in-process session work and recover from errors',async()=>{
 install(undefined);try{let active=0,max=0;const run=()=>browserAuthLock('fallback',0,async()=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,2));active--;return true});await Promise.all([run(),run(),run()]);assert.equal(max,1);await assert.rejects(browserAuthLock('failure',100,async()=>{throw Error('operation failed')}));assert.equal(await browserAuthLock('failure',100,async()=>42),42)}finally{restore()}
});
