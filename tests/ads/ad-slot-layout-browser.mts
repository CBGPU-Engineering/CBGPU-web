/** Real ad component + real CSS, only synthetic SDK. No provider requests or impressions. */
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const repo=fileURLToPath(new URL('../../',import.meta.url)),origin='https://cbgpu.com',sdk='https://t1.kakaocdn.net/kas/static/ba.min.js';
const bundled=await build({stdin:{contents:`import React from'react';import{createRoot}from'react-dom/client';import Ad from'@/components/ads/KakaoPageAd';createRoot(document.getElementById('root')).render(React.createElement('main',{className:'fixture-page'},React.createElement('p',null,'Synthetic public page, no provider impressions.'),React.createElement(Ad,{placement:'platform',contentReady:true})));`,resolveDir:repo,loader:'tsx'},bundle:true,write:false,outfile:'fixture.js',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'only-auth-navigation-fixtures',setup(b){b.onResolve({filter:/^(next\/navigation|@\/lib\/useAuth)$/},args=>({path:args.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='next/navigation'?`export const usePathname=()=>'/';export const useSearchParams=()=>new URLSearchParams();`:`export const useAuth=()=>({user:null,isLoading:false});`,loader:'js'}));}}]});
const js=bundled.outputFiles!.find(file=>file.path.endsWith('.js'))!.text,css=bundled.outputFiles!.find(file=>file.path.endsWith('.css'))!.text;
const html='<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0}*{box-sizing:border-box}.fixture-page{width:calc(100% - 40px);max-width:1100px;margin:24px auto}'+css+'</style><div id="root"></div><script src="/fixture.js"></script>';
const fakeSdk=`window.__fakeSdkLoads=(window.__fakeSdkLoads||0)+1;for(const ins of document.querySelectorAll('ins.kakao_ad_area')){ins.style.display='block';ins.style.width=ins.dataset.adWidth+'px';ins.style.height=ins.dataset.adHeight+'px';ins.textContent='Synthetic unit';}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.CBGPU_CHROMIUM||'/tmp/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});let fakeLoads=0,blocked=0;const rows:unknown[]=[];
try{
 for(const width of [319,320,350,359,390,750,1280]){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/*',async route=>{const url=route.request().url();if(url===sdk){fakeLoads++;return route.fulfill({status:200,contentType:'application/javascript',body:fakeSdk})}if(url===origin+'/')return route.fulfill({status:200,contentType:'text/html',body:html});if(url===origin+'/fixture.js')return route.fulfill({status:200,contentType:'application/javascript',body:js});blocked++;return route.abort()});
  await page.goto(origin,{waitUntil:'networkidle'});
  if(width<320){await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>(window as any).__fakeSdkLoads||0),0);assert.equal(await page.locator('.cb-kakao-page-ad').isVisible(),false);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));rows.push({viewport:width,sdk:0});}
  else{
   await page.waitForFunction(()=>!!document.querySelector('ins.kakao_ad_area'));
   await page.waitForFunction(()=>(window as any).__fakeSdkLoads===1);
   const geometry=await page.evaluate(()=>{const aside=document.querySelector('.cb-kakao-page-ad')as HTMLElement,slot=document.querySelector('.cb-kakao-ad-slot')as HTMLElement,ins=document.querySelector('ins.kakao_ad_area')as HTMLElement;const box=(el:HTMLElement)=>{const r=el.getBoundingClientRect();return{left:r.left,right:r.right,width:r.width,height:r.height}};return{viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,aside:box(aside),slot:box(slot),unit:box(ins),id:ins.dataset.adUnit,adWidth:Number(ins.dataset.adWidth),adHeight:Number(ins.dataset.adHeight),format:slot.dataset.adFormat,transform:getComputedStyle(slot).transform}});
   const desktop=width===1280,expectedWidth=desktop?728:320,expectedHeight=desktop?90:50;
   assert.equal(geometry.adWidth,expectedWidth);assert.equal(geometry.adHeight,expectedHeight);assert.equal(geometry.unit.width,expectedWidth);assert.equal(geometry.unit.height,expectedHeight);assert.equal(geometry.slot.width,expectedWidth);assert.equal(geometry.id,desktop?'DAN-kVpBmlPRbOvGb6oi':'DAN-vpZNfcj3tj0jMkhV');assert.equal(geometry.aside.height,expectedHeight+24);
   assert.ok(geometry.pageWidth<=width,'advertisement must not make the page overflow');assert.ok(geometry.unit.left>=-.01&&geometry.unit.right<=width+.01,'the complete original-sized unit must remain inside the viewport');assert.ok(geometry.unit.left>=geometry.aside.left-.01&&geometry.unit.right<=geometry.aside.right+.01,'no slot cropping');assert.match(geometry.transform,/^matrix\(1, 0, 0, 1,/,'translation only, no scale');
   if(width<=359){assert.equal(geometry.aside.width,320);assert.ok(Math.abs(geometry.unit.left-(width-320)/2)<.01,'fullbleed unit centered without a gutter overlay');}
   if(width===320){await page.setViewportSize({width:350,height:844});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>(window as any).__fakeSdkLoads),1,'resizing must not refresh the SDK');}
   rows.push({viewport:width,format:geometry.format,width:geometry.unit.width,height:geometry.unit.height,reservedHeight:geometry.aside.height,sdk:1});
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS original-size ad containment '+JSON.stringify(rows)+'; '+fakeLoads+' fake SDK responses, '+blocked+' blocked external requests, 0 real provider requests.');
}finally{await browser.close()}
