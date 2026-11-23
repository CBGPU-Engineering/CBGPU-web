/** Actual upload component; synthetic loopback-shaped transport, never real files/services. */
import { build } from 'esbuild';import postcss from 'postcss';import tailwind from '@tailwindcss/postcss';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import { chromium } from 'playwright';
const fixture=`import React from'react';import{createRoot}from'react-dom/client';import{OverlayProvider}from'overlay-kit';import{AlertProvider}from'./src/lib/alert';import Upload from'./src/app/materials/new/page';createRoot(document.getElementById('root')).render(<OverlayProvider><AlertProvider><Upload/></AlertProvider></OverlayProvider>);`;
const sdk=`const owner='11111111-1111-4111-8111-111111111111';window.__materialInserts=[];window.__materialReads=[];window.__materialRow=null;window.__materialReadFails=false;window.__materialInsertLost=false;window.__materialNavigations=[];export const supabase={auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:'synthetic-only-token'}}})},from(table){if(table!=='shared_materials')throw Error('Unexpected table');let insert=null,id=null,uploader=null;const query={insert(payload){insert=payload;return query},select(){return query},eq(key,value){if(key==='id')id=value;if(key==='uploader_id')uploader=value;return query},abortSignal(){return query},delete(){throw Error('Destructive cleanup forbidden')},async single(){window.__materialInserts.push(insert);window.__materialRow={...insert};if(window.__materialInsertLost){window.__materialReadFails=true;throw Error('Synthetic lost INSERT response')}return{data:{id:insert.id},error:null}},async maybeSingle(){window.__materialReads.push({id,uploader});if(window.__materialReadFails)return{data:null,error:{message:'Synthetic status unavailable'}};const row=window.__materialRow;return{data:row&&row.id===id&&row.uploader_id===uploader?{id:row.id,status:row.status}:null,error:null}}};return query}};`;
const built=await build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outfile:'materials-fixture.js',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},plugins:[{name:'synthetic-transport',setup(b){b.onResolve({filter:/next\/navigation$/},()=>({path:'navigation',namespace:'fixture'}));b.onResolve({filter:/\/(supabase|useAuth|SchoolResourceScope)$/},a=>({path:a.path.split('/').pop()!,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',contents:a.path==='supabase'?sdk:a.path==='navigation'?`export const useRouter=()=>({push:path=>window.__materialNavigations.push(path)});`:a.path==='useAuth'?`const user={id:'11111111-1111-4111-8111-111111111111'};export const useAuth=()=>({user});`:`export const useSchoolResourceScope=()=>({current:null});export const useSchoolResourcePermission=()=>({enabled:false,allowed:true,verify:async()=>true});`}))}}]});
const js=built.outputFiles.find(f=>f.path.endsWith('.js'))!.text,css=(await postcss([tailwind()]).process(fs.readFileSync('src/app/globals.css','utf8'),{from:path.resolve('src/app/globals.css')})).css;
const out='/tmp/cbgpu-materials-uncertain';fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({...(process.env.CBGPU_BROWSER_EXECUTABLE?{executablePath:process.env.CBGPU_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
try{for(const config of [{width:390,dark:false,app:false},{width:390,dark:true,app:false},{width:1280,dark:false,app:false},{width:1280,dark:true,app:false},{width:393,dark:true,app:true}])for(const scenario of ['committed-response-lost','insert-response-lost']){
 const page=await browser.newPage({viewport:{width:config.width,height:950},colorScheme:config.dark?'dark':'light',reducedMotion:'reduce',...(config.app?{userAgent:'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36'}:{})});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));let statusReads=0,putAttempts=0,commits=0,deletes=0,regained=false;
 await page.route('**/*',async route=>{const request=route.request(),url=new URL(request.url());assert.equal(url.origin,'https://fixture.local');
 if(request.method()==='DELETE'){deletes++;throw Error('No DELETE may be attempted')}
 if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:`<html class="${config.dark?'dark':''}"><meta charset="utf-8"><style>${css}</style><body><main class="p-4"><div id="root"></div></main><script src="/fixture.js"></script></body></html>`});
 if(url.pathname==='/fixture.js')return route.fulfill({contentType:'application/javascript',body:js});
 if(url.pathname==='/api/files/materials/quota')return route.fulfill({json:{remaining_bytes:1000000}});
 if(url.pathname.endsWith('/upload')){statusReads++;if(regained&&scenario==='insert-response-lost')return route.fulfill({json:{offset:0,size_bytes:7,complete:false}});if(!regained&&statusReads>1)return route.fulfill({status:503,json:{detail:'Synthetic status outage'}});return route.fulfill({json:{offset:regained?7:0,size_bytes:7,complete:regained}})}
 if(url.pathname.endsWith('/chunks')){putAttempts++;if(regained&&scenario==='insert-response-lost'){commits++;await page.evaluate(()=>{(window as any).__materialRow.status='ready'});return route.fulfill({json:{offset:7,complete:true}})}if(commits===0){commits++;await page.evaluate(()=>{(window as any).__materialRow.status='ready';(window as any).__materialReadFails=true});return route.abort('failed')}return route.fulfill({status:409,json:{detail:'Synthetic already committed'}})}
 throw Error('Unexpected request '+url.pathname);
 });
 await page.goto('https://fixture.local/');
 if(scenario==='insert-response-lost')await page.evaluate(()=>{(window as any).__materialInsertLost=true});
 await page.locator('#material-title').fill('보존해야 할 자료 제목');await page.getByLabel('공유할 파일 선택').setInputFiles({name:'synthetic.txt',mimeType:'text/plain',buffer:Buffer.from('fixture')});
 // Dispatch twice before React disables the submit control.
 await page.locator('form').evaluate(form=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))});
 await page.getByRole('button',{name:'전송 결과 확인',exact:true}).waitFor({state:'visible',timeout:20000});
 assert.equal(await page.locator('#material-title').inputValue(),'보존해야 할 자료 제목');assert.equal(await page.locator('#material-title').isDisabled(),true);assert.equal(await page.getByRole('button',{name:'선택한 파일 제거',exact:true}).isDisabled(),true);
 let inserts=await page.evaluate(()=>(window as any).__materialInserts);assert.equal(inserts.length,1);const id=inserts[0].id;assert.match(id,/^[0-9a-f-]{36}$/);assert.equal(deletes,0);
 // Rechecking while status is down must never allocate another row or transmit.
 const putsBefore=putAttempts;await page.getByRole('button',{name:'전송 결과 확인',exact:true}).click();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>(window as any).__materialInserts.length),1);assert.equal(putAttempts,putsBefore);assert.equal(deletes,0);
 await page.screenshot({path:`${out}/${scenario}-${config.width}-${config.dark?'dark':'light'}-${config.app?'app':'web'}.png`,fullPage:true});
 // The connection returns. A committed file is acknowledged, never deleted.
 regained=true;await page.evaluate(()=>{(window as any).__materialReadFails=false});
 if(scenario==='insert-response-lost'){
  await page.getByRole('button',{name:'전송 결과 확인',exact:true}).click();await page.getByRole('button',{name:'이어서 올리기',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>(window as any).__materialInserts.length),1);assert.equal(putAttempts,0);
  // The existing record resumes by its original ID; status proves completion.
  await page.getByRole('button',{name:'이어서 올리기',exact:true}).click();
 }else await page.getByRole('button',{name:'전송 결과 확인',exact:true}).click();
 await page.waitForFunction(()=>(window as any).__materialNavigations.includes('/materials'));
 inserts=await page.evaluate(()=>(window as any).__materialInserts);assert.equal(inserts.length,1);assert.equal(inserts[0].id,id);assert.equal(deletes,0);assert.equal(await page.evaluate(()=>(window as any).__materialRow.id),id);
 const reads=await page.evaluate(()=>(window as any).__materialReads);assert.ok(reads.every((r:any)=>r.id===id&&r.uploader==='11111111-1111-4111-8111-111111111111'));
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 console.log(JSON.stringify({...config,scenario,oneDraft:true,noDeletes:true,sameIdReconciled:true,putAttempts,commits}));await page.close();
}}finally{await browser.close()}
