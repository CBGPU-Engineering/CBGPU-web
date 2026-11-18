/** Actual admin UI through a local production preview. Synthetic identities only; every API is mocked. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {request as httpRequest} from 'node:http';
const port=Number(process.env.CBGPU_ADMIN_PREVIEW_PORT||13961),output=process.env.CBGPU_ADMIN_PROOF_DIR||'artifacts/admin-school-labels';
const owner='00000000-0000-4000-8000-000000000101',sessionId='00000000-0000-4000-8000-000000000102';
// Not signed or accepted by any real service. Used solely by the isolated portal-session fixture.
const token='fixture.'+Buffer.from(JSON.stringify({sub:owner,session_id:sessionId})).toString('base64url')+'.not-a-signature';
const schools={a:'가람과학고등학교',b:'나래고등학교'};
const common={is_admin:false,is_approved:true,is_laser_cut_manager:false,is_wakeup_manager:false};
const affiliation=(id:string,type='STUDENT',verified=true)=>({school_id:id,school_name:schools[id as 'a'|'b'],status:verified?'ACTIVE':'PENDING_VERIFICATION',membership_type:type,student_number:type==='STUDENT'?'1101':null,verified});
const profiles=[
 {...common,id:'fixture-a',full_name:'A-only Student',student_id:'1101',email:'a@example.invalid',school_id:'a',primary_school_name:schools.a,school_affiliations:[]},
 {...common,id:'fixture-b',full_name:'B-only Teacher',student_id:null,email:'b@example.invalid',school_id:'b',primary_school_name:schools.b,school_affiliations:[affiliation('b','TEACHER')]},
 {...common,id:'fixture-dual',full_name:'Dual-school Researcher',student_id:'1102',email:'dual@example.invalid',school_id:'a',primary_school_name:schools.a,school_affiliations:[affiliation('a'),affiliation('b','EXTERNAL',false)]},
 {...common,id:'fixture-none',full_name:'No affiliation',student_id:null,email:'none@example.invalid',school_id:null,primary_school_name:null,school_affiliations:[]},
 {...common,id:'fixture-orphan',full_name:'Unavailable school',student_id:null,email:'orphan@example.invalid',school_id:'missing-school',primary_school_name:null,school_affiliations:[]},
];
await mkdir(output,{recursive:true,mode:0o700});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const results:unknown[]=[];
try{for(const frame of ['desktop','app'] as const)for(const theme of ['light','dark'] as const){
 const app=frame==='app',width=app?390:1280,origin='https://admin.cbgpu.com';
 const context=await browser.newContext({viewport:{width,height:1000},colorScheme:theme,reducedMotion:'reduce',serviceWorkers:'block',...(app?{userAgent:'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Version/4.0 Chrome/130.0 Mobile Safari/537.36'}:{})});
 await context.addInitScript(({owner,token})=>{
  const admin={id:owner,full_name:'Synthetic administrator',is_admin:true,is_approved:true};
  const session={user:{id:owner},access_token:token,refresh_token:'synthetic-only-refresh'};
  const read=(table:string)=>{const query:any={};for(const m of ['select','eq','neq','in','is','order','limit','range','gte','lte'])query[m]=()=>query;query.then=(yes:any,no:any)=>Promise.resolve({data:[],error:null}).then(yes,no);query.single=query.maybeSingle=async()=>({data:table==='profiles'?admin:null,error:null});return query};
  const channel:any={};channel.on=channel.subscribe=()=>channel;
  (window as any).__cbgpuAuthClient={from:read,channel:()=>channel,removeChannel:async()=> 'ok',auth:{getSession:async()=>({data:{session},error:null}),onAuthStateChange:(callback:any)=>{let active=true;queueMicrotask(()=>{if(active)callback('INITIAL_SESSION',session)});return{data:{subscription:{unsubscribe(){active=false}}}}}}};
 },{owner,token});
 await context.routeWebSocket('**/*',socket=>socket.close());
 let mutationAttempts=0;const page=await context.newPage(),errors:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 await context.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url());
 if(url.origin!==origin)return route.abort();
 const json=(value:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
 if(url.pathname==='/portal/session')return json({user_id:owner,auth_session_id:sessionId,csrf_token:'synthetic-only-csrf',session:{access_token:token,refresh_token:'synthetic-only-refresh'}});
 if(url.pathname==='/portal/session/tokens')return json({ok:true});
 if(url.pathname==='/api/admin/profiles'&&request.method()==='GET')return json({profiles});
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
 await page.goto(origin+'/admin/accounts'+(app?'?from=app':''),{waitUntil:'domcontentloaded'});
 const filter=page.getByRole('combobox',{name:'Filter accounts by school'});await filter.waitFor({timeout:10000}).catch(async error=>{console.log(JSON.stringify({errors,body:await page.locator('body').innerText()}));throw error});
 const visibleNames=async()=>{const names:string[]=[];for(const p of profiles)if(await page.getByText(p.full_name,{exact:true}).filter({visible:true}).count())names.push(p.full_name);return names};
 await page.getByText('A-only Student',{exact:true}).filter({visible:true}).waitFor();
 assert.deepEqual(await visibleNames(),profiles.map(p=>p.full_name));
 if(app){assert.ok(await page.getByText('School',{exact:true}).filter({visible:true}).count()>=profiles.length);assert.equal(await page.locator('.cb-app').count(),1)}else{assert.ok(await page.getByRole('columnheader',{name:'School',exact:true}).isVisible());assert.equal(await page.locator('.cb-app').count(),0)}
 const schoolParagraphs=await page.locator('ul[aria-label="School affiliations"] p').filter({visible:true}).evaluateAll(nodes=>nodes.map(node=>({text:node.textContent,whiteSpace:getComputedStyle(node).whiteSpace,scrollWidth:node.scrollWidth,clientWidth:node.clientWidth})));
 assert.ok(schoolParagraphs.length>0);
 for(const paragraph of schoolParagraphs){assert.equal(paragraph.whiteSpace,'normal',paragraph.text||'school paragraph');assert.ok(paragraph.scrollWidth<=paragraph.clientWidth+1,'School text clipped: '+JSON.stringify(paragraph));}
 if(!app){const actions=await page.getByRole('button',{name:'A-only Student Delete',exact:true}).filter({visible:true}).evaluate(node=>{const container=node.closest('[data-slot="table-container"]')!;return{right:node.getBoundingClientRect().right,containerRight:container.getBoundingClientRect().right,scrollWidth:container.scrollWidth,clientWidth:container.clientWidth}});assert.ok(actions.right<=actions.containerRight+1,'Account actions clipped: '+JSON.stringify(actions));}

 await page.screenshot({path:output+'/'+frame+'-'+theme+'.png',fullPage:true});
 const choose=async(name:string)=>{await filter.click();await page.getByRole('option',{name,exact:true}).click()};
 await choose(schools.a);assert.deepEqual(await visibleNames(),['A-only Student','Dual-school Researcher']);
 await choose(schools.b);assert.deepEqual(await visibleNames(),['B-only Teacher','Dual-school Researcher']);
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();assert.deepEqual(await visibleNames(),profiles.map(p=>p.full_name));
 const search=page.getByRole('searchbox',{name:'Search current list'});await search.fill(schools.b);
 await page.waitForFunction(()=>!document.body.innerText.includes('A-only Student'));assert.deepEqual(await visibleNames(),['B-only Teacher','Dual-school Researcher']);
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();
 await choose('No school affiliation');assert.deepEqual(await visibleNames(),['No affiliation']);
 await choose('School information unavailable');assert.deepEqual(await visibleNames(),['Unavailable school']);
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();assert.deepEqual(await visibleNames(),profiles.map(p=>p.full_name));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);assert.equal(mutationAttempts,0);
 results.push({frame,theme,viewport:width,schoolColumnOrCards:true,primaryFallbackVisible:true,multiSchoolFilters:true,schoolNameSearch:true,orphanDistinctFromUnaffiliated:true,clearRestores:true,schoolParagraphsNotClipped:true,pageErrors:errors,mutationAttempts});
 await context.close();
 }
 await writeFile(output+'/PASSED.json',JSON.stringify({syntheticProfilesOnly:true,realApiRequests:0,results},null,2),{mode:0o600});console.log(JSON.stringify(results));
}finally{await browser.close()}
