/** Loopback demo only. All note reads and writes are intercepted synthetic fixtures. */
import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const origin=process.env.CBGPU_NOTES_TEST_ORIGIN||'http://localhost:13880';
assert.match(origin,/^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const output=process.env.CBGPU_NOTES_TEST_OUTPUT||'/tmp/cbgpu-notes-persistence';fs.mkdirSync(output,{recursive:true});
const b=await chromium.launch({headless:true,executablePath:process.env.CBGPU_CHROMIUM||'/tmp/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];
try {
for(const config of [{name:'desktop-light',width:1440,height:1000,colorScheme:'light'},{name:'phone-dark',width:390,height:844,colorScheme:'dark'},{name:'phone-light',width:360,height:800,colorScheme:'light'},{name:'desktop-dark',width:1280,height:900,colorScheme:'dark'},{name:'android-webview',width:393,height:851,colorScheme:'dark'}]){
 const c=await b.newContext({viewport:{width:config.width,height:config.height},colorScheme:config.colorScheme as 'light'|'dark',...(config.name==='android-webview'?{userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/TEST; wv) AppleWebKit/537.36 Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36',reducedMotion:'reduce' as const}:{})});
 const session=await fetch(origin+'/backend/auth/v1/token?grant_type=password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'student@example.invalid',password:'demo-only'})}).then(r=>r.json());
 await c.addInitScript(s=>localStorage.setItem('sb-localhost-auth-token',JSON.stringify(s)),session);
 await c.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
 const p=await c.newPage();await p.route('**/api/auth/shared-session',r=>r.fulfill({json:{state:'active',value:JSON.stringify(session)}}));
 let row:Record<string,unknown>|null=null;let failNext=false;let delayNext=false;const writes:Record<string,unknown>[]=[];
 await p.route('**/backend/rest/v1/research_notes**',async r=>{
  const method=r.request().method();if(method==='GET')return r.fulfill({json:new URL(r.request().url()).searchParams.has('id')?row:[]});
  let body=r.request().postDataJSON();if(Array.isArray(body))body=body[0];writes.push({method,...body});if(failNext){failNext=false;return r.fulfill({status:503,json:{message:'Synthetic unavailable'}})}
  if(delayNext){delayNext=false;await new Promise(resolve=>setTimeout(resolve,2500))}
  if(method==='POST')await new Promise(resolve=>setTimeout(resolve,2800));
  row={...row,created_at:new Date().toISOString(),...body};return r.fulfill({json:row});
 });
 await p.goto(origin+'/notes',{waitUntil:'domcontentloaded'});await p.getByRole('button',{name:'새 노트',exact:true}).click();
 await p.getByPlaceholder('제목 없음',{exact:true}).fill('저장 검증');await p.locator('#note-content').fill('마지막 글자 Z');
 await p.waitForTimeout(2200);await p.locator('#note-content').fill('최신 내용 ZZ');await p.waitForTimeout(5200);
 assert.equal(writes.filter(w=>w.method==='POST').length,1);assert.equal(row?.content,'최신 내용 ZZ');
 await p.getByRole('button',{name:'—',exact:true}).click();await p.waitForTimeout(2300);assert.equal(row?.content,'최신 내용 ZZ\n---\n');
 await p.locator('input[placeholder^="태그 추가"]').scrollIntoViewIfNeeded();
 const tagBounds=await p.locator('input[placeholder^="태그 추가"]').boundingBox();const navBounds=await p.locator('.cb-bottom-nav').boundingBox();assert.ok(tagBounds&&navBounds&&tagBounds.y+tagBounds.height<=navBounds.y);
 if(config.name==='desktop-light'){failNext=true;await p.locator('#note-content').fill('실패해도 남아야 하는 내용');await p.waitForTimeout(2400);await p.getByRole('alert').filter({hasText:'저장 결과'}).waitFor();const count=writes.length;await p.waitForTimeout(2300);assert.equal(writes.length,count);assert.equal(await p.locator('#note-content').inputValue(),'실패해도 남아야 하는 내용');await p.getByRole('button',{name:'저장',exact:true}).click();await p.waitForTimeout(500);assert.equal(row?.content,'실패해도 남아야 하는 내용');
 delayNext=true;await p.locator('#note-content').fill('뒤로 저장 시작');await p.getByRole('button',{name:'노트 목록으로 돌아가기',exact:true}).click();await p.locator('#note-content').fill('뒤로 저장 중 추가 입력');await p.waitForTimeout(5500);assert.equal(await p.locator('#note-content').inputValue(),'뒤로 저장 중 추가 입력');assert.equal(row?.content,'뒤로 저장 중 추가 입력');
 await p.locator('#note-content').fill('다른 탭으로 이동 직전 입력');await p.getByRole('link',{name:'전체 기능',exact:true}).click();await p.waitForURL('**/services');await p.goto(origin+'/notes');await p.getByRole('button',{name:'작성하던 노트 복구',exact:true}).click();assert.equal(await p.locator('#note-content').inputValue(),'다른 탭으로 이동 직전 입력');await p.getByRole('button',{name:'저장',exact:true}).click();await p.waitForTimeout(700);assert.equal(row?.content,'다른 탭으로 이동 직전 입력');
 }

 const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
 await p.screenshot({path:output+'/'+config.name+'.png',fullPage:true});
 results.push({screen:config.name,oneCreate:true,latestSaved:true,toolbarAutosaved:true,noHorizontalOverflow:!overflow});await c.close();
}
fs.writeFileSync(output+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await b.close()}
