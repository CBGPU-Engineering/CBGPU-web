/** Actual local UI with synthetic demo identities; never run against a production origin. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const origin=process.env.CBGPU_FRONTEND_AUDIT_ORIGIN||'http://localhost:13852';
assert.match(origin,/^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const screenshots='docs/screenshots/frontend-reliability-synthetic-20261120';
await mkdir(screenshots,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CBGPU_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage']});
const login=async(email:string)=>fetch(origin+'/backend/auth/v1/token?grant_type=password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:'demo-only'})}).then(r=>r.json());
try{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 let session=await login('student@example.invalid');assert(session.user?.id);
 await context.addInitScript(value=>localStorage.setItem('sb-localhost-auth-token',JSON.stringify(value)),session);
 const page=await context.newPage(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));let timetableRequests=0;
 await page.route('**/api/auth/shared-session',r=>{
  if(r.request().method()==='POST'){const value=r.request().postDataJSON()?.value;session=value?JSON.parse(value):null}
  return r.fulfill({json:{state:session?'active':'signed-out',value:session?JSON.stringify(session):null}});
 });
 await page.route('**/backend/rest/v1/profiles?**',r=>r.fulfill({status:503,json:{message:'fixture profile unavailable'}}));
 await page.route('**/api/timetable?**',r=>{timetableRequests++;return r.fulfill({json:{grid:{0:{1:{subject:'프로필 없이 조회한 수업',teacher:''}}},grades:[1,2,3],classes:[1,2,3,4],provider:'comcigan',stale:false}})});
 await page.goto(origin+'/timetable',{waitUntil:'domcontentloaded'});
 await page.getByText('프로필 없이 조회한 수업',{exact:true}).waitFor();assert(timetableRequests>0);
 await page.screenshot({path:`${screenshots}/timetable-profile-unavailable-mobile.png`,fullPage:true});
 let reads=0;
 const material=(title:string)=>({id:'fixture-material',uploader_id:session.user.id,title,tags:['합성 자료'],file_name:'fixture.txt',content_type:'text/plain',size_bytes:10,created_at:'2026-11-20T00:00:00Z'});
 await page.route('**/backend/rest/v1/shared_materials?**',r=>{reads++;return reads===1?r.fulfill({status:503,json:{message:'fixture list outage'}}):r.fulfill({json:[material('다시 불러온 합성 자료')]})});
 await page.goto(origin+'/materials',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'목록 다시 불러오기',exact:true}).waitFor();
 assert.equal(await page.getByText('아직 공유된 자료가 없어요',{exact:true}).count(),0,'An outage must not claim the list is empty');
 await page.screenshot({path:`${screenshots}/materials-read-error-mobile.png`,fullPage:true});
 await page.getByRole('button',{name:'목록 다시 불러오기',exact:true}).click();
 await page.getByRole('link',{name:'다시 불러온 합성 자료',exact:true}).waitFor();assert.equal(reads,2);
 for(const width of [320,390,1440])for(const colorScheme of ['light','dark'] as const){
  await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:`${screenshots}/materials-${width}-${colorScheme}.png`,fullPage:true});
 }
 // A prior account's unresolved list must not appear after switching identities.
 let release!:()=>void,started!:()=>void;
 const requested=new Promise<void>(r=>{started=r}),held=new Promise<void>(r=>{release=r});let stagedReads=0;
 await page.unroute('**/backend/rest/v1/shared_materials?**');
 await page.route('**/backend/rest/v1/shared_materials?**',async r=>{
  stagedReads++;if(stagedReads===1){started();await held;await r.fulfill({json:[material('이전 계정의 늦은 자료')]}).catch(()=>{});return}
  await r.fulfill({json:[material('현재 계정의 합성 자료')]});
 });
 await page.reload({waitUntil:'domcontentloaded'});await requested;
 const next=await login('researcher@example.invalid');
 await page.evaluate(async value=>{const client=(window as any).__cbgpuAuthClient;const result=await client.auth.setSession(value);if(result.error)throw result.error}, {access_token:next.access_token,refresh_token:next.refresh_token});
 await page.getByRole('link',{name:'현재 계정의 합성 자료',exact:true}).waitFor();release();
 await page.waitForTimeout(200);
 assert.equal(await page.getByText('이전 계정의 늦은 자료',{exact:true}).count(),0);
 const webview=await browser.newContext({viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (Linux; Android 13; wv) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',colorScheme:'dark'});
 await webview.addInitScript(value=>localStorage.setItem('sb-localhost-auth-token',JSON.stringify(value)),session);
 const app=await webview.newPage();
 await app.route('**/api/auth/shared-session',r=>r.fulfill({json:{state:'active',value:JSON.stringify(session)}}));
 await app.route('**/backend/rest/v1/shared_materials?**',r=>r.fulfill({json:[material('앱에서 조회한 합성 자료')]}));
 await app.goto(origin+'/materials?from=app',{waitUntil:'domcontentloaded'});
 await app.getByRole('link',{name:'앱에서 조회한 합성 자료',exact:true}).waitFor();
 assert.equal(await app.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await app.screenshot({path:`${screenshots}/materials-webview-390-dark.png`,fullPage:true});
 await webview.close();
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({profileUnavailableTimetableLoaded:true,material503Retry:true,readCount:reads,lateAccountReplyRejected:true,mobileDesktopLightDarkNoOverflow:true,pageErrors:errors}));
}finally{await browser.close()}
