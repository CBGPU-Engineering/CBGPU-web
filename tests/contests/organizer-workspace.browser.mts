/** Isolated real-Next contest workspace QA. No provider, private API, or real mutations. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {request as httpRequest} from 'node:http';
import {chromium,type BrowserContext} from 'playwright';
const port=Number(process.env.CBGPU_CONTEST_PREVIEW_PORT||13971),output=process.env.CBGPU_CONTEST_PROOF_DIR||'artifacts/contest-organizer-workspace';
const owner='00000000-0000-4000-8000-000000000101',participant='00000000-0000-4000-8000-000000000102';
const teamId='10000000-0000-4000-8000-000000000001',individualId='10000000-0000-4000-8000-000000000002',endedId='10000000-0000-4000-8000-000000000003';
const serverNow='2026-11-18T00:00:00.000Z';
const base={host_id:owner,description:'## 함께 만드는 실험\n참가 안내와 주최자 운영을 구분하는 가상 대회입니다.',starts_at:null,ends_at:'2027-01-28T09:00:00Z',logo_path:null,banner_path:null,is_open:true,fields:[{id:'idea',type:'text',label:'아이디어 소개',description:'가상 제출 항목',required:true,extensions:'',max_size_mb:20}],created_at:'2026-11-16T00:00:00Z',event_start_at:'2027-01-25T00:00:00Z',event_end_at:'2027-01-25T09:00:00Z',location_type:'offline',location_name:'가상 행사장',address:'가상 주소',visibility:'public',capacity:40,waitlist_enabled:true,approval_required:false,registration_open:true,registration_opens_at:null,registration_closes_at:'2027-01-24T00:00:00Z',registration_questions:[],lifecycle_status:'published',cancellation_message:'',updated_at:'2026-11-16T00:00:00Z',team_min_size:2,team_max_size:4,allow_individual_entries:true};
const contests=[{...base,id:teamId,title:'가상 주최자 워크스페이스',participation_mode:'team'},{...base,id:individualId,title:'가상 개인 참가 대회',participation_mode:'individual'},{...base,id:endedId,title:'가을 랄프톤 · 종료 검증',participation_mode:'individual',ends_at:'2026-10-18T09:00:59Z',event_start_at:null,event_end_at:null,registration_closes_at:null}];
async function fixture(context:BrowserContext,viewer:'owner'|'participant'){
 let apiWrites=0;
 await context.addInitScript(({owner,participant,viewer,contests,serverNow})=>{
 const id=viewer==='owner'?owner:participant;
 const profile={id,full_name:viewer==='owner'?'가상 주최자':'가상 참가자',student_id:'',is_admin:false,is_approved:true};
 const session={user:{id,user_metadata:{}},access_token:'synthetic-no-real-authentication',refresh_token:'synthetic-no-refresh'};
 (window as any).__contestFixtureMutations=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(value:string)=>{(window as any).__contestClipboard=value}}});
 const rejectWrite=(name:string)=>{(window as any).__contestFixtureMutations.push(name);return{data:null,error:{message:'Synthetic writes are blocked'}}};
 const read=(table:string)=>{
 const where:Record<string,unknown>={};let single=false,write:string|null=null;
 const query:any={};
 for(const method of ['select','order','limit','range','is','neq','gte','lte','in','not','abortSignal'])query[method]=()=>query;
 query.eq=(key:string,value:unknown)=>{where[key]=value;return query};
 for(const method of ['insert','update','upsert','delete'])query[method]=()=>{write=table+':'+method;return query};
 const result=()=>{
 if(write)return rejectWrite(write);
 let rows:any[]=[];
 if(table==='profiles')rows=[profile];
 if(table==='contests')rows=contests.filter(c=>!where.id||c.id===where.id);
 if(table==='contest_teams'&&where.contest_id===contests[0].id)rows=[{id:'20000000-0000-4000-8000-000000000001',contest_id:contests[0].id,name:'가상 참가 팀',captain_id:owner,kind:'formed',join_code:'TESTJOIN01',formation_status:'ready'}];
 return{data:single?rows[0]||null:rows,error:null};
 };
 query.single=query.maybeSingle=()=>{single=true;return Promise.resolve(result())};
 query.then=(yes:any,no:any)=>Promise.resolve(result()).then(yes,no);
 return query;
 };
 const channel:any={};channel.on=channel.subscribe=()=>channel;
 (window as any).__cbgpuAuthClient={from:read,channel:()=>channel,removeChannel:async()=> 'ok',rpc:(name:string,args:any)=>{
 let result:any;
 if(name==='contest_server_time')result={data:serverNow,error:null};
 else if(name==='contest_awards_api'&&args?.p_action==='state')result={data:{settings:{enabled:false,starts_at:null,closes_at:null,results_published:false},categories:[],showcases:[],my_showcases:[],my_votes:[],can_vote:false,can_manage:viewer==='owner',server_time:serverNow,results_available:false},error:null};
 else if(['cbgpu_contest_organizer_schools','cbgpu_contest_school_operators'].includes(name)&&/list|read|state|history|audit|inbox/.test(args?.p_action||''))result={data:{items:[]},error:null};
 else if(name==='get_gpu_reservation_schedule')result={data:[],error:null};
 else result=rejectWrite('rpc:'+name+':'+(args?.p_action||''));
 const query:any={then:(yes:any,no:any)=>Promise.resolve(result).then(yes,no)};query.setHeader=()=>query;return query;
 },auth:{getSession:async()=>({data:{session},error:null}),onAuthStateChange:(callback:any)=>{let active=true;queueMicrotask(()=>{if(active)callback('INITIAL_SESSION',session)});return{data:{subscription:{unsubscribe(){active=false}}}}}},storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}}),upload:async()=>rejectWrite('storage:upload'),remove:async()=>rejectWrite('storage:remove'),download:async()=>({data:null,error:{message:'No fixture files'}})})}};
 },{owner,participant,viewer,contests,serverNow});
 await context.routeWebSocket('**/*',socket=>socket.close());
 await context.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url());
 if(!['cbgpu.com','app.cbgpu.com'].includes(url.hostname))return route.abort();
 const json=(data:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 if(url.pathname==='/api/auth/shared-session')return json({value:null,state:'empty'});
 if(url.pathname==='/api/schools/memberships')return json({items:[],current_school_id:null});
 if(url.pathname==='/api/schools/resource-contexts')return json({items:[],current_school_id:null,server_time:serverNow});
 // Site telemetry is intercepted locally; it is not a contest mutation and never reaches a server.
 if(url.pathname==='/api/traffic'){assert.equal(request.method(),'POST');return route.fulfill({status:204})}
 if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/backend/')){if(!['GET','HEAD'].includes(request.method()))apiWrites++;return json({error:'Synthetic API denied'},403);}
 const headers:Record<string,string>={host:url.hostname,'x-cbgpu-public-host':url.hostname,'x-forwarded-proto':'https','accept-encoding':'identity'};
 for(const k of ['accept','content-type','rsc','next-router-state-tree','next-url','next-router-prefetch','user-agent'])if(request.headers()[k])headers[k]=request.headers()[k];
 const response=await new Promise<{status:number;headers:Record<string,string>;body:Buffer}>((resolve,reject)=>{
 const upstream=httpRequest({hostname:'127.0.0.1',port,path:url.pathname+url.search,method:'GET',headers},response=>{const chunks:Buffer[]=[];response.on('data',chunk=>chunks.push(Buffer.from(chunk)));response.on('end',()=>{const h:Record<string,string>={};for(const[k,v]of Object.entries(response.headers))if(v!==undefined&&!['content-length','transfer-encoding'].includes(k))h[k]=Array.isArray(v)?v.join(','):v;resolve({status:response.statusCode||502,headers:h,body:Buffer.concat(chunks)})});response.on('error',reject)});upstream.on('error',reject);upstream.end();
 });
 return route.fulfill(response);
 });
 return()=>apiWrites;
}
await mkdir(output,{recursive:true,mode:0o700});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const results:unknown[]=[];
try{for(const frame of ['desktop','app']as const)for(const theme of ['light','dark']as const){
 const app=frame==='app',width=app?390:1280,origin=app?'https://app.cbgpu.com':'https://cbgpu.com';
 const options={viewport:{width,height:1000},colorScheme:theme,reducedMotion:'reduce' as const,serviceWorkers:'block' as const,...(app?{userAgent:'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Version/4.0 Chrome/130.0 Mobile Safari/537.36'}:{})};
 const context=await browser.newContext(options);const ownerApiWrites=await fixture(context,'owner');
 const page=await context.newPage(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin+'/contests/'+teamId+'/manage',{waitUntil:'domcontentloaded'});
 await page.locator('[data-contest-management]').waitFor({timeout:15000}).catch(async()=>{await page.screenshot({path:output+'/failure-before-management.png'});throw Error('Synthetic Next management not mounted: '+JSON.stringify({body:await page.locator('body').innerText(),errors}))});
 const nav=page.getByRole('navigation',{name:'대회 관리 항목'});
 for(const label of ['운영 현황','참가자','팀','제출물','심사·투표','세부 일정','공지','소개·배너','신청·장소','운영진','보관·복제']){
 const button=nav.getByRole('button',{name:label,exact:true});await button.click();assert.equal(await button.getAttribute('aria-pressed'),'true');
 if(label==='팀'){await page.getByRole('button',{name:'팀 초대 링크 복사',exact:true}).click();const invitation=new URL(await page.evaluate(()=>(window as any).__contestClipboard));assert.equal(invitation.origin,origin);assert.equal(invitation.pathname,'/contests/'+teamId);assert.equal(invitation.search,'?team=TESTJOIN01');assert.equal(invitation.hash,'');}

 assert.equal(await page.locator('.contest-management-section-heading h2').textContent(),label);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'management overflow '+label);
 assert.equal(await page.locator('#answer-idea').count(),0,'participant submission mounted in management '+label);
 }
 await nav.getByRole('button',{name:'운영 현황',exact:true}).click();
 await page.getByRole('heading',{name:'가상 주최자 워크스페이스',exact:true}).waitFor({timeout:15000});
 assert.equal(await page.locator('#answer-idea').count(),0,'management must not mount participant submission');
 await page.screenshot({path:output+'/manage-'+frame+'-'+theme+'.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.goto(origin+'/contests/'+teamId,{waitUntil:'domcontentloaded'});
 await page.getByRole('heading',{name:'가상 주최자 워크스페이스',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:/소개와 배너 저장|팀 설정 저장|투표 설정 저장/}).count(),0,'normal owner preview must not show editing controls');
 assert.equal(await page.locator('.contest-management-nav').count(),0);await page.locator('#answer-idea').waitFor();assert.equal(await page.locator('#answer-idea').isDisabled(),true);
 for(const button of await page.locator('form button').all())if(await button.evaluate(node=>(node as HTMLButtonElement).type==='submit'))assert.equal(await button.isEnabled(),false,'preview submit must be disabled');
 // Keyboard submission on the preview form must not invoke any mutation.
 await page.keyboard.press('Control+Enter');
 await page.locator('[data-contest-participant] form').evaluateAll(forms=>forms.forEach(form=>(form as HTMLFormElement).requestSubmit()));

 await page.screenshot({path:output+'/preview-'+frame+'-'+theme+'.png',fullPage:true});
 assert.deepEqual(await page.evaluate(()=>(window as any).__contestFixtureMutations),[]);
 assert.deepEqual(errors,[]);assert.equal(ownerApiWrites(),0);await context.close();
 const participantContext=await browser.newContext(options);const participantApiWrites=await fixture(participantContext,'participant');
 const participantPage=await participantContext.newPage(),participantErrors:string[]=[];participantPage.on('pageerror',error=>participantErrors.push(error.message));
 await participantPage.goto(origin+'/contests/'+individualId,{waitUntil:'domcontentloaded'});
 await participantPage.getByRole('heading',{name:'가상 개인 참가 대회',exact:true}).waitFor({timeout:15000});
 // Participant submission and registration remain real product components.
 await participantPage.locator('#answer-idea').waitFor();
 await participantPage.getByLabel('참가자 이름',{exact:true}).waitFor();
 await participantPage.getByRole('button',{name:'작품 제출하기',exact:true}).waitFor();assert.equal(await participantPage.getByRole('button',{name:'작품 제출하기',exact:true}).isEnabled(),true);assert.equal(await participantPage.getByRole('button',{name:'참가 신청하기',exact:true}).isEnabled(),true);
 assert.equal(await participantPage.getByRole('button',{name:/소개와 배너 저장|팀 설정 저장|투표 설정 저장/}).count(),0);
 await participantPage.goto(origin+'/contests/'+teamId+'/manage',{waitUntil:'domcontentloaded'});
 await participantPage.getByRole('heading',{name:'대회 운영진만 관리할 수 있어요',exact:true}).waitFor({timeout:15000});assert.equal(await participantPage.locator('[data-contest-management]').count(),0);
 assert.equal(await participantPage.getByRole('button',{name:/소개와 배너 저장|팀 설정 저장|투표 설정 저장/}).count(),0);
 await participantPage.goto(origin+'/contests/'+endedId,{waitUntil:'domcontentloaded'});
 await participantPage.getByRole('heading',{name:'가을 랄프톤 · 종료 검증',exact:true}).waitFor({timeout:15000});
 await participantPage.locator('.contest-event-state[data-phase="ended"]').waitFor();assert.equal(await participantPage.locator('.contest-event-state[data-phase="ended"]').textContent(),'대회 종료');await participantPage.getByRole('button',{name:'제출이 마감되었어요',exact:true}).waitFor();assert.equal(await participantPage.getByRole('button',{name:'제출이 마감되었어요',exact:true}).isDisabled(),true);
 assert.equal(await participantPage.getByText('참가 신청을 받고 있어요.',{exact:true}).count(),0);
 for(const button of await participantPage.getByRole('button',{name:/참가 신청하기|참가 신청 완료|작품 제출하기/}).all())assert.equal(await button.isEnabled(),false);
 assert.ok(await participantPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(await participantPage.evaluate(()=>(window as any).__contestFixtureMutations),[]);
 await participantPage.screenshot({path:output+'/ended-'+frame+'-'+theme+'.png',fullPage:true});
 results.push({frame,theme,teamInvitationTargetsParticipant:true,ownerManagementSeparate:true,ownerPreviewReadOnly:true,participantFormsPreserved:true,unauthorizedManageBlocked:true,staleOpenEndedContestClosed:true,realMutations:0});
 assert.deepEqual(participantErrors,[]);assert.equal(participantApiWrites(),0);await participantContext.close();
 }
 await writeFile(output+'/PASSED.json',JSON.stringify({realApiRequests:0,syntheticIdentitiesOnly:true,results},null,2));console.log(JSON.stringify(results));
}finally{await browser.close()}
