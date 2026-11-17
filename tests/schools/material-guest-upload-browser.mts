/** Synthetic guest upload flow; never contacts operating storage or metadata. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const origin=process.env.CBGPU_MATERIAL_TEST_ORIGIN||'http://localhost:13841';
assert.match(origin,/^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const browser=await chromium.launch({headless:true,executablePath:process.env.CBGPU_CHROMIUM||'/tmp/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
 const session=await fetch(origin+'/backend/auth/v1/token?grant_type=password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'researcher@example.invalid',password:'demo-only'})}).then(r=>r.json());
 await context.addInitScript(value=>localStorage.setItem('sb-localhost-auth-token',JSON.stringify(value)),session);
 await page.route('**/api/auth/shared-session',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({state:'active',value:JSON.stringify(session)})}));
 const school={id:'fixture-b',official_name:'Synthetic Guest School',display_name:'Synthetic Guest School',type:'HIGH_SCHOOL',region:'Test',features:['materials']};
 const lease=new Date(Date.now()+3600000).toISOString();
 await page.route('**/api/schools/**',r=>{const path=new URL(r.request().url()).pathname;const value=path.endsWith('/resource-contexts')?{items:[{school_id:school.id,school,type:'GUEST',resources:['school_storage'],expires_at:lease,can_administer:false}],current_school_id:school.id,server_time:new Date().toISOString()}:path.endsWith('/resource-access')?{school_id:school.id,legacy_cbsh_access:false,context_type:'GUEST',expires_at:lease,server_time:new Date().toISOString(),resources:{gpu:false,study:false,school_storage:true,fabrication:false,school_compute:false,contests:false,ai:false},reasons:{school_storage:'ALLOWED'}}:{items:[],current_school_id:null};return r.fulfill({contentType:'application/json',body:JSON.stringify(value)})});
 const attempts:Record<string,unknown>[]=[];let chunks=0,deletes=0,directWrites=0;
 await page.route('**/backend/rest/v1/shared_materials**',r=>{if(r.request().method()!=='GET')directWrites++;return r.fulfill({contentType:'application/json',body:'[]'})});
 await page.route('**/api/files/**',r=>{const req=r.request(),path=new URL(req.url()).pathname;
  if(req.method()==='DELETE'){deletes++;return r.fulfill({body:'{}'})}
  if(path.endsWith('/quota'))return r.fulfill({contentType:'application/json',body:JSON.stringify({remaining_bytes:100000})});
  if(req.method()==='POST') {assert.equal(req.headers()['x-cbgpu-school-id'],'fixture-b');const body=req.postDataJSON();assert.equal(body.uploader_id,undefined);assert.equal(body.access_scope,undefined);attempts.push(body);return r.fulfill({status:attempts.length===1?403:201,contentType:'application/json',body:JSON.stringify(attempts.length===1?{detail:'Temporary access expired; retry after renewal'}:{id:body.upload_id,school_id:'fixture-b',access_scope:'SCHOOL',status:'pending'})})}
  if(path.endsWith('/upload'))return r.fulfill({contentType:'application/json',body:JSON.stringify({offset:0,size_bytes:6,complete:false})});
  if(req.method()==='PUT'){chunks++;return r.fulfill({contentType:'application/json',body:JSON.stringify({offset:6,size_bytes:6,complete:true})})}
  return r.fulfill({status:404,body:'{}'});
 });
 await page.goto(origin+'/materials/new',{waitUntil:'domcontentloaded'});
 await page.getByText('Synthetic Guest School · 교내 자료 공유',{exact:true}).waitFor({timeout:12000}).catch(async error=>{console.error((await page.locator('body').innerText()).slice(-3500));throw error});
 await page.locator('#material-title').fill('Synthetic guest upload');
 await page.locator('input[type=file]').setInputFiles({name:'fixture.txt',mimeType:'text/plain',buffer:Buffer.from('abcdef')});
 const submit=page.getByRole('button',{name:'자료 공유하기',exact:true});await submit.click();
 await page.getByText('Temporary access expired; retry after renewal',{exact:true}).waitFor();
 assert.equal(chunks,0);assert.equal(deletes,0);assert.equal(await page.locator('#material-title').inputValue(),'Synthetic guest upload');
 await page.getByRole('button',{name:'확인',exact:true}).click().catch(()=>{});
 await submit.click();await page.waitForURL('**/materials');
 assert.equal(attempts.length,2);assert.equal(attempts[0].upload_id,attempts[1].upload_id);assert.equal(chunks,1);assert.equal(deletes,0);assert.equal(directWrites,0);
 console.log(JSON.stringify({guestContext:true,serverDenialPreservesDraft:true,idempotentRetry:true,nativeScopeHeader:true,noDirectMetadataWrite:true,confirmedUpload:true}));
}finally{await browser.close()}
