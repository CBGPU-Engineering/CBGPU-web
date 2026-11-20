/** Synthetic local demo only. Set the fixture operator project/origin in the local Next server. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const origin=process.env.CBGPU_STUDIO_TEST_ORIGIN||'http://localhost:13860';
assert.match(origin,/^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const project='2541d072-1111-4111-8111-111111111111',challenge='c'.repeat(43),ticket='t'.repeat(43),target='https://studio-fixture.server.cbgpu.com';
const path='/server/'+project+'/open?challenge='+challenge,screenshots='docs/screenshots/studio-sso-synthetic-20261120';await mkdir(screenshots,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CBGPU_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const anonymous=await browser.newContext({viewport:{width:390,height:844}}),guest=await anonymous.newPage();
 await guest.route('**/api/auth/shared-session',r=>r.fulfill({json:{state:'empty',value:null}}));
 await guest.goto(origin+path,{waitUntil:'domcontentloaded'});
 const login=guest.locator('a[href^="/auth/login?next="]').filter({hasText:'로그인'}).first();await login.waitFor();
 const href=new URL((await login.getAttribute('href'))!,origin);assert.equal(href.pathname,'/auth/login');assert.equal(href.searchParams.get('next'),path);
 await login.click();await guest.waitForURL(url=>url.pathname==='/auth/login');assert.equal(new URL(guest.url()).searchParams.get('next'),path);await anonymous.close();
 const session=await fetch(origin+'/backend/auth/v1/token?grant_type=password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'student@example.invalid',password:'demo-only'})}).then(r=>r.json());assert(session.user?.id);
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await context.addInitScript(value=>localStorage.setItem('sb-localhost-auth-token',JSON.stringify(value)),session);
 const page=await context.newPage(),errors:string[]=[],posts:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/auth/shared-session',r=>r.fulfill({json:{state:'active',value:JSON.stringify(session)}}));
 let mode:'denied'|'injected'|'success'='denied';let navigated=false;
 await page.route('**/api/server/'+project+'/open',r=>{
  assert.equal(r.request().method(),'POST');assert.match(r.request().headers().authorization||'',/^Bearer /);posts.push(r.request().postData()!);
  return r.fulfill({status:mode==='denied'?403:200,json:mode==='denied'?{error:'private-provider-message'}:{url:mode==='injected'?'https://evil.invalid/steal':target+'/_cbgpu/auth/redeem?ticket='+ticket}});
 });
 await page.route(target+'/**',r=>{navigated=true;return r.fulfill({contentType:'text/html; charset=utf-8',body:'<main>합성 앱 연결 완료</main>'})});
 await page.goto(origin+path,{waitUntil:'domcontentloaded'});
 const confirm=page.getByRole('button',{name:'확인하고 TeacherStudio 열기',exact:true});await confirm.waitFor();assert.equal(posts.length,0,'No ticket before explicit confirmation');
 await confirm.click();await page.getByRole('alert').filter({hasText:'소유자·편집자'}).waitFor();assert.equal(navigated,false);assert.equal(new URL(page.url()).origin,origin);
 assert.equal(await page.getByText('private-provider-message',{exact:true}).count(),0);
 for(const width of [390,1440])for(const colorScheme of ['light','dark']as const){await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:`${screenshots}/${width}-${colorScheme}-denied.png`,fullPage:true})}
 mode='injected';await confirm.click();await page.getByRole('alert').filter({hasText:'안전한 연결 주소'}).waitFor();assert.equal(navigated,false);
 await page.goto(origin+path+'&returnUrl=https%3A%2F%2Fevil.invalid',{waitUntil:'domcontentloaded'});await page.getByRole('alert').filter({hasText:'연결 요청을 확인하지 못했어요'}).waitFor();assert.equal(await page.getByRole('button',{name:'확인하고 TeacherStudio 열기',exact:true}).count(),0);
 await page.goto(origin+path,{waitUntil:'domcontentloaded'});mode='success';await page.getByRole('button',{name:'확인하고 TeacherStudio 열기',exact:true}).click();await page.getByText('합성 앱 연결 완료',{exact:true}).waitFor();
 const webview=await browser.newContext({viewport:{width:390,height:844},colorScheme:'dark',userAgent:'Mozilla/5.0 (Linux; Android 13; wv) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36'});
 await webview.addInitScript(value=>localStorage.setItem('sb-localhost-auth-token',JSON.stringify(value)),session);
 const app=await webview.newPage();await app.route('**/api/server/'+project+'/open',r=>r.fulfill({status:403,json:{error:'fixture denied'}}));
 await app.goto(origin+path,{waitUntil:'domcontentloaded'});await app.getByRole('button',{name:'확인하고 TeacherStudio 열기',exact:true}).click();await app.getByRole('alert').filter({hasText:'소유자·편집자'}).waitFor();
 assert.equal(await app.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await app.screenshot({path:`${screenshots}/390-webview-dark-denied.png`,fullPage:true});await webview.close();
 assert.equal(page.url(),target+'/_cbgpu/auth/redeem?ticket='+ticket);assert.equal(navigated,true);assert(posts.every(body=>JSON.stringify(JSON.parse(body))===JSON.stringify({challenge})));assert.deepEqual(errors,[]);
 console.log(JSON.stringify({loginReturnPreserved:true,noAutomaticTicket:true,denied403NoNavigation:true,redirectInjectionBlocked:true,confirmedOpaqueTicketOnly:true,responsiveLightDark:true,pageErrors:errors}));
}finally{await browser.close()}
