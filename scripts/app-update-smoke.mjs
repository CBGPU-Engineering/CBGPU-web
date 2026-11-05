import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),p=require('puppeteer-core'),playwright=require('playwright');
const c=process.env.CHROME_BIN==='sparticuz'?require('@sparticuz/chromium').default:null;
let browser;
try{
 for(const mode of ['older','current','newer','legacy','browser']){
  browser=await p.launch({executablePath:c?await c.executablePath():process.env.CHROME_BIN||playwright.chromium.executablePath(),args:c?c.args:['--no-sandbox'],headless:true});
  const page=await browser.newPage();await page.setViewport({width:360,height:640,isMobile:true,hasTouch:true});
  await page.evaluateOnNewDocument(mode=>{
   if(mode==='browser')return;
   const bridge={isNative:true,platform:'android',getPersistedSession:async()=>({session:null}),syncSession:async()=>({ok:true}),clearSession:async()=>({ok:true})};
   if(mode!=='legacy')bridge.getAppInfo=async()=>({version:'1.0.8',buildNumber:mode==='older'?8:mode==='newer'?10:9,platform:'android'});
   window.CBGPUNative=bridge;
  },mode);
  await page.setRequestInterception(true);page.on('request',r=>{if(new URL(r.url()).pathname==='/api/app-release')return r.respond({status:200,contentType:'application/json',body:JSON.stringify({version:'1.0.8',buildNumber:9,notes:'업데이트 안내 테스트'})});return r.continue()});
  await page.goto('http://localhost:3100/',{waitUntil:'networkidle2'});
  const selector='[role=dialog]';
  if(mode==='older'||mode==='legacy'){
   await page.waitForSelector(selector);assert.ok(await page.$eval(selector,e=>e.textContent.includes('새로운 CBGPU 앱')));
   const bounds=await page.$eval(selector,e=>{const b=e.getBoundingClientRect();return {top:b.top,bottom:b.bottom,width:b.width}});assert.ok(bounds.top>=0&&bounds.bottom<=640&&bounds.width<=360);
   assert.equal(await page.$eval(selector+' a',e=>e.getAttribute('href')),'/downloads/cbgpu.apk?build=9');
   await page.evaluate(()=>[...document.querySelectorAll('[role=dialog] button')].find(b=>b.textContent==='나중에').click());await page.reload({waitUntil:'networkidle2'});assert.equal(await page.$(selector),null,'Dismissal must survive reload');
  }else assert.equal(await page.$(selector),null,mode+' must not receive update prompts');
  await browser.close();browser=null;
 }
 console.log('PASS update notice: older and legacy Android, current/newer suppression, ordinary browsers, 24-hour snooze and 360x640 bounds.');
}finally{if(browser)await browser.close()}
