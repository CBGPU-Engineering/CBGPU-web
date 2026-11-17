/** Synthetic guest-only browser proof; all school/provider operations are intercepted. */
import {chromium} from 'playwright';import assert from 'node:assert/strict';
const origin=process.env.CBGPU_STUDY_RESOURCE_TEST_ORIGIN||'http://localhost:13831';assert.match(origin,/^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const browser=await chromium.launch({headless:true,executablePath:process.env.CBGPU_CHROMIUM||'/tmp/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const session=await fetch(origin+'/backend/auth/v1/token?grant_type=password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'researcher@example.invalid',password:'demo-only'})}).then(r=>r.json());
 await context.addInitScript(s=>localStorage.setItem('sb-localhost-auth-token',JSON.stringify(s)),session);
 await page.route('**/api/auth/shared-session',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({state:'active',value:JSON.stringify(session)})}));
 await page.route('**/backend/rest/v1/profiles?**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({id:session.user.id,is_approved:false,is_admin:false,full_name:'Synthetic external study guest'})}));
 let allowed=true,sessionExpired=false,personalReads=0,disconnects=0,schoolWrites=0;
 const expiry=new Date(Date.now()+300000).toISOString();
 const school={id:'cbsh',official_name:'Synthetic CBsh',display_name:'Synthetic CBsh',type:'HIGH_SCHOOL',region:'Synthetic',features:['school_life','cbsh_eduset','projects'],ads_enabled:false,life_capabilities:{timetable:false,meal:false,news:false}};
 await page.route('**/api/schools/**',async route=>{
  const path=new URL(route.request().url()).pathname.slice('/api/schools/'.length);let data:unknown={},status=200;
  if(path==='memberships')data={items:[],current_school_id:null};
  else if(path==='resource-contexts')data={items:allowed?[{school_id:'cbsh',school,type:'GUEST',resources:['study'],expires_at:expiry,can_administer:false}]:[],current_school_id:allowed?'cbsh':null,server_time:new Date().toISOString()};
  else if(path==='schools/cbsh/resource-access')data={school_id:'cbsh',context_type:'GUEST',legacy_cbsh_access:false,expires_at:expiry,server_time:new Date().toISOString(),resources:{gpu:false,ai:false,study:allowed,school_storage:false,fabrication:false,school_compute:false,contests:false},reasons:{study:allowed?'ALLOWED':'NOT_GRANTED'}};
  else{status=403;data={error:'Unexpected endpoint'};}
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.route('**/api/study/proxy/**',async route=>{
  const path=new URL(route.request().url()).pathname.slice('/api/study/proxy'.length);let data:unknown=[];
  if(path==='/rooms')data=[{id:31,name:'Synthetic guest study room',hasSeats:false,width:1,height:1,capacity:20}];
  else if(path==='/policies/selfstudy')data={data:{timetable:{presets:{day:[{},{},{}]},assign:Object.fromEntries(Array.from({length:7},(_,i)=>[i,'day'])),exception:{}},timelimit:{}}};
  else if(path==='/students')data=[];
  else if(path!=='/selfstudy/search')throw Error('Unexpected school request '+path);
  if(path==='/selfstudy')schoolWrites++;
  await route.fulfill({status:allowed?200:403,contentType:'application/json',body:JSON.stringify(allowed?data:{message:'School permission revoked'})});
 });
 await page.route('**/api/study/student',async route=>{
  personalReads++;assert.ok(route.request().headers().authorization?.startsWith('Bearer '));
  if(route.request().method()==='POST'){const value=route.request().postDataJSON();if(value.action==='disconnect')disconnects++;else schoolWrites++;}
  const date=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
  const data=sessionExpired?{message:'CBGPU session expired — school connection preserved',code:'cbgpu_session_expired'}:{student:{id:'synthetic-student',name:'Preserved personal school connection',grade:2,classNo:1,number:1},date,open:false,opensAt:new Date().toISOString(),closesAt:new Date().toISOString(),periods:[1,2,3],entries:[],rooms:[{id:31,name:'Synthetic guest study room',hasSeats:false,width:1,height:1}],teachers:[{id:'teacher',name:'Synthetic supervisor'}],connectionExpiresAt:expiry};
  await route.fulfill({status:sessionExpired?401:allowed?200:403,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto(origin+'/study?mode=student',{waitUntil:'domcontentloaded'});
 await page.getByText('Synthetic guest study room',{exact:true}).first().waitFor();
 await page.getByText(/Preserved personal school connection/).first().waitFor();assert.ok(personalReads>0);
 sessionExpired=true;await page.getByRole('button',{name:'내 신청 새로고침',exact:true}).click();await page.getByText('CBGPU session expired — school connection preserved',{exact:true}).waitFor();
 assert.equal(await page.getByText(/Preserved personal school connection/).count(),1);assert.equal(await page.getByRole('button',{name:'연결 해제',exact:true}).count(),1);assert.equal(disconnects,0);
 allowed=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.getByRole('heading',{name:/이용할 학교 또는 임시 자원|현재 선택한 자원으로 자습신청/}).waitFor();
 assert.equal(await page.getByText('Synthetic guest study room',{exact:true}).count(),0);assert.equal(disconnects,0);assert.equal(schoolWrites,0);
 assert.ok(await page.evaluate(()=>!!localStorage.getItem('sb-localhost-auth-token')));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 await page.screenshot({path:'/tmp/cbgpu-study-resource-mobile.png',fullPage:true});
 console.log('PASS synthetic external study grant, personal school connection preserved on CBGPU session401, revocation hides stale data, zero school writes/disconnects, mobile viewport.');
 await context.close();
}finally{await browser.close();}
