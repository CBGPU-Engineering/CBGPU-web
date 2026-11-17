import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/manufacturing/fileAccess.ts',import.meta.url),'utf8'),code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(){let viewer:string|null='owner',allowed=true,delay=false;let release:(value:any)=>void=()=>{};let created=0;const revoked:string[]=[],calls:string[]=[];const exports:Record<string,any>={};vm.runInNewContext(code,{exports,Blob,URL,process:{env:{}}});const lease=new exports.ManufacturingFileLease({createObjectURL:()=>`blob:fixture:${++created}`,revokeObjectURL:(url:string)=>revoked.push(url)});
 const client={
  auth:{getSession:async()=>({data:{session:viewer?{user:{id:viewer}}:null},error:null})},
  storage:{from:(bucket:string)=>{
   assert.equal(bucket,'manufacturing');
   return {
    createSignedUrl:()=>{throw Error('Scoped flow must NEVER mint a capability')},
    download:async(path:string)=>{
     calls.push(path);if(delay)return new Promise(r=>release=r);
     return allowed?{data:new Blob(['synthetic private file']),error:null}:{data:null,error:{statusCode:'403',message:'must-not-expose-provider-details'}};
    },
   };
  }},
 };
 return{lease,client,calls,revoked,created:()=>created,viewer:(value:string|null)=>viewer=value,deny:()=>allowed=false,delay:()=>delay=true,resolve:()=>release({data:new Blob(['late old private file']),error:null})};
}
test('owner reads after school grant loss and each user download rechecks current Storage RLS, not cached preview bytes',async()=>{
 const f=fixture();const preview=await f.lease.preview(f.client,'owner','owner/print/model.3mf',()=>true);assert.equal(preview,'blob:fixture:1');const download=await f.lease.download(f.client,'owner','owner/print/model.3mf',()=>true);assert.equal(download,'blob:fixture:2');assert.equal(f.calls.length,2);
 f.deny();await assert.rejects(f.lease.download(f.client,'owner','owner/print/model.3mf',()=>true),(e:any)=>e.status===403&&!e.message.includes('provider-details'));assert.equal(f.calls.length,3);assert.equal(f.created(),2);f.lease.invalidate();assert.deepEqual(f.revoked,['blob:fixture:1','blob:fixture:2']);
});
test('foreign/expired SDK identity is not borrowed and cannot start a file request',async()=>{
 const f=fixture();f.viewer('cookie-other-account');await assert.rejects(f.lease.preview(f.client,'owner','owner/laser/file.dxf',()=>true),(e:any)=>e.status===401);assert.equal(f.calls.length,0);f.viewer(null);await assert.rejects(f.lease.download(f.client,'owner','owner/laser/file.dxf',()=>true),(e:any)=>e.status===401);assert.equal(f.created(),0);
});
test('account/path change while file is in flight cannot create or restore the old blob URL',async()=>{
 for(const change of ['account','path']){const f=fixture();f.delay();let current=true;const pending=f.lease.preview(f.client,'owner','owner/print/old.3mf',()=>current);await new Promise(r=>setTimeout(r,0));current=false;f.lease.invalidate();if(change==='account')f.viewer('new-owner');f.resolve();assert.equal(await pending,null);assert.equal(f.created(),0);assert.deepEqual(f.revoked,[]);}
});
test('object URL cleanup owns only its own URLs and is idempotent',async()=>{
 const f=fixture();const a=await f.lease.preview(f.client,'owner','owner/print/a.3mf',()=>true),b=await f.lease.download(f.client,'owner','owner/print/a.3mf',()=>true);f.lease.release(b);f.lease.release(b);assert.deepEqual(f.revoked,[b]);f.lease.invalidate();f.lease.invalidate();assert.deepEqual(f.revoked,[b,a]);assert.ok(!f.revoked.includes('blob:another-component'));
});
test('auth account change during Storage read is rejected even before React observes the new owner',async()=>{
 const f=fixture();f.delay();const pending=f.lease.preview(f.client,'owner','owner/laser/file.dxf',()=>true);await new Promise(r=>setTimeout(r,0));f.viewer('different-session-owner');f.resolve();await assert.rejects(pending,(e:any)=>e.status===409);assert.equal(f.created(),0);
});
test('both detail pages keep signed links only inside the legacy branch and use fresh click download in V1',()=>{
 for(const kind of ['print','laser']){const text=fs.readFileSync(new URL(`../src/app/manufacturing/${kind}/[id]/page.tsx`,import.meta.url),'utf8');assert.match(text,/if \(!scopedFiles&&data\.file_path\)/);assert.equal((text.match(/createSignedUrl/g)||[]).length,1);assert.match(text,/scopedFiles\?file\.url:downloadUrl/);assert.match(text,/file\.download\(job\.file_name/);assert.match(text,/useManufacturingFile\(scopedFiles\?user\?\.id:undefined/);}
});

test('both queue download controls use the shared fresh reader before the legacy signer, without guarding own-history reads',()=>{
 for(const path of ['components/manufacturing/ManufacturingPage.tsx','components/admin/ManufacturingManagement.tsx']){const text=fs.readFileSync(new URL('../src/'+path,import.meta.url),'utf8');assert.match(text,/if\(scopedManufacturingFilesEnabled\(\)\)\{try\{await freshFileDownload\(path,name\)/);assert.equal((text.match(/createSignedUrl/g)||[]).length,1);assert.match(text,/useManufacturingDownloader\(user\?\.id\)/);}
 const list=fs.readFileSync(new URL('../src/components/manufacturing/ManufacturingPage.tsx',import.meta.url),'utf8');assert.match(list,/fabrication\.verify\(\)/);assert.match(list,/disabled=\{!canCreateRequest\}/);assert.match(list,/이전 신청은 볼 수 있어요/);assert.match(list,/\.eq\('user_id', user\.id\)/);
});
