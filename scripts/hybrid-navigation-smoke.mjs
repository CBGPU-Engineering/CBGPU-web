// Browser contract: all app.cbgpu.com requests are intercepted into the local synthetic demo.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const puppeteer=require('puppeteer-core'),m=require('@sparticuz/chromium'),c=m.default||m;
const base=process.env.DEMO_BASE||'http://localhost:3100';assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Synthetic local demo only');
const browser=await puppeteer.launch({executablePath:await c.executablePath(),args:c.args,headless:true});
try{
 for(const capability of [false,true]){
  const page=await browser.newPage();await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});await page.setBypassCSP(true);await page.setRequestInterception(true);
  page.on('request',async r=>{try{
   const url=new URL(r.url());if(!['app.cbgpu.com','localhost'].includes(url.hostname))return r.abort();
   const headers={'access-control-allow-origin':'https://app.cbgpu.com','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,DELETE,PATCH,OPTIONS'};
   if(r.method()==='OPTIONS')return r.respond({status:204,headers});
   const response=await fetch(base+url.pathname+url.search,{method:r.method(),headers:r.headers(),body:['GET','HEAD'].includes(r.method())?undefined:r.postData()});
   const responseHeaders=Object.fromEntries(response.headers);delete responseHeaders['content-encoding'];delete responseHeaders['content-length'];
   await r.respond({status:response.status,headers:{...responseHeaders,...headers},body:Buffer.from(await response.arrayBuffer())});
  }catch{await r.abort()}});
  await page.evaluateOnNewDocument(capability=>{
   window.__documentIdentity=Math.random();window.__nativeCalls=[];
   window.CBGPUNative={isNative:true,platform:'android',getPersistedSession:async()=>({session:null}),getAppInfo:async()=>({version:'1.0.9',buildNumber:10,platform:'android'}),clearSession:async()=>({ok:true}),syncSession:async()=>({ok:true}),listAlarms:async()=>[],requestNotificationPermission:async()=>({granted:false})};
   if(capability)window.CBGPUNative.setNavigation=async value=>{window.__nativeCalls.push(value);return{ok:true}};
  },capability);
  await page.goto('https://app.cbgpu.com/services',{waitUntil:'networkidle2'});
  await page.waitForSelector('.cb-app .cb-bottom-nav');
  if(!capability){assert.equal(await page.$eval('.cb-bottom-nav',e=>getComputedStyle(e).display==='none'),false);console.log('Legacy APK retains web navigation.');await page.close();continue;}
  await page.waitForFunction(()=>document.documentElement.dataset.cbgpuNativeNavigation==='true');
  assert.equal(await page.$eval('.cb-bottom-nav',e=>getComputedStyle(e).display),'none');
  const before=await page.evaluate(()=>window.__documentIdentity);
  const config=await page.evaluate(()=>window.__nativeCalls.findLast(c=>c.visible));
  assert.equal(config.tabs.length,5);assert(config.tabs.every(t=>t.svg.includes('<svg')));assert(config.tabs.every(t=>t.path.startsWith('/')));assert(config.tabs.some(t=>t.label==='전체 기능'));
  await page.evaluate(()=>window.__cbgpuNativeNavigate('/profile'));
  await page.waitForFunction(()=>location.pathname==='/profile');await new Promise(r=>setTimeout(r,600));assert.equal(await page.evaluate(()=>window.__documentIdentity),before,'Native tab must not reload document');
  await page.evaluate(()=>window.__cbgpuNativeNavigate('/?mode=student'));
  await page.waitForFunction(()=>location.pathname==='/');await new Promise(r=>setTimeout(r,600));assert.equal(await page.evaluate(()=>window.__documentIdentity),before,'Home tab must not reload document');
  await page.waitForFunction(()=>window.__nativeCalls.findLast(c=>c.visible)?.selected===0);
  await page.evaluate(()=>{const modal=document.createElement('div');modal.id='hybrid-test-dialog';modal.setAttribute('role','dialog');modal.setAttribute('data-state','open');document.body.append(modal)});
  await page.waitForFunction(()=>window.__nativeCalls.at(-1)?.visible===false);
  await page.evaluate(()=>document.getElementById('hybrid-test-dialog').remove());await page.waitForFunction(()=>window.__nativeCalls.at(-1)?.visible===true);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  console.log('Native capability delivers existing design, moves profile/home without reload, updates active tab and hides controls for dialogs.');
  await page.close();
 }
}finally{await browser.close()}
