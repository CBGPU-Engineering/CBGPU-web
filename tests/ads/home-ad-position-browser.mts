/** Real desktop/app frames through loopback. All auth/API and AdFit responses are synthetic. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const port=Number(process.env.CBGPU_AD_PREVIEW_PORT||13951);
const output=process.env.CBGPU_AD_PROOF_DIR||'artifacts/home-ad-position';
await mkdir(output,{recursive:true,mode:0o700});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const results:unknown[]=[];
try {
 for(const frame of ['desktop','app'] as const) for(const theme of ['light','dark'] as const){
 const app=frame==='app',width=app?390:1280,origin=app?'https://app.cbgpu.com':'https://cbgpu.com';
 const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce',serviceWorkers:'block',...(app?{userAgent:'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Version/4.0 Chrome/130.0 Mobile Safari/537.36'}:{})});
 await context.addInitScript(()=>{
  // A deterministic signed-out auth client; no real tokens, sessions or SDK traffic.
  const emptyRead=()=>{const query:any={};for(const method of ['select','eq','neq','in','order','limit','range','is','gte','lte'])query[method]=()=>query;query.then=(resolve:any,reject:any)=>Promise.resolve({data:[],error:null,count:0}).then(resolve,reject);query.single=query.maybeSingle=async()=>({data:null,error:null});return query};
  const channel:any={};channel.on=channel.subscribe=()=>channel;
  (window as any).__cbgpuAuthClient={from:emptyRead,channel:()=>channel,removeChannel:async()=> 'ok',auth:{
   getSession:async()=>({data:{session:null},error:null}),
   onAuthStateChange:(callback:(event:string,session:null)=>void)=>{(window as any).__fixtureAuthCallbacks=((window as any).__fixtureAuthCallbacks||0)+1;let active=true;queueMicrotask(()=>{if(active)callback('INITIAL_SESSION',null)});return{data:{subscription:{unsubscribe(){active=false}}}}},
  }};
 });
 await context.routeWebSocket('**/*',socket=>socket.close());
 const page=await context.newPage(),errors:string[]=[];let sdkRequests=0,privateMocks=0,blockedExternal=0;
 page.on('requestfailed',request=>console.log('Failed request',request.url(),request.failure()?.errorText));
 page.on('pageerror',error=>{errors.push(error.message);console.log('Page error',error.message)});page.on('console',message=>{if(message.type()==='error')console.log('Console',message.text())});
 await context.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url());
 if(request.url()==='https://t1.kakaocdn.net/kas/static/ba.min.js'){
 sdkRequests++;assert.equal(request.headers().referer,undefined);
 return route.fulfill({contentType:'application/javascript',body:`window.__homeAdFixtureLoads=(window.__homeAdFixtureLoads||0)+1;for(const n of document.querySelectorAll('ins.kakao_ad_area')){n.style.display='block';n.style.width=n.dataset.adWidth+'px';n.style.height=n.dataset.adHeight+'px';n.style.background='rgba(128,128,128,.12)';n.style.textAlign='center';n.style.lineHeight=n.dataset.adHeight+'px';n.textContent='광고 테스트 · 실제 광고 요청 없음';}`});
 }
 if(url.origin!==origin){blockedExternal++;return route.abort()}
 if(url.pathname==='/api/auth/shared-session')return route.fulfill({contentType:'application/json',body:'{"state":"signed-out","value":null}'});
 if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/backend/')){privateMocks++;return route.fulfill({status:403,contentType:'application/json',body:'{"error":"Synthetic private upstream denied"}'});}
 const headers:Record<string,string>={host:url.hostname,'x-cbgpu-public-host':url.hostname,'x-forwarded-proto':'https'};
 for(const name of ['accept','content-type','rsc','next-router-state-tree','next-url','next-router-prefetch'])if(request.headers()[name])headers[name]=request.headers()[name];
 const response=await fetch('http://127.0.0.1:'+port+url.pathname+url.search,{method:request.method(),headers,redirect:'manual',...(['GET','HEAD'].includes(request.method())?{}:{body:request.postData()||undefined})});
 const outputHeaders:Record<string,string>={};response.headers.forEach((v,k)=>{if(!['content-encoding','content-length','transfer-encoding'].includes(k))outputHeaders[k]=v});
 return route.fulfill({status:response.status,headers:outputHeaders,body:Buffer.from(await response.arrayBuffer())});
 });
 await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
 await page.locator('.cb-kakao-page-ad').waitFor({state:'visible',timeout:15000}).catch(async error=>{console.log('Position diagnostic',JSON.stringify(await page.evaluate(()=>({url:location.href,authCallbacks:(window as any).__fixtureAuthCallbacks,ready:document.readyState,scriptCount:document.scripts.length,text:document.body.innerText.slice(0,400),ads:[...document.querySelectorAll('.cb-kakao-page-ad')].map(n=>({html:n.outerHTML,rect:n.getBoundingClientRect().toJSON()}))}))));throw error});
 await page.waitForFunction(()=>(window as any).__homeAdFixtureLoads===1);
 const geometry=await page.evaluate(()=>{
 const hero=document.querySelector('.cb-home-hero'),ad=document.querySelector('.cb-kakao-page-ad')!,directory=document.querySelector('.cb-directory-home')!,unit=ad.querySelector('ins.kakao_ad_area') as HTMLElement;
 const r=unit.getBoundingClientRect();return{afterHero:hero?.nextElementSibling===ad,beforeDirectory:ad.nextElementSibling===directory,top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height,unit:unit.dataset.adUnit,overflow:document.documentElement.scrollWidth>innerWidth,appFrame:!!document.querySelector('.cb-app'),sdkScripts:document.querySelectorAll('script[src="https://t1.kakaocdn.net/kas/static/ba.min.js"]').length};
 });
 assert.equal(geometry.afterHero,true);assert.equal(geometry.beforeDirectory,true);
 assert.ok(geometry.top>=0&&geometry.bottom<=900,'banner visible in first viewport');
 assert.ok(geometry.left>=0&&geometry.right<=width);assert.equal(geometry.overflow,false);
 assert.equal(geometry.width,app?320:728);assert.equal(geometry.height,app?50:90);
 assert.equal(geometry.unit,app?'DAN-vpZNfcj3tj0jMkhV':'DAN-kVpBmlPRbOvGb6oi');
 assert.equal(await page.locator('ins.kakao_ad_area').count(),1);assert.equal(geometry.sdkScripts,1);assert.equal(sdkRequests,1);
 assert.equal(geometry.appFrame,app);assert.deepEqual(errors,[]);
 await page.screenshot({path:output+'/'+frame+'-'+theme+'.png',fullPage:false});
 results.push({frame,theme,viewport:width,...geometry,sdkRequests,privateMocks,blockedExternal,pageErrors:errors});
 await context.close();
 }
 await writeFile(output+'/PASSED.json',JSON.stringify({realProviderRequests:0,realPrivateApiRequests:0,results},null,2),{mode:0o600});
 console.log(JSON.stringify(results));
}finally{await browser.close()}
