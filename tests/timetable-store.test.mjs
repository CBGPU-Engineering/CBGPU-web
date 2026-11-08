import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {fileTimetableStore} from '../src/lib/timetableStore.ts';
test('last-good snapshot is atomic, private and readable by a restarted loader',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'cbgpu-timetable-'));try{const file=path.join(dir,'data/latest.json'),store=fileTimetableStore(file),snapshot={version:1,at:123,raw:{test:'first'}};await store.write(snapshot);assert.deepEqual(await fileTimetableStore(file).read(),snapshot);await store.write({...snapshot,at:456});assert.equal((await store.read()).at,456);assert.equal((await fs.stat(file)).mode&0o777,0o600);assert.deepEqual(await fs.readdir(path.dirname(file)),['latest.json'])}finally{await fs.rm(dir,{recursive:true,force:true})}
});
