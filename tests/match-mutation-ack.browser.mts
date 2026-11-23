/** Actual Next study screen; every mutation is intercepted with synthetic rows. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const origin=process.env.CBGPU_MATCH_TEST_ORIGIN||'http://localhost:13980';
assert.match(origin,/^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const output=process.env.CBGPU_MATCH_TEST_OUTPUT||'/tmp/cbgpu-match-ack';fs.mkdirSync(output,{recursive:true});
const session=await fetch(origin+'/backend/auth/v1/token?grant_type=password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'student@example.invalid',password:'demo-only'})}).then(r=>r.json());
const browser=await chromium.launch({headless:true,executablePath:process.env.CBGPU_CHROMIUM||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
const evidence:unknown[]=[];
try{
 for(const action of ['join','leave','delete','close','create'] as const)for(const app of [false,true]){
  const context=await browser.newContext({viewport:{width:app?390:1280,height:950},colorScheme:app?'dark':'light',reducedMotion:'reduce',...(app?{userAgent:'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36'}:{})});
  await context.addInitScript(s=>localStorage.setItem('sb-localhost-auth-token',JSON.stringify(s)),session);
  await context.route('**/*',route=>{const u=new URL(route.request().url());return ['localhost','127.0.0.1'].includes(u.hostname)?route.continue():route.abort()});
  const page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/auth/shared-session',route=>route.fulfill({json:{state:'active',value:JSON.stringify(session)}}));
  await page.route('**/api/ai/**',route=>route.fulfill({status:503,json:{error:'Synthetic AI is disabled'}}));
  const mine=session.user.id,other='00000000-0000-4000-8000-000000000999';
  let posts=[{id:'own-study',user_id:mine,title:'내 합성 스터디',description:'가상 모집 글',subject:'수학',tags:[],max_members:8,is_open:true,created_at:'2026-11-24T00:00:00Z'},{id:'other-study',user_id:other,title:'다른 사람 합성 스터디',description:'가상 참여 글',subject:'정보',tags:[],max_members:8,is_open:true,created_at:'2026-11-24T00:00:00Z'}];
  let members=action==='leave'?[{post_id:'other-study',user_id:mine,joined_at:'2026-11-24T00:00:00Z'}]:[];
  let mode:'zero'|'wrong'|'hold'='zero';let release:(()=>void)|undefined;const writes:{table:string;method:string;projection:string|null}[]=[];
  await page.route(/\/backend\/rest\/v1\/study_(posts|members)(?:\?|$)/,async route=>{
   const req=route.request(),url=new URL(req.url()),table=url.pathname.split('/').pop()!,method=req.method();
   if(method==='GET')return route.fulfill({json:table==='study_posts'?posts:table==='study_members'?members:table==='profiles'?[{id:mine,full_name:'합성 사용자',is_approved:true,is_admin:false,student_id:'2301'}]:[]});
   if(table!=='study_posts'&&table!=='study_members')return route.fulfill({json:[]});
   writes.push({table,method,projection:url.searchParams.get('select')});
   const selectedMode=mode;if(selectedMode==='hold')await new Promise<void>(resolve=>{release=resolve});
   const isMember=table==='study_members';const postId=url.searchParams.get('id')?.replace(/^eq\./,'')||url.searchParams.get('post_id')?.replace(/^eq\./,'')||'other-study';
   if(selectedMode==='zero')return route.fulfill({json:action==='create'?null:[]});
   if(selectedMode==='wrong')return route.fulfill({json:action==='create'?{id:''}:isMember?[{post_id:'unexpected-study',user_id:mine}]:[{id:'unexpected-study'}]});
   if(isMember){if(method==='POST')members.push({post_id:'other-study',user_id:mine,joined_at:new Date().toISOString()});else members=members.filter(m=>m.post_id!==postId||m.user_id!==mine);return route.fulfill({json:[{post_id:postId,user_id:mine}]})}
   if(method==='DELETE')posts=posts.filter(p=>p.id!==postId);
   else if(method==='PATCH')posts=posts.map(p=>p.id===postId?{...p,is_open:false}:p);
   else if(method==='POST'){const body=req.postDataJSON();posts.push({...posts[0],...body,id:'created-study'});return route.fulfill({json:{id:'created-study'}})}
   return route.fulfill({json:[{id:postId}]});
  });
  await page.goto(origin+'/match'+(app?'?from=app':''),{waitUntil:'networkidle'});
  await page.getByRole('button').filter({hasText:'다른 사람 합성 스터디'}).waitFor().catch(async error=>{console.log('FIXTURE_DEBUG',JSON.stringify({action,app,text:await page.locator('body').innerText(),errors}));await page.screenshot({path:output+'/fixture-failure.png',fullPage:true});throw error});
  if(action==='join'||action==='leave')await page.getByRole('button').filter({hasText:'다른 사람 합성 스터디'}).click();
  if(action==='create'){await page.getByRole('button',{name:'만들기',exact:true}).click();await page.locator('#match-title').fill('유지해야 하는 합성 제목');await page.locator('#match-description').fill('실패해도 그대로 남는 합성 설명');}
  const activate=async()=>{
   if(action==='join')await page.getByRole('button',{name:'참여하기',exact:true}).click();
   else if(action==='leave')await page.getByRole('button',{name:'탈퇴',exact:true}).click();
   else if(action==='close')await page.getByRole('button',{name:'스터디 모집 마감',exact:true}).click();
   else if(action==='delete'){await page.getByRole('button',{name:'스터디 삭제',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'삭제',exact:true}).click();}
   else await page.getByRole('button',{name:'스터디 만들기',exact:true}).click();
  };
  const errorText=action==='create'?'스터디 생성 결과를 확인하지 못했어요.':'처리 결과를 확인하지 못했어요.';
  for(const denied of ['zero','wrong'] as const){mode=denied;await activate();await page.getByText(errorText,{exact:false}).waitFor();assert.equal(await page.locator('.cb-feedback-toast').count(),0);if(action==='create'){assert.equal(await page.locator('#match-title').inputValue(),'유지해야 하는 합성 제목');assert.equal(await page.locator('#match-description').inputValue(),'실패해도 그대로 남는 합성 설명')}await page.getByRole('button',{name:'확인',exact:true}).click();}
  await page.waitForTimeout(250);assert.equal(writes.length,2,'denial must not auto-retry');
  await page.screenshot({path:`${output}/${action}-${app?'app':'web'}-denied.png`,fullPage:true});
  mode='hold';await activate();for(let i=0;i<100&&!release;i++)await page.waitForTimeout(10);assert.ok(release);
  if(action==='create'){const pending=page.getByRole('button',{name:'만드는 중…',exact:true});assert.equal(await pending.isDisabled(),true);await pending.evaluate(element=>{(element as HTMLButtonElement).click();(element as HTMLButtonElement).click()})}
  else await activate();
  await page.waitForTimeout(100);assert.equal(writes.length,3,'double action must send only one pending mutation');release!();
  if(action==='join')await page.getByText('참여했어요.',{exact:true}).waitFor();
  else if(action==='leave')await page.getByText('스터디에서 나왔어요.',{exact:true}).waitFor();
  else if(action==='delete'){await page.getByText('스터디를 삭제했어요.',{exact:true}).waitFor();await page.getByRole('button').filter({hasText:'내 합성 스터디'}).waitFor({state:'hidden'})}
  else if(action==='create'){await page.getByText('스터디를 만들었어요.',{exact:true}).waitFor();await page.getByRole('button').filter({hasText:'유지해야 하는 합성 제목'}).waitFor()}
  else await page.getByRole('button',{name:'스터디 모집 마감',exact:true}).waitFor({state:'hidden'});
  assert.deepEqual(errors,[]);assert.ok(writes.every(w=>w.projection===(w.table==='study_members'?'post_id,user_id':'id')));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:`${output}/${action}-${app?'app':'web'}-acknowledged.png`,fullPage:true});
  evidence.push({action,app,zeroRowsRejected:true,wrongIdentityRejected:true,validAckAccepted:true,singlePendingMutation:true,draftRetained:action==='create',writesIntercepted:writes.length,runtimeErrors:0});await context.close();
 }
 fs.writeFileSync(output+'/PASSED.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
}finally{await browser.close()}
