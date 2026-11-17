/** Real rendered UI with synthetic records only; no real notebook reads or writes. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const origin=process.env.CBGPU_NOTES_TEST_ORIGIN||'http://localhost:13831';
assert.match(origin,/^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const browser=await chromium.launch({headless:true,executablePath:process.env.CBGPU_CHROMIUM||'/tmp/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const context=await browser.newContext({viewport:{width:320,height:740}}),page=await context.newPage(),errors:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 const session=await fetch(origin+'/backend/auth/v1/token?grant_type=password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'researcher@example.invalid',password:'demo-only'})}).then(response=>response.json());
 await context.addInitScript(value=>localStorage.setItem('sb-localhost-auth-token',JSON.stringify(value)),session);
 await page.route('**/api/auth/shared-session',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({state:'active',value:JSON.stringify(session)})}));
 let writes=0;
 await page.route('**/backend/rest/v1/research_notes?**',route=>{if(route.request().method()!=='GET'){writes++;return route.fulfill({status:403,body:'{}'})}return route.fulfill({contentType:'application/json',body:JSON.stringify([{id:'11111111-1111-4111-8111-111111111111',user_id:session.user.id,title:'Keyboard note',content:'Synthetic private note',tags:[],is_shared:false,updated_at:'2026-11-17T00:00:00Z'}])})});
 await page.goto(origin+'/notes?mode=researcher',{waitUntil:'domcontentloaded'});
 const open=page.getByRole('button',{name:'노트 열기: Keyboard note',exact:true});
 await open.waitFor();await open.focus();await page.keyboard.press('Enter');
 await page.getByPlaceholder('제목 없음',{exact:true}).waitFor();
 await page.getByRole('button',{name:'노트 목록으로 돌아가기',exact:true}).click();
 const remove=page.getByRole('button',{name:'노트 삭제: Keyboard note',exact:true});await remove.waitFor();
 assert.equal(await remove.evaluate(element=>getComputedStyle(element).opacity),'1');
 const box=await remove.boundingBox();assert(box&&box.width>=44&&box.height>=44);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.screenshot({path:'/tmp/cbgpu-notes-accessibility-mobile.png',fullPage:true});
 assert.equal(writes,0);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({keyboardOpen:true,namedBackAction:true,touchDeleteVisible:true,touchTarget44:true,mobile320:true,noWrites:true,errors}));
}finally{await browser.close()}
