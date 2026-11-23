/** Actual Button, Link-shaped slot and portal styles; no credentials or external requests. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { chromium } from 'playwright';
const root=path.resolve(process.env.CBGPU_OIL_SOURCE_ROOT||process.cwd());
const output=process.env.CBGPU_PORTAL_CONTRAST_OUTPUT||'/tmp/cbgpu-portal-action-contrast';
const baseline=process.env.CBGPU_OIL_BASELINE==='1';
await fs.mkdir(output,{recursive:true});
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {Button} from '@/components/ui/button';
function App(){return <><section className="admin-developer-shell"><main><h1>Equipment access</h1><Button asChild><a href="#details">Sign in</a></Button><Button>Save changes</Button><Button variant="outline">Cancel</Button><Button className="bg-red-700 text-white">Delete request</Button><p id="details">Assigned managers can continue after signing in.</p></main></section><section className="admin-developer-shell portal-publications"><main className="portal-content"><h2>Publish your work</h2><Button asChild><a href="#paper">Submit a paper</a></Button><button className="bg-primary">Create project</button><p id="paper">Your project stays private until you choose to publish it.</p></main></section></>};createRoot(document.getElementById('root')).render(<App/>);`;
await fs.writeFile(output+'/entry.tsx',entry);
const built=await build({stdin:{contents:entry,resolveDir:root,loader:'tsx'},absWorkingDir:root,bundle:true,write:false,platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'source',setup(b){b.onResolve({filter:/^@\//},args=>{const base=path.join(root,'src',args.path.slice(2));const file=['','.tsx','.ts'].map(s=>base+s).find(existsSync);assert.ok(file);return {path:file}})}}]});
const styles=await postcss([tailwind()]).process(await fs.readFile(root+'/src/app/globals.css','utf8')+'\n@source "'+output+'/entry.tsx";',{from:root+'/src/app/globals.css'});
const portalCss=(await Promise.all(['admin/developer-shell.css','admin/admin-content.css','publications/publications.css'].map(file=>fs.readFile(root+'/src/components/'+file,'utf8')))).join('\n');
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles.css}\n${portalCss}\nbody{margin:0}section{padding:16px}main{padding:0!important;min-width:0}button,a[data-slot]{margin:6px}</style><div id="root"></div><script type="module">${built.outputFiles[0].text}</script></html>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html)});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const results=[];
function contrast(a:string,b:string){const luminance=(color:string)=>{const rgb=color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(n=>{const c=n/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722};const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
try{for(const width of [320,390,1280])for(const dark of [false,true]){const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+(server.address()as any).port);await page.getByRole('heading',{level:1}).waitFor();if(dark)await page.locator('html').evaluate(e=>e.classList.add('dark'));await page.mouse.move(1,1);
const targets=[page.getByRole('link',{name:'Sign in',exact:true}),page.getByRole('button',{name:'Save changes',exact:true}),page.getByRole('link',{name:'Submit a paper',exact:true}),page.getByRole('button',{name:'Create project',exact:true})];
for(const target of targets)for(const state of ['normal','hover','keyboard']as const){if(state==='hover')await target.hover();if(state==='keyboard'){await page.mouse.move(1,1);await target.focus()}await page.waitForTimeout(220);const colors=await target.evaluate(e=>({foreground:getComputedStyle(e).color,background:getComputedStyle(e).backgroundColor,height:e.getBoundingClientRect().height}));const ratio=contrast(colors.foreground,colors.background);results.push({width,dark,label:await target.textContent(),state,...colors,ratio});if(!baseline){assert.ok(ratio>=4.5,JSON.stringify(results.at(-1)));assert.ok(colors.height>=44)}}
const danger=await page.getByRole('button',{name:'Delete request'}).evaluate(e=>getComputedStyle(e).backgroundColor);const primary=await targets[0].evaluate(e=>getComputedStyle(e).backgroundColor);assert.notEqual(danger,primary,'Explicit destructive styling is preserved');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);if(width===320)await page.screenshot({path:output+'/'+(dark?'dark':'light')+'.png',fullPage:true});await page.close()}await fs.writeFile(output+'/results.json',JSON.stringify({baseline,results},null,2));console.log(JSON.stringify({baseline,cases:results.length,minContrast:Math.min(...results.map(r=>r.ratio))}));}finally{await browser.close();await new Promise<void>(r=>server.close(()=>r()))}
