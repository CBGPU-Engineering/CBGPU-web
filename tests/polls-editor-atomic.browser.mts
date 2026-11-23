/** Actual poll editor component, isolated synthetic SDK transport. No external requests. */
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const fixture = `import React from 'react';import{createRoot}from'react-dom/client';import{OverlayProvider}from'overlay-kit';import{AlertProvider}from'./src/lib/alert';import Polls from'./src/app/polls/page';createRoot(document.getElementById('root')).render(<OverlayProvider><AlertProvider><Polls/></AlertProvider></OverlayProvider>);`;
const sdk = `
const poll={id:'11111111-1111-4111-8111-111111111111',created_at:'2026-11-24',title:'합성 투표',description:'기존 설명',ends_at:null,is_active:true,show_results:true,editor_revision:7};
const question={id:'22222222-2222-4222-8222-222222222222',poll_id:poll.id,order_num:0,type:'text',title:'기존 질문',description:'',required:false,options:[],config:{}};
window.__pollWrites=[];window.__pollMode='conflict';window.__pollLoadFail=false;
export const supabase={from(table){const query={};for(const method of ['select','eq','order','limit','abortSignal'])query[method]=()=>query;for(const method of ['insert','update','delete'])query[method]=()=>{throw Error('Legacy table mutation forbidden')};query.then=(yes,no)=>Promise.resolve().then(()=>{if(table==='poll_questions'&&window.__pollLoadFail)throw Error('Synthetic load failure');return {data:table==='polls'?[poll]:table==='poll_questions'?[question]:[],error:null}}).then(yes,no);return query},rpc(name,payload){window.__pollWrites.push({name,payload});return{abortSignal(){return new Promise((resolve,reject)=>{window.__releasePoll=()=>window.__pollMode==='reject'?reject(Error('Synthetic rejected SDK promise')):resolve({data:null,error:{message:window.__pollMode==='answered'?'POLL_ANSWERED_QUESTION_REMOVAL':'POLL_EDIT_CONFLICT'}})})}}}};`;
const built = await build({ stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, outfile: 'polls-fixture.js', platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' }, plugins: [{ name: 'synthetic-transport', setup(b) {
 b.onResolve({ filter: /\/(supabase|useAuth|requestAi)$/ }, a => ({ path: a.path.split('/').pop()!, namespace: 'fixture' }));
 b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ loader: 'js', contents: a.path === 'supabase' ? sdk : a.path === 'useAuth' ? `const user={id:'synthetic-admin'};export const useAuth=()=>({user,isAdmin:true});` : `export const requestAi=()=>{throw Error('No AI requests in fixture')};` }));
} }] });
const js = built.outputFiles.find(f => f.path.endsWith('.js'))!.text;
const css = (await postcss([tailwind()]).process(fs.readFileSync('src/app/globals.css', 'utf8'), { from: path.resolve('src/app/globals.css') })).css;
const out = '/tmp/cbgpu-polls-atomic-browser';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/tmp/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
try { for(const config of [{width:390,dark:false,app:false},{width:390,dark:true,app:false},{width:1280,dark:false,app:false},{width:1280,dark:true,app:false},{width:393,dark:true,app:true}]) {
 const page=await browser.newPage({viewport:{width:config.width,height:950},colorScheme:config.dark?'dark':'light',reducedMotion:'reduce',...(config.app?{userAgent:'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36'}:{})});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const url=new URL(r.request().url());assert.equal(url.origin,'https://fixture.local');if(url.pathname==='/')return r.fulfill({contentType:'text/html',body:`<html class="${config.dark?'dark':''}"><meta charset="utf-8"><style>${css}</style><body><main class="p-4"><div id="root"></div></main><script src="/fixture.js"></script></body></html>`});if(url.pathname==='/fixture.js')return r.fulfill({contentType:'application/javascript',body:js});return r.abort()});
 await page.goto('https://fixture.local/');
 await page.getByRole('button',{name:'투표 수정',exact:true}).click();
 await page.locator('#poll-title').fill('내 수정 초안');
 const resultSwitch=page.getByRole('switch',{name:'결과 공개',exact:true});
 await resultSwitch.focus();await page.keyboard.press('Space');assert.equal(await resultSwitch.isChecked(),false);await page.keyboard.press('Space');assert.equal(await resultSwitch.isChecked(),true);
 const requiredSwitch=page.getByRole('switch',{name:'1번 질문 필수 응답',exact:true});
 await requiredSwitch.focus();await page.keyboard.press('Space');assert.equal(await requiredSwitch.isChecked(),true);await page.keyboard.press('Space');assert.equal(await requiredSwitch.isChecked(),false);
 assert.ok(await resultSwitch.evaluate(input=>input.closest('label')!.getBoundingClientRect().height>=44));
 assert.ok(await requiredSwitch.evaluate(input=>input.closest('label')!.getBoundingClientRect().height>=44));
 const save=page.getByRole('button',{name:'저장하기',exact:true});await save.waitFor();
 await page.waitForFunction(()=>![...document.querySelectorAll('button')].find(b=>b.textContent==='저장하기')?.disabled);
 // Two same-turn handler events must submit exactly one atomic RPC.
 await save.evaluate(button=>{button.dispatchEvent(new MouseEvent('click',{bubbles:true}));button.dispatchEvent(new MouseEvent('click',{bubbles:true}))});
 await page.waitForFunction(()=>!!(window as any).__releasePoll);
 assert.equal(await page.locator('#poll-title').isDisabled(),true);assert.equal(await resultSwitch.isDisabled(),true);assert.equal(await requiredSwitch.isDisabled(),true);
 const calls=await page.evaluate(()=>(window as any).__pollWrites);assert.equal(calls.length,1);assert.equal(calls[0].name,'cbgpu_save_poll');assert.equal(calls[0].payload.p_expected_revision,7);assert.equal(calls[0].payload.p_questions[0].id,'22222222-2222-4222-8222-222222222222');
 await page.evaluate(()=>(window as any).__releasePoll());
 await page.getByText('다른 곳에서 투표를 수정했어요.',{exact:false}).waitFor();assert.equal(await page.locator('#poll-title').inputValue(),'내 수정 초안');assert.equal(await page.locator('#poll-title').isEnabled(),true);
 await page.screenshot({path:`${out}/${config.width}-${config.dark?'dark':'light'}-${config.app?'app':'web'}.png`,fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 // Close shared error dialog, then verify a rejected promise also releases saving.
 await page.getByRole('button',{name:'확인',exact:true}).click();
 await page.evaluate(()=>{(window as any).__pollMode='reject';(window as any).__releasePoll=null});
 await save.click();await page.waitForFunction(()=>!!(window as any).__releasePoll);await page.evaluate(()=>(window as any).__releasePoll());
 await page.getByText('저장 결과를 확인하지 못했어요.',{exact:false}).waitFor();assert.equal(await page.locator('#poll-title').inputValue(),'내 수정 초안');assert.equal(await page.locator('#poll-title').isEnabled(),true);assert.equal(await page.evaluate(()=>(window as any).__pollWrites.length),2);
 await page.getByRole('button',{name:'확인',exact:true}).click();
 await page.getByRole('button',{name:'취소',exact:true}).click();
 await page.evaluate(()=>{(window as any).__pollLoadFail=true});
 await page.getByRole('button',{name:'투표 수정',exact:true}).click();
 await page.getByText('질문을 불러오지 못했어요.',{exact:false}).waitFor();
 assert.equal(await page.getByRole('button',{name:'저장하기',exact:true}).isDisabled(),true);
 await page.screenshot({path:`${out}/${config.width}-${config.dark?'dark':'light'}-${config.app?'app':'web'}-load-error.png`,fullPage:true});
 await page.evaluate(()=>{(window as any).__pollLoadFail=false});
 await page.getByRole('button',{name:'질문 다시 불러오기',exact:true}).click();
 await page.waitForFunction(()=>![...document.querySelectorAll('button')].find(b=>b.textContent==='저장하기')?.disabled);
 assert.equal(await page.evaluate(()=>(window as any).__pollWrites.length),2);
 await page.screenshot({path:`${out}/${config.width}-${config.dark?'dark':'light'}-${config.app?'app':'web'}-recovered.png`,fullPage:true});
 await page.close();console.log(JSON.stringify({...config,atomicRpc:true,conflictDraftPreserved:true,rejectedPromiseRecovered:true,failedQuestionReadBlocksSave:true}));
 } }finally{await browser.close()}
