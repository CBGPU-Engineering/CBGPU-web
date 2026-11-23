/** Actual component/shared controls with local synthetic sessions and API responses only. */
import {build} from 'esbuild';
import {chromium} from 'playwright';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const bundle=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Reservations from './src/components/schools/SchoolGpuReservationsAdmin';window.__actor='actor-a';window.__school='cbsh';const root=createRoot(document.getElementById('root'));window.__render=()=>root.render(<Reservations schoolId={window.__school}/>);window.__render();`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outfile:'fixture.js',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'synthetic-auth',setup(b){b.onResolve({filter:/\/(useAuth|supabase)$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',contents:a.path.endsWith('useAuth')?`export const useAuth=()=>({user:{id:window.__actor}})`:`export const supabase={auth:{getSession:async()=>({data:{session:{user:{id:window.__actor},access_token:'synthetic-fixture-token'}}})}};`}))}}]});
const script=bundle.outputFiles.find(file=>file.path.endsWith('.js'))!.text;
const css=(await postcss([tailwind()]).process(fs.readFileSync('src/app/globals.css','utf8'),{from:path.resolve('src/app/globals.css')})).css;
const browser=await chromium.launch({executablePath:process.env.CBGPU_CHROMIUM||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
const screenshots='docs/screenshots/school-gpu-reservations-20261123';fs.mkdirSync(screenshots,{recursive:true});
const iso=(offset:number)=>new Date(Date.now()+offset).toISOString();
try{for(const width of [320,390,1280])for(const dark of [false,true]){
 const context=await browser.newContext({viewport:{width,height:920},reducedMotion:'reduce',userAgent:width===390?'Mozilla/5.0 (Linux; Android 14; wv) Synthetic CBGPU':'Synthetic local Chromium'});const page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Synthetic fixture error:',e.message)});let writes=0,foreign=false,cancelled=false;
 const legacy={id:'legacy-fixture',source:'legacy',status:'pending',start_time:iso(3600000),end_time:iso(7200000),purpose:'합성 연구 목적 · 실제 사용자 자료 없음',gpu_id:'1',gpu_label:'GPU #1',owner:{id:'synthetic-owner',full_name:'합성 예약자',student_number:'0000'},allowed_actions:['approve','reject']};
 const registry={...legacy,id:'registry-fixture',source:'registry',status:'RESERVED',start_time:iso(-3600000),gpu_id:'synthetic-resource',gpu_label:'학교 연구 GPU',allowed_actions:['cancel','revoke']};
 await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());assert.equal(url.origin,'https://fixture.local');if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:`<html class="${dark?'dark':''}"><head><meta charset="utf-8"><style>${css}</style></head><body class="bg-background text-foreground"><main style="padding:16px;max-width:1100px;margin:auto"><p class="text-sm mb-4">LOCAL SYNTHETIC FIXTURE · 실제 사용자 자료 없음</p><div id="root"></div></main><script src="/fixture.js"></script></body></html>`});
 if(url.pathname==='/fixture.js')return route.fulfill({contentType:'application/javascript; charset=utf-8',body:script});
 if(!url.pathname.startsWith('/api/compute/'))return route.fulfill({status:404});
 assert.equal(req.headers().authorization,'Bearer synthetic-fixture-token');
 if(req.method()==='POST'){writes++;assert.equal(url.pathname,'/api/compute/schools/cbsh/gpu/admin/reservations/registry-fixture/action');assert.deepEqual(req.postDataJSON(),{source:'registry',action:'cancel',expected_status:'RESERVED',expected_end_time:registry.end_time});cancelled=true;return route.fulfill({json:{school_id:'cbsh',reservation:{...registry,status:'CANCELLED',allowed_actions:[]},server_now:iso(0)}})}
 assert.equal(req.method(),'GET');assert.equal(url.searchParams.get('limit'),'50');const school=url.pathname.split('/')[4];
 return route.fulfill({json:{school_id:foreign?'foreign-school':school,items:school==='cbsh'?[legacy,{...registry,...(cancelled?{status:'CANCELLED',allowed_actions:[]}: {})}]:[{...registry,owner:{...registry.owner,full_name:'다른 학교 합성 예약자'}}],next_cursor:null,server_now:iso(0)}});
 });
 await page.goto('https://fixture.local/');await page.getByRole('heading',{name:'GPU 예약',exact:true}).waitFor();await page.getByText('2건 조회',{exact:false}).waitFor();
 const schoolRow=page.getByRole('article',{name:'학교 연구 GPU 예약'});assert.equal(await schoolRow.getByRole('button',{name:'승인',exact:true}).count(),0);assert.ok(await schoolRow.getByText('예약됨',{exact:true}).isVisible());assert.ok(await page.getByRole('article',{name:'GPU #1 예약'}).getByRole('button',{name:'승인',exact:true}).isVisible());
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await page.screenshot({path:`${screenshots}/${width}-${dark?'dark':'light'}.png`,fullPage:true});
 await schoolRow.getByRole('button',{name:'예약 취소',exact:true}).click();await page.getByRole('dialog').waitFor();assert.ok(await page.getByText(/실행 중인 노트북이 중지/).isVisible());await page.getByRole('button',{name:'돌아가기',exact:true}).click();assert.equal(writes,0);
 await schoolRow.getByRole('button',{name:'예약 취소',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'예약 취소',exact:true}).click();await page.getByText('예약 취소 처리가 저장됐어요.',{exact:true}).waitFor();assert.equal(writes,1);
 await page.evaluate(()=>{window.__school='school-b';window.__render()});await page.getByText('다른 학교 합성 예약자',{exact:true}).waitFor();assert.equal(await page.getByText('합성 예약자',{exact:true}).count(),0);assert.equal(await page.getByRole('article',{name:'GPU #1 예약'}).count(),0);
 foreign=true;await page.getByRole('button',{name:'새로고침',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('article').count(),0);
 assert.deepEqual(errors,[]);await context.close();
}console.log(JSON.stringify({actualReactAndSharedControls:true,widths:[320,390,1280],lightDark:true,appUserAgent390:true,scopeIsolation:true,reservedNeverApproval:true,confirmedSyntheticCASAction:true,noProvidersOrRealWrites:true}));}finally{await browser.close()}
declare global{interface Window{__actor:string;__school:string;__render:()=>void}}
