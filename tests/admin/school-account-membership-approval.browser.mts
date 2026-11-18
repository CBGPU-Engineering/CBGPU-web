/** Actual admin UI through a local production preview. Synthetic identities only; every API is mocked. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {request as httpRequest} from 'node:http';
const port=Number(process.env.CBGPU_ADMIN_PREVIEW_PORT||14012),output=process.env.CBGPU_ADMIN_PROOF_DIR||'artifacts/school-account-membership-approval';
const owner='00000000-0000-4000-8000-000000000101',sessionId='00000000-0000-4000-8000-000000000102';
// Not signed or accepted by any real service. Used solely by the isolated portal-session fixture.
const token='fixture.'+Buffer.from(JSON.stringify({sub:owner,session_id:sessionId})).toString('base64url')+'.not-a-signature';
const schools={a:'가람과학고등학교',b:'나래고등학교'};
const common={is_admin:false,is_approved:true,is_laser_cut_manager:false,is_wakeup_manager:false};
const affiliation=(id:string,type='STUDENT',verified=true)=>({school_id:id,school_name:schools[id as 'a'|'b'],status:verified?'ACTIVE':'PENDING_VERIFICATION',membership_type:type,student_number:type==='STUDENT'?'1101':null,verified});
const ids={a:'00000000-0000-4000-8000-000000000201',b:'00000000-0000-4000-8000-000000000202',self:'00000000-0000-4000-8000-000000000203',dual:'00000000-0000-4000-8000-000000000204'};
const pending=(school:string,id:string,number:string)=>({...affiliation(school,'STUDENT',false),membership_id:id,student_number:number});
const profiles=[
 {...common,is_approved:false,id:'fixture-a',full_name:'Pending student A',student_id:null,email:'a@example.invalid',school_id:'a',primary_school_name:schools.a,school_affiliations:[pending('a',ids.a,'2211')]},
 {...common,is_approved:false,id:'fixture-b',full_name:'Pending student B',student_id:null,email:'b@example.invalid',school_id:'b',primary_school_name:schools.b,school_affiliations:[pending('b',ids.b,'B-008')]},
 {...common,is_approved:false,id:owner,full_name:'Self pending student',student_id:null,email:'self@example.invalid',school_id:'a',primary_school_name:schools.a,school_affiliations:[pending('a',ids.self,'SELF-009')]},
 {...common,is_approved:false,id:'fixture-dual',full_name:'Multiple school student',student_id:null,email:'dual@example.invalid',school_id:'a',primary_school_name:schools.a,school_affiliations:[pending('a',ids.dual,'DUAL-001'),pending('b',ids.dual,'DUAL-002')]},
];
await mkdir(output,{recursive:true,mode:0o700});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const results:unknown[]=[];
try{for(const frame of (process.env.CBGPU_ONLY_APP?['app']:['desktop','app']) as ('desktop'|'app')[])for(const theme of ['light','dark'] as const){
 const app=frame==='app',width=app?390:1280,origin='https://admin.cbgpu.com';
 const context=await browser.newContext({viewport:{width,height:1000},colorScheme:theme,reducedMotion:'reduce',serviceWorkers:'block',...(app?{userAgent:'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Version/4.0 Chrome/130.0 Mobile Safari/537.36'}:{})});
 await context.addInitScript(({owner,token})=>{
  const admin={id:owner,full_name:'Synthetic administrator',is_admin:true,is_approved:true};
  const session={user:{id:owner},access_token:token,refresh_token:'synthetic-only-refresh'};
  (window as any).__globalProfileWrites=0;const read=(table:string)=>{const query:any={};query.update=()=>{(window as any).__globalProfileWrites++;throw Error('Global profile approval is forbidden in this fixture')};for(const m of ['select','eq','neq','in','is','order','limit','range','gte','lte'])query[m]=()=>query;query.then=(yes:any,no:any)=>Promise.resolve({data:[],error:null}).then(yes,no);query.single=query.maybeSingle=async()=>({data:table==='profiles'?admin:null,error:null});return query};
  const channel:any={};channel.on=channel.subscribe=()=>channel;
  (window as any).__cbgpuAuthClient={from:read,channel:()=>channel,removeChannel:async()=> 'ok',auth:{getSession:async()=>({data:{session},error:null}),onAuthStateChange:(callback:any)=>{let active=true;queueMicrotask(()=>{if(active)callback('INITIAL_SESSION',session)});return{data:{subscription:{unsubscribe(){active=false}}}}}}};
 },{owner,token});
 await context.routeWebSocket('**/*',socket=>socket.close());
 let mutationAttempts=0,profileReads=0,failureMode='';let activeProfiles=structuredClone(profiles);const page=await context.newPage(),errors:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 await context.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url());
 if(url.origin!==origin)return route.abort();
 const json=(value:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
 if(url.pathname==='/portal/session')return json({user_id:owner,auth_session_id:sessionId,csrf_token:'synthetic-only-csrf',session:{access_token:token,refresh_token:'synthetic-only-refresh'}});
 if(url.pathname==='/portal/session/tokens')return json({ok:true});
 if(url.pathname==='/api/admin/profiles'&&request.method()==='GET'){profileReads++;return json({profiles:activeProfiles})}
 if(url.pathname==='/api/schools/admin/affiliation-requests'&&request.method()==='GET')return json({items:[]});
 if(request.method()==='PATCH'&&url.pathname.startsWith('/api/schools/schools/')){
  mutationAttempts++;const body=request.postDataJSON();assert.deepEqual(body,{action:'APPROVE',verification_note:'School membership reviewed through Accounts.'});
  if(url.pathname==='/api/schools/schools/a/members/'+ids.a){activeProfiles[0].school_affiliations[0]={...activeProfiles[0].school_affiliations[0],status:'ACTIVE',verified:true};return json({membership:{id:ids.a,user_id:'fixture-a',school_id:'a',status:'ACTIVE',verified:true}})}
  assert.equal(url.pathname,'/api/schools/schools/b/members/'+ids.b);
  if(failureMode==='503')return json({error:'Synthetic unavailable'},503);
  return json({membership:{id:failureMode==='wrong-id'?ids.a:ids.b,user_id:failureMode==='wrong-user'?'another-user':'fixture-b',school_id:failureMode==='wrong-school'?'a':'b',status:'ACTIVE',verified:true}});
 }
 if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/backend/')||url.pathname.startsWith('/portal/')){
 if(!['GET','HEAD'].includes(request.method()))mutationAttempts++;
 if(url.pathname==='/api/schools/memberships')return json({items:[],current_school_id:null});
 if(url.pathname==='/api/schools/resource-contexts')return json({items:[],current_school_id:null,server_time:new Date().toISOString()});
 return json({error:'Synthetic upstream denied'},403);
 }
 const headers:Record<string,string>={host:'admin.cbgpu.com','x-cbgpu-public-host':'admin.cbgpu.com','x-forwarded-proto':'https'};
 for(const k of ['accept','content-type','rsc','next-router-state-tree','next-url','next-router-prefetch','user-agent'])if(request.headers()[k])headers[k]=request.headers()[k];
 const response=await new Promise<{status:number;headers:Record<string,string>;body:Buffer}>((resolve,reject)=>{
 const upstream=httpRequest({hostname:'127.0.0.1',port,path:url.pathname+url.search,method:'GET',headers:{...headers,'accept-encoding':'identity'}},response=>{const chunks:Buffer[]=[];response.on('data',chunk=>chunks.push(Buffer.from(chunk)));response.on('end',()=>{const outputHeaders:Record<string,string>={};for(const[k,v]of Object.entries(response.headers))if(v!==undefined&&!['content-length','transfer-encoding'].includes(k))outputHeaders[k]=Array.isArray(v)?v.join(','):v;resolve({status:response.statusCode||502,headers:outputHeaders,body:Buffer.concat(chunks)})});response.on('error',reject)});upstream.on('error',reject);upstream.end();
 });
 return route.fulfill(response);
 });
 await page.goto(origin+(app?'/admin/accounts?from=app':'/admin?section=accounts'),{waitUntil:'domcontentloaded'});
 const filter=page.getByRole('combobox',{name:'Filter accounts by school'});await filter.waitFor({timeout:15000});
 const buttonName=app?'학교 소속 승인':'Approve membership';
 const component=(school:string,user:string)=>page.locator('[data-school-account-approval="'+school+'"][data-school-account-user="'+user+'"]').filter({visible:true});
 await component('a','fixture-a').waitFor();assert.equal(await component('a',owner).getByRole('button',{name:buttonName,exact:true}).isDisabled(),true);
 assert.equal(await page.locator('[data-school-account-user="fixture-dual"]').filter({visible:true}).count(),0);
 await page.screenshot({path:output+'/'+frame+'-'+theme+'-pending.png',fullPage:true});
 await component('a','fixture-a').getByRole('button',{name:buttonName,exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:buttonName,exact:true}).click();
 await component('a','fixture-a').getByRole('button',{name:buttonName,exact:true}).waitFor({state:'hidden'});await component('a','fixture-a').waitFor();await page.getByText('Approved',{exact:true}).filter({visible:true}).waitFor();await page.getByText('2211',{exact:true}).filter({visible:true}).first().waitFor();assert.equal(activeProfiles[0].is_approved,false);assert.equal(activeProfiles[0].school_affiliations[0].status,'ACTIVE');assert.equal(mutationAttempts,1);
 await page.screenshot({path:output+'/'+frame+'-'+theme+'-approved.png',fullPage:true});
 failureMode=frame==='desktop'?(theme==='light'?'503':'wrong-school'):(theme==='light'?'wrong-user':'wrong-id');
 await component('b','fixture-b').getByRole('button',{name:buttonName,exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:buttonName,exact:true}).click();
 await page.getByText(/Approval could not be confirmed|The operation could not be completed|승인 결과를 확인하지 못했어요/).filter({visible:true}).waitFor();await page.getByRole('dialog').getByRole('button',{name:/^(OK|확인)$/}).click();
 assert.equal(activeProfiles[1].school_affiliations[0].status,'PENDING_VERIFICATION');assert.equal(activeProfiles[1].is_approved,false);assert.equal(mutationAttempts,2);assert.equal(await page.evaluate(()=>(window as any).__globalProfileWrites),0);
 await filter.click();await page.getByRole('option',{name:schools.b,exact:true}).click();await component('b','fixture-dual').waitFor();assert.equal(await component('a','fixture-a').count(),0);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 results.push({frame,theme,schoolMembershipPatchOnly:true,globalApprovalUnchanged:true,selfDisabled:true,multiSchoolFilterRequired:true,failureMode,unconfirmedResponseNotApproved:true,syntheticPatchCount:mutationAttempts});await context.close();
 }await writeFile(output+'/PASSED.json',JSON.stringify({syntheticOnly:true,results},null,2));console.log(JSON.stringify(results));
}finally{await browser.close()}
