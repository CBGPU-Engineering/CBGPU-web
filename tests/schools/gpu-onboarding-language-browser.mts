/** Real school GPU controls and app chrome, synthetic accounts/requests only. */
import assert from'node:assert/strict';
import fs from'node:fs/promises';
import path from'node:path';
import{build}from'esbuild';
import postcss from'postcss';
import tailwind from'@tailwindcss/postcss';
import{chromium}from'playwright';
const origin='https://admin.cbgpu.com',nodeId='11111111-1111-4111-8111-111111111111',token='gpuenr_'+'a'.repeat(64);
const image='quay.io/jupyter/pytorch-notebook@sha256:83066a1f1108f35cfea7b0f93ae24bb70d6e55c8eeff82b4f9a86dae4496f77b';
const compiled=await build({stdin:{contents:`import React from'react';import{createRoot}from'react-dom/client';import Frame from'./src/components/admin/AppAdminFrame';import Gpu from'./src/components/schools/SchoolGpuOnboarding';import'./src/components/admin/developer-shell.css';const app=new URL(location.href).searchParams.get('from')==='app';createRoot(document.getElementById('root')).render(app?<Frame><Gpu schoolId="school-a"/></Frame>:<div className="admin-developer-shell"><Gpu schoolId="school-a"/></div>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outfile:'fixture.js',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1':'"1"','process.env':'{}'},plugins:[{name:'synthetic-boundaries',setup(b){
 b.onResolve({filter:/^(next\/link|next\/navigation|next\/image|next-themes)$|\/(useAuth|schoolsClient|supabase|alert)$/},a=>({path:a.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'jsx',resolveDir:process.cwd(),contents:a.path==='next/link'?`import React from'react';export default function Link({children,href,...props}){return <a {...props} href={href}>{children}</a>}`:a.path==='next/image'?`import React from'react';export default function Image({alt,width,height}){return <span aria-label={alt} style={{display:'inline-block',width,height}}/>}`:a.path==='next/navigation'?`export const usePathname=()=>'/admin/schools/school-a/manage';export const useSearchParams=()=>new URLSearchParams('section=gpu');export const useRouter=()=>({push:()=>{}});`:a.path==='next-themes'?`export const useTheme=()=>({resolvedTheme:document.documentElement.classList.contains('dark')?'dark':'light',setTheme:()=>{}});`:a.path.endsWith('useAuth')?`export const useAuth=()=>({user:{id:'synthetic-platform'},profile:{full_name:'합성 관리자'},isAdmin:true,isLoading:false,roleSites:[{id:'admin',label:'관리',host:'admin.cbgpu.com',path:'/admin'}]});`:a.path.endsWith('supabase')?`export const supabase={auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-platform'},access_token:'synthetic-token'}}}),signOut:async()=>({})}};`:a.path.endsWith('alert')?`export const useAlert=()=>({showError:()=>{},showSuccess:()=>{}});`:`export const multiSchoolEnabled=true;export const selectAccountSchool=()=>{throw Error('Account preference write forbidden')};export class SchoolsApiError extends Error{};export async function schoolsRequest(path){const response=await fetch('/api/schools/'+path);if(!response.ok)throw Error('School request rejected');return response.json()}`}));
 }}]});
