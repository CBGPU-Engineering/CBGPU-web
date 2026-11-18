import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';

// Opt-in browser regression: no application server, credentials, or provider calls.
test('auth return survives a click before passive effects without hijacking native activations', {skip:process.env.CBGPU_BROWSER_QA!=='1'}, async () => {
 const root=fileURLToPath(new URL('../',import.meta.url));
 const require=createRequire(import.meta.url),{build}=require('esbuild'),{chromium}=require('playwright');
 const bundle=await build({stdin:{contents:`
 import React,{useLayoutEffect}from'react';
 import{createRoot}from'react-dom/client';
 import{AuthFlowLink}from'${root}src/components/auth/AuthFlowLink.tsx';
 window.pushes=[];window.callers=0;
 function App(){useLayoutEffect(()=>{
 const anchor=document.querySelector('a');
 if(window.fixture.kind==='plain'||window.fixture.kind==='keyboard')anchor.click();
 else anchor.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,...window.fixture.event}));
 },[]);
 return <AuthFlowLink href="/auth/signup" target={window.fixture.target} download={window.fixture.download} onClick={event=>{window.callers++;if(window.fixture.prevent)event.preventDefault()}}>Join</AuthFlowLink>}
 createRoot(document.getElementById('root')).render(<App/>);
 `,resolveDir:root,loader:'tsx'},bundle:true,write:false,platform:'browser',define:{'process.env.NODE_ENV':'"test"'},plugins:[{name:'isolated-next',setup(b:any){
 b.onResolve({filter:/^next\/(link|navigation)$/},(a:any)=>({path:a.path,namespace:'fixture-next'}));
 b.onLoad({filter:/.*/,namespace:'fixture-next'},(a:any)=>({contents:a.path==='next/link'?`import React from'react';export default function Link(p){return React.createElement('a',{...p,onClick:event=>{p.onClick?.(event);event.preventDefault()}})}`:`export function useRouter(){return{push:url=>window.pushes.push(url)}}`,resolveDir:root}));
 b.onResolve({filter:/^@\/lib\/authFlowHref$/},()=>({path:root+'src/lib/authFlowHref.ts'}));
 }}]});
 const server=createServer((_q,r)=>{r.setHeader('Content-Type','text/html');r.end('<main id="root"></main>')});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=(server.address() as {port:number}).port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
 const cases=[
  {kind:'plain',push:true},
  {kind:'keyboard',push:true},
  {kind:'modified',event:{ctrlKey:true},push:false},
  {kind:'modified',event:{metaKey:true},push:false},
  {kind:'modified',event:{shiftKey:true},push:false},
  {kind:'modified',event:{altKey:true},push:false},
  {kind:'modified',event:{button:1},push:false},
  {kind:'target',target:'_blank',push:false},
  {kind:'download',download:'',push:false},
  {kind:'prevented',prevent:true,push:false},
 ];
 for(const fixture of cases){
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:'+port+'/?next=%2Fschools%2Fnew%3Fcatalog_school_id%3Dsynthetic-school');
 await page.evaluate(value=>{(window as any).fixture=value},fixture);
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.waitForFunction(()=>Array.isArray((window as any).pushes));
 await page.waitForTimeout(30);
 assert.deepEqual(await page.evaluate(()=>(window as any).pushes),fixture.push?['/auth/signup?next=%2Fschools%2Fnew%3Fcatalog_school_id%3Dsynthetic-school']:[],JSON.stringify(fixture));
 if(fixture.kind==='plain')assert.equal(await page.evaluate(()=>(window as any).callers),1);
 await page.close();
 }
 }finally{await browser.close();await new Promise<void>(resolve=>server.close(()=>resolve()))}
});
