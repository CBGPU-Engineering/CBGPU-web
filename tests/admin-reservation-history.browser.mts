/** Real Next pages and shared controls; unsigned synthetic Auth/portal/API fixtures only. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const origin=process.env.CBGPU_ADMIN_HISTORY_ORIGIN||'http://localhost:13900';
assert.match(origin,/^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const output=process.env.CBGPU_ADMIN_HISTORY_OUTPUT||'docs/screenshots/admin-history-20261123';fs.mkdirSync(output,{recursive:true});
const uid='00000000-0000-4000-8000-000000000101',sid='20000000-0000-4000-8000-000000000101';
const user={id:uid,email:'admin-fixture@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{full_name:'Synthetic administrator'},created_at:'2026-01-01T00:00:00Z'};
const session={access_token:Buffer.from(JSON.stringify({alg:'DEMO',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,session_id:sid,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated',aud:'authenticated'})).toString('base64url')+'.synthetic-local-only',refresh_token:'synthetic-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user};
const profile={id:uid,email:user.email,full_name:'Synthetic administrator',is_admin:true,is_approved:true,account_status:'ACTIVE',school_id:'cbsh',affiliation_verified:true,account_type:'TEACHER'};
const now=Date.now(),iso=(delta:number)=>new Date(now+delta).toISOString(),id=(n:number)=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const first=[
 {status:'approved',start:-3600000,end:3600000,purpose:'ACTIVE_APPROVED_FIXTURE',gpu_id:1},
 {status:'approved',start:3600000,end:7200000,purpose:'UPCOMING_APPROVED_FIXTURE',gpu_id:4},
 {status:'approved',start:-7200000,end:-3600000,purpose:'ARCHIVED_APPROVED_FIXTURE',gpu_id:2},
 {status:'pending',start:10800000,end:14400000,purpose:'PENDING_FUTURE_FIXTURE',gpu_id:3},
 {status:'pending',start:-7200000,end:-3600000,purpose:'EXPIRED_PENDING_FIXTURE',gpu_id:3},
 {status:'rejected',start:3600000,end:7200000,purpose:'REJECTED_FIXTURE',gpu_id:2},
 {status:'rejected',start:-7200000,end:-3600000,purpose:'ARCHIVED_REJECTED_FIXTURE',gpu_id:2},
 {status:'approved',start:-7200000,end:-3600000,purpose:'MISSING_PROFILE_FIXTURE',gpu_id:2},
];
const rows=Array.from({length:1201},(_,i)=>{const seed=first[i]||{status:'approved',start:3600000,end:7200000,purpose:i===300?'MOBILE_OLDER_FIXTURE':i===1000?'DESKTOP_OLDER_FIXTURE':'History fixture '+i,gpu_id:3};return {id:id(i+1),user_id:uid,user_email:i===7?'missing-profile@example.invalid':user.email,...seed,start_time:iso(seed.start),end_time:iso(seed.end),created_at:iso(-i*60000),profiles:i===7?null:{full_name:'Synthetic member '+i,student_id:String(2100+i)}}});
const browser=await chromium.launch({headless:true,executablePath:process.env.CBGPU_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];let mutations=0,external=0;
try{for(const [width,dark,app]of[[1280,false,false],[1280,true,false],[390,false,true],[390,true,true],[320,true,true]] as const){
 const context=await browser.newContext({viewport:{width,height:900},colorScheme:dark?'dark':'light',timezoneId:'Asia/Seoul',reducedMotion:'reduce',userAgent:app?'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36':undefined});
 await context.addInitScript(value=>localStorage.setItem('sb-localhost-auth-token',JSON.stringify(value)),session);
 const requests:{cursor:string|null;limit:number}[]=[];let unavailable=false;
 await context.route('**/*',async route=>{const request=route.request(),url=new URL(request.url());if(url.origin!==origin){external++;return route.abort();}const json=(value:unknown,status=200)=>route.fulfill({status,json:value});
  if(url.pathname==='/portal/session')return json({user_id:uid,auth_session_id:sid,csrf_token:'synthetic-csrf',session:{access_token:session.access_token,refresh_token:session.refresh_token}});
  if(url.pathname==='/portal/session/tokens')return json({ok:true});
  if(url.pathname==='/backend/auth/v1/user')return json(user);
  if(url.pathname==='/api/auth/shared-session')return json({state:'active',value:JSON.stringify(session)});
  if(url.pathname==='/backend/rest/v1/profiles')return request.headers().accept?.includes('vnd.pgrst.object')?json(profile):json([]);
  if(url.pathname==='/api/admin/profiles')return json({profiles:[profile]});
  if(url.pathname==='/api/admin/health')return json({study:null});
  if(url.pathname==='/backend/rest/v1/reservations'){
   assert.equal(request.method(),'GET','History browsing must not mutate reservations');
   const cursor=url.searchParams.get('or'),limit=Number(url.searchParams.get('limit')||1000),before=cursor?.match(/created_at\.lt\.([0-9TZ:.+-]+)/)?.[1],offset=before?rows.findIndex(row=>row.created_at===before)+1:0;assert(!before||offset>0,'Cursor must match a known fixture boundary');requests.push({cursor,limit});
   return unavailable?json({message:'synthetic read failure'},503):json(rows.slice(offset,offset+limit));
  }
  if(!['GET','HEAD'].includes(request.method())){mutations++;return route.abort();}
  if(url.pathname.startsWith('/backend/rest/v1/'))return json(url.pathname.endsWith('/site_banner')?null:[]);
  if(url.pathname.startsWith('/api/schools/'))return json({items:[],total:0});
  if(url.pathname.startsWith('/api/'))return json({items:[]});
  return route.continue();
 });
 const page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 if(!app){
  await page.goto(origin+'/admin/gpu?demo-frame=admin');const table=page.locator('table:visible').first();
  await table.getByText('ARCHIVED_APPROVED_FIXTURE',{exact:true}).waitFor();assert.equal(await table.evaluate(node=>node.scrollWidth>node.clientWidth+1),false,'GPU actions must fit the table without horizontal scrolling');await table.getByText('REJECTED_FIXTURE',{exact:true}).waitFor();await table.getByText('EXPIRED_PENDING_FIXTURE',{exact:true}).waitFor();
  const firstRecord=await table.getByText('ACTIVE_APPROVED_FIXTURE',{exact:true}).boundingBox();assert(firstRecord&&firstRecord.y>=0&&firstRecord.y<900,'Default desktop history must expose the first record within the initial viewport');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:`${output}/gpu-history-${width}-${dark?'dark':'light'}.png`});
  const views=page.getByRole('group',{name:'Reservation views'});
  await views.getByRole('button',{name:/^Approved/}).click();await table.getByText('ARCHIVED_APPROVED_FIXTURE',{exact:true}).waitFor();assert.equal(await table.getByText('REJECTED_FIXTURE',{exact:true}).count(),0);
  await views.getByRole('button',{name:/^Ended/}).click();await table.getByText('EXPIRED_PENDING_FIXTURE',{exact:true}).waitFor();assert.equal(await table.getByText('ACTIVE_APPROVED_FIXTURE',{exact:true}).count(),0);
  await views.getByRole('button',{name:/^All reservations/}).click();await page.getByRole('searchbox',{name:'Search current list'}).fill('DESKTOP_OLDER_FIXTURE');
  assert.equal(await table.getByText('DESKTOP_OLDER_FIXTURE',{exact:true}).count(),0);await page.getByRole('button',{name:'Load older reservations',exact:true}).click();await table.getByText('DESKTOP_OLDER_FIXTURE',{exact:true}).waitFor();assert(requests.some(r=>r.cursor?.includes(rows[999].created_at)));
  await page.goto(origin+'/admin/gpu?review=1&demo-frame=admin');await page.getByRole('button',{name:'Show all reservations',exact:true}).click();await page.locator('table:visible').first().getByText('ARCHIVED_APPROVED_FIXTURE',{exact:true}).waitFor();
  await page.setViewportSize({width:1024,height:900});await page.locator('article:visible').getByText('ARCHIVED_APPROVED_FIXTURE',{exact:true}).waitFor();assert.equal(await page.locator('table:visible').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.setViewportSize({width,height:900});
 }else{
  await page.goto(origin+'/admin/m?tab=gpu&demo-frame=admin');const history=page.getByRole('region',{name:'GPU 예약 전체 내역'});await history.getByText('ARCHIVED_APPROVED_FIXTURE',{exact:false}).waitFor();
  await history.getByText('이용 목적 · REJECTED_FIXTURE',{exact:true}).waitFor();await history.getByText('EXPIRED_PENDING_FIXTURE',{exact:false}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:`${output}/gpu-history-${width}-${dark?'dark':'light'}.png`});
  const card=(index:number)=>history.locator(`[data-reservation-id="${id(index+1)}"]`);
  await card(0).evaluate(element=>element.scrollIntoView({block:'center',behavior:'instant'}));await page.screenshot({path:`${output}/gpu-history-${width}-${dark?'dark':'light'}-records.png`});
  assert.equal(await card(3).getByRole('button',{name:'승인',exact:true}).count(),1);
  for(const index of [0,1,2,4,5,6,7])assert.equal(await card(index).getByRole('button').count(),0,'Only future pending records may expose approval actions');
  await history.getByRole('button',{name:'승인',exact:true}).first().click();await card(2).waitFor();assert.equal(await card(3).count(),0);
  await history.getByRole('button',{name:'종료',exact:true}).click();await card(4).waitFor();assert.equal(await card(0).count(),0);
  await history.getByRole('button',{name:'거절',exact:true}).first().click();await card(5).waitFor();assert.equal(await card(0).count(),0);
  await history.getByRole('button',{name:'전체',exact:true}).click();await history.getByRole('searchbox',{name:'GPU 예약 검색'}).fill('missing-profile@');await card(7).waitFor();assert.equal(await history.locator('article').count(),1);
  await history.getByRole('searchbox',{name:'GPU 예약 검색'}).fill('');await history.getByRole('combobox',{name:'GPU 번호 필터'}).click();await page.getByRole('option',{name:'GPU #4',exact:true}).click();await card(1).waitFor();assert.equal(await history.locator('article').count(),1);
  await history.getByRole('combobox',{name:'GPU 번호 필터'}).click();await page.getByRole('option',{name:'모든 GPU',exact:true}).click();await history.getByRole('button',{name:/^예약 더 보기/}).click();assert.equal(await history.locator('article').count(),60);
  const readError=page.getByRole('alert').filter({hasText:'GPU 예약을 불러오지 못했습니다.'});unavailable=true;await history.getByRole('button',{name:'GPU 예약 새로고침'}).click();await readError.waitFor();await card(2).waitFor();unavailable=false;await history.getByRole('button',{name:'GPU 예약 새로고침'}).click();await readError.waitFor({state:'hidden'});
  await history.getByRole('searchbox',{name:'GPU 예약 검색'}).fill('MOBILE_OLDER_FIXTURE');assert.equal(await history.locator('article').count(),0);await history.getByRole('button',{name:'이전 예약 불러오기',exact:true}).click();await history.getByText('MOBILE_OLDER_FIXTURE',{exact:false}).waitFor();assert(requests.some(r=>r.cursor?.includes(rows[299].created_at)));
 }
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);results.push({width,app,dark,allStatusesAndEndedVisible:true,olderHistoryAccessible:true,noMutation:true,noOverflow:true});await context.close();
}
assert.equal(mutations,0);assert.equal(external,0);fs.writeFileSync(output+'/PASSED.json',JSON.stringify({actualNext:true,syntheticOnly:true,mutations,external,results},null,2),{mode:0o600});console.log(JSON.stringify({results,mutations,external}));
}finally{await browser.close()}
