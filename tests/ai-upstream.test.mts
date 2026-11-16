import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,chmod,symlink,rm,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {aiUpstreamOrigin,parseAiUpstream} from '../src/lib/aiUpstream.ts';

test('AI routing accepts only versioned fixed loopback listeners, never arbitrary URLs',()=>{
 for(const port of [3550,13550,13551])assert.equal(parseAiUpstream({version:1,port}),`http://127.0.0.1:${port}`);
 for(const value of [null,[],{version:1,port:80},{version:2,port:3550},{version:1,port:'3550'},{url:'http://169.254.169.254/'},{version:1,port:NaN}])assert.throws(()=>parseAiUpstream(value));
});

test('missing route preserves legacy service; private atomic changes select the next request',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cbgpu-ai-route-'));const file=join(dir,'active.json');
 try{
  assert.equal(await aiUpstreamOrigin(file),'http://127.0.0.1:3550');
  await writeFile(file,JSON.stringify({version:1,port:13550}),{mode:0o600});
  assert.equal(await aiUpstreamOrigin(file),'http://127.0.0.1:13550');
  await writeFile(file+'.next',JSON.stringify({version:1,port:13551}),{mode:0o600});
  await rename(file+'.next',file);
  assert.equal(await aiUpstreamOrigin(file),'http://127.0.0.1:13551');
  await rm(file);assert.equal(await aiUpstreamOrigin(file),'http://127.0.0.1:3550');
 }finally{await rm(dir,{recursive:true,force:true})}
});

test('corrupt, shared, oversized and symlink manifests fail closed instead of leaking internal keys',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cbgpu-ai-route-'));const file=join(dir,'active.json');
 try{
  await writeFile(file,'{',{mode:0o600});await assert.rejects(aiUpstreamOrigin(file));
  await writeFile(file,JSON.stringify({version:1,port:13550}));await chmod(file,0o644);await assert.rejects(aiUpstreamOrigin(file));
  await chmod(file,0o600);await writeFile(file,' '.repeat(1025));await assert.rejects(aiUpstreamOrigin(file));
  await writeFile(file,JSON.stringify({version:1,port:13550}));await symlink(file,join(dir,'link'));await assert.rejects(aiUpstreamOrigin(join(dir,'link')));
 }finally{await rm(dir,{recursive:true,force:true})}
});