const globalCss=(await postcss([tailwind()]).process(await fs.readFile('src/app/globals.css','utf8'),{from:path.resolve('src/app/globals.css')})).css;
const js=compiled.outputFiles.find(f=>f.path.endsWith('.js'))!.text,css=globalCss+'\n'+compiled.outputFiles.filter(f=>f.path.endsWith('.css')).map(f=>f.text).join('\n');
const screenshots=process.env.CBGPU_GPU_SCREENSHOT_DIR||'/tmp/cbgpu-gpu-onboarding-language-screens';await fs.mkdir(screenshots,{recursive:true,mode:0o700});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});const errors:string[]=[];let outside=0;
try{
 for(const app of[false,true])for(const theme of['light','dark']){
  const width=app?390:1280,context=await browser.newContext({viewport:{width,height:900},colorScheme:theme as'light'|'dark',reducedMotion:'reduce',serviceWorkers:'block',acceptDownloads:true,...(app?{userAgent:'Mozilla/5.0 (Linux; Android 14; Synthetic; wv) AppleWebKit/537.36 CBGPU NativeAndroid'}:{})});
  const page=await context.newPage();let mints=0,revokes=0;let nodes:Record<string,unknown>[]=[];
  await page.addInitScript(theme=>{document.addEventListener('DOMContentLoaded',()=>{document.documentElement.classList.toggle('dark',theme==='dark');document.documentElement.dataset.theme=theme});Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{}}})},theme);
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());if(url.origin!==origin){outside++;return route.abort()}
   if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<style>body{margin:0;padding:16px}'+css+'</style><main id="root"></main><script src="/fixture.js"></script>'});
   if(url.pathname==='/fixture.js')return route.fulfill({contentType:'application/javascript',body:js});
   if(url.pathname.startsWith('/brand/'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg"/>'});
   if(url.pathname==='/api/schools/schools/school-a')return route.fulfill({json:{school:{id:'school-a',display_name:'합성 학교',official_name:'Synthetic school',status:'APPROVED',features:['gpu_compute'],region:'Synthetic',type:'HIGH_SCHOOL'}}});
   if(url.pathname==='/api/compute/capabilities')return route.fulfill({json:{enabled:true,mode:'NOTEBOOKS_AVAILABLE',control_plane_url:'https://cbgpu.com',artifacts:[{platform:'linux-x86_64',url:'https://cbgpu.com/downloads/verified-cbgpu-node',sha256:'b'.repeat(64),filename:'cbgpu-node'}],supported_os:['Ubuntu'],execution_ready:false,sharing_enabled:false}});
   if(url.pathname.endsWith('/gpu/nodes'))return route.fulfill({json:{items:nodes}});
   if(url.pathname.endsWith('/gpu/enrollments')&&request.method()==='POST'){
    assert.equal(request.headers().authorization,'Bearer synthetic-token');assert.deepEqual(request.postDataJSON(),{name:'Synthetic server'});mints++;nodes=[{id:nodeId,school_id:'school-a',name:'Synthetic server',status:'PENDING',sharing_enabled:false,last_seen_at:null,created_at:new Date().toISOString()}];
    return route.fulfill({json:{node_id:nodeId,school_id:'school-a',token,expires_at:new Date(Date.now()+600000).toISOString(),sharing_enabled:false,notebook_trust:{protocol:3,server_public_key:'c'.repeat(64),approved_image_digest:image}}});
   }
   if(url.pathname.endsWith('/'+nodeId+'/revoke')&&request.method()==='POST'){revokes++;nodes=nodes.map(n=>({...n,status:'REVOKED'}));return route.fulfill({json:{ok:true}})}
   throw Error('Unexpected synthetic request '+url.pathname);
  });
  await page.goto(origin+'/?'+(app?'from=app':''),{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:app?'GPU 서버':'GPU servers',exact:true}).waitFor();
  await page.getByRole('button',{name:app?'서버 추가':'Add server',exact:true}).waitFor();
  const body=await page.locator('body').innerText();assert.ok(body.includes(app?'서버 실행 검사 필요':'server execution checks required'));assert.ok(!body.includes('resource approval'));
  if(app){assert.ok(!body.includes('Connect a supported server'));await page.getByRole('navigation',{name:'관리 메뉴'}).waitFor()}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:path.join(screenshots,`${app?'app-390':'desktop-1280'}-${theme}.png`),fullPage:true});
  await page.getByRole('button',{name:app?'서버 추가':'Add server',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();
  await dialog.getByRole('textbox',{name:app?'서버 이름':'Server name',exact:true}).fill('Synthetic server');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:app?'등록 파일 발급':'Create private enrollment',exact:true}).click();
  await page.getByRole('button',{name:app?'등록 파일 받기':'Download enrollment file',exact:true}).waitFor();assert.equal(mints,1);
  await page.getByRole('textbox',{name:app?'GPU 서버의 등록 파일 경로':'Private file path on GPU server',exact:true}).fill('/home/fixture/enrollment.json');
  await page.getByRole('checkbox').check();await page.getByRole('textbox',{name:app?'GPU 서버의 실행 정책 경로':'Notebook policy file path on GPU server',exact:true}).fill('/home/fixture/notebook-policy.json');
  const command=await page.locator('pre[aria-label="'+(app?'GPU 설치 명령':'GPU setup command')+'"]').innerText();assert.ok(command.includes('sha256sum --check -'));assert.ok(command.includes('--notebooks'));assert.ok(!command.includes(token));
  assert.ok(!(await page.locator('body').innerText()).includes(token));assert.equal(await page.evaluate(t=>JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage),document.cookie]).includes(t),token),false);
  await page.locator('.cb-gpu-node-card').getByRole('button',{name:app?'연결 해제':'Revoke',exact:true}).click();const revoke=page.getByRole('dialog');
  await revoke.getByRole('heading',{name:app?'서버 연결을 해제할까요?':'Revoke this server?',exact:true}).waitFor();assert.ok((await revoke.innerText()).includes(app?'Jupyter 접속도 중단':'Managed notebook access will stop'));
  await page.screenshot({path:path.join(screenshots,`${app?'app-390':'desktop-1280'}-${theme}-revoke.png`),fullPage:true});
  await revoke.getByRole('button',{name:app?'연결 해제':'Confirm revocation',exact:true}).click();await page.getByText(app?'연결 해제됨':'Revoked',{exact:true}).waitFor();assert.equal(revokes,1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await context.close();
 }
 assert.equal(outside,0);assert.deepEqual(errors,[]);console.log(JSON.stringify({gpuOnboardingLocales:true,desktopEnglish:true,nativeAppKorean:true,realAppFrame:true,themes:['light','dark'],widths:[390,1280],explicitEnrollmentAndNotebookOptIn:true,noTokenDOMStorageOrCommand:true,executionChecksWording:true,revocationConsequences:true,screenshots,noHardwareOrSchoolWrites:true,errors:0}));
}finally{await browser.close()}
