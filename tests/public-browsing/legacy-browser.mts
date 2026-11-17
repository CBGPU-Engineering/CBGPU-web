/** Flags-off compatibility smoke: only local synthetic Auth/data upstreams. */
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {demoEnvironment} from '../../demo/environment.mts';
const {createDemoServer}=createRequire(import.meta.url)('../../demo/server.cts');
const api=createDemoServer();api.listen(0,'127.0.0.1');await once(api,'listening');
const port=3219,origin='http://localhost:'+port;
const env={...demoEnvironment({CBGPU_DEMO_PORT:String(port),CBGPU_DEMO_API_PORT:String(api.address().port),CBGPU_DEMO_BUILD_DIR:'.next-public-off'}),NEXT_PUBLIC_CBGPU_MULTISCHOOL_V1:'0',CBGPU_MULTISCHOOL_V1:'0',NEXT_PUBLIC_CBGPU_PUBLIC_BROWSING_V1:'0',CBGPU_PUBLIC_BROWSING_V1:'0'};
const next=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env,stdio:['ignore','pipe','pipe']});let log='',browser:any;next.stdout.on('data',b=>log+=b.toString());next.stderr.on('data',b=>log+=b.toString());
try {
 await new Promise<void>((resolve,reject)=>{const start=Date.now(),timer=setInterval(()=>{if(log.includes('Ready in')){clearInterval(timer);resolve()}else if(next.exitCode!==null||Date.now()-start>20000){clearInterval(timer);reject(Error(log||'Next startup timeout'))}},50)});
 assert.ok((await fetch(origin+'/api/public/projects')).status>=400);
 browser=await chromium.launch({headless:true,executablePath:process.env.CBGPU_CHROMIUM||'/tmp/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:390,height:844}});await context.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());const page=await context.newPage();
 await page.goto(origin+'/auth/signup',{waitUntil:'networkidle'});await page.getByLabel('학번',{exact:false}).waitFor();assert.equal(await page.getByText('학교 없이 개인 계정으로 시작',{exact:false}).count(),0);
 await page.goto(origin+'/auth/login',{waitUntil:'networkidle'});await page.getByLabel('이메일',{exact:true}).fill('researcher@example.invalid');await page.getByLabel('비밀번호',{exact:true}).fill('demo-only');await page.getByRole('button',{name:'로그인하기',exact:true}).click();await page.waitForURL(url=>url.pathname==='/'||url.pathname==='/workspace');await page.getByText('학교에서 배우고, 함께 만드는 곳',{exact:false}).waitFor({state:'hidden'});
 console.log(JSON.stringify({flagsOff:true,legacyStudentSignup:true,legacyLogin:true,publicApiUnavailable:true}));
} finally {if(browser)await browser.close();next.kill('SIGTERM');api.close()}
