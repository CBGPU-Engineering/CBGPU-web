/** Synthetic local browser regression. Run scripts/demo.mts on CBGPU_ARCADE_TEST_ORIGIN first. */
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {seededRandom} from '../src/lib/arcadeClient.ts';
const origin=process.env.CBGPU_ARCADE_TEST_ORIGIN||'http://localhost:13848';
assert.match(origin,/^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const browser=await chromium.launch({headless:true,executablePath:process.env.CBGPU_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage']});
const evidence:unknown[]=[];
const screenshotDirectory='docs/screenshots/arcade-synthetic-20261120';
await mkdir(screenshotDirectory,{recursive:true});
const bffOrigin=process.env.CBGPU_ARCADE_BFF_TEST_ORIGIN;
if(bffOrigin)assert.match(bffOrigin,/^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
if(bffOrigin)for(const [path,options,status] of [
 ['/player',{},401],
 ['/sessions',{method:'POST',headers:{Authorization:'Bearer fixture-only','Content-Type':'application/json',Origin:'https://untrusted.invalid'},body:'{}'},403],
 ['/sessions',{method:'POST',headers:{Authorization:'Bearer fixture-only','Content-Type':'application/json',Origin:new URL(bffOrigin!).origin.replace(/:\d+$/,'')},body:JSON.stringify({padding:'x'.repeat(262145)})},413],
] as const){const response=await fetch(bffOrigin+'/api/arcade'+path,options);assert.equal(response.status,status);evidence.push({bffStatus:status})}
try{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const session=await fetch(origin+'/backend/auth/v1/token?grant_type=password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'student@example.invalid',password:'demo-only'})}).then(r=>r.json());
 assert(session.user?.id,'Synthetic demo authentication must be available');
 await context.addInitScript(value=>localStorage.setItem('sb-localhost-auth-token',JSON.stringify(value)),session);
 const page=await context.newPage(),errors:string[]=[],submissions:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/auth/shared-session',route=>route.fulfill({json:{state:'active',value:JSON.stringify(session)}}));
 let creates=0;
 await page.route('**/api/arcade/**',route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.pathname.endsWith('/sessions')){creates++;assert.match(req.headers().authorization||'',/^Bearer /);return route.fulfill({json:{id:'fixture-run-'+creates,seed:1,game:req.postDataJSON().game}})}
  if(url.pathname.endsWith('/submit')){submissions.push(req.postData()!);return route.fulfill({status:submissions.length===1?503:200,json:submissions.length===1?{error:'fixture interruption'}:{score:999994,personal_best:true}})}
  if(url.pathname.endsWith('/player'))return route.fulfill({json:{display_name:'테스트별명',participating:false}});
  return route.fulfill({json:{ownBest:submissions.length>1?999994:null,ownRank:null,entries:[],schoolName:null}});
 });
 await page.goto(origin+'/games?game=memory',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'카드 1 · 숨김',exact:true}).waitFor({timeout:90000});
 assert.equal(creates,0,'Practice mode must not create ranked sessions');
 await page.getByRole('button',{name:'기록 모드 켜기',exact:true}).click();
 await page.getByText('기록 모드 · 플레이를 검증한 후 저장해요.',{exact:true}).waitFor();
 const pool=[0,1,2,3,4,5,0,1,2,3,4,5],random=seededRandom(1);
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
 const expectedActions:number[]=[];
 for(let pair=0;pair<6;pair++)for(let i=0;i<pool.length;i++)if(pool[i]===pair){expectedActions.push(i);await page.getByRole('button',{name:`카드 ${i+1} · 숨김`,exact:true}).click();}
 await page.getByRole('button',{name:'기록 저장 다시 시도',exact:true}).waitFor();
 assert.equal(submissions.length,1);
 await page.getByRole('button',{name:'기록 저장 다시 시도',exact:true}).click();
 await page.getByText('검증한 기록을 저장했어요.',{exact:true}).waitFor();
 assert.equal(submissions.length,2);assert.equal(submissions[0],submissions[1]);assert.deepEqual(JSON.parse(submissions[0]),{actions:expectedActions});
 
 assert.equal(await page.getByRole('button',{name:/맞춘 카드$/}).count(),12);
 evidence.push({memorySeed:1,matched:12,attempts:6,retrySamePayload:true,bearerForwarded:true});
 for(const width of [320,390,1440])for(const colorScheme of ['light','dark'] as const){
  await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme});
  await page.screenshot({path:`${screenshotDirectory}/${width}-${colorScheme}.png`,fullPage:true});
  const size=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert(size.scroll<=size.viewport+1,JSON.stringify(size));
  const lastCard=await page.getByRole('button',{name:'카드 12 · 맞춘 카드',exact:true}).boundingBox();
  const field=await page.locator('.arcade-playfield').boundingBox();
  assert(lastCard&&field&&lastCard.x+lastCard.width<=field.x+field.width+1,'Last card must fit the playfield');evidence.push({width,colorScheme,noOverflow:true});
 }
 for(const game of ['mines','2048','snake','tetris','flappy','memory']){
  await page.locator(`[data-tab-value="${game}"]`).first().click();
  await page.getByRole('button',{name:'기록 모드 켜기',exact:true}).waitFor();
  assert.equal(await page.getByText('검증한 기록을 저장했어요.',{exact:true}).count(),0);
  for(const width of [320,390,1440]){
   await page.setViewportSize({width,height:900});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${game} at ${width}`);
  }
  evidence.push({game,widths:[320,390,1440],noOverflow:true});
 }
 assert.equal(creates,1,'Switching must reset to practice without leaking ranked sessions');
 const webview=await browser.newContext({viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (Linux; Android 13; wv) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',colorScheme:'dark'});
 await webview.addInitScript(value=>localStorage.setItem('sb-localhost-auth-token',JSON.stringify(value)),session);
 const app=await webview.newPage();
 await app.route('**/api/auth/shared-session',route=>route.fulfill({json:{state:'active',value:JSON.stringify(session)}}));
 await app.route('**/api/arcade/**',route=>route.fulfill({json:{ownBest:null,ownRank:null,entries:[],schoolName:null,display_name:'테스트별명',participating:false}}));
 await app.goto(origin+'/games?game=memory&from=app',{waitUntil:'domcontentloaded'});
 await app.getByRole('button',{name:'카드 1 · 숨김',exact:true}).waitFor();
 await app.screenshot({path:`${screenshotDirectory}/390-webview-dark.png`,fullPage:true});
 assert.equal(await app.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 evidence.push({webview390:true,noOverflow:true});await webview.close();
 assert.deepEqual(errors,[]);console.log(JSON.stringify({evidence,switchingResetsRanking:true,pageErrors:errors}));
}finally{await browser.close()}
