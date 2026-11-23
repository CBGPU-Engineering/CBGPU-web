/** Real Dropdown/Select menus; synthetic labels and loopback fixture assets only. */
import {build} from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {chromium,type Locator,type Page} from 'playwright';

const repo=fileURLToPath(new URL('../',import.meta.url));
const output=path.resolve(process.env.CBGPU_SELECT_WIDTH_PROOF_DIR||'/tmp/cbgpu-select-menu-width');
const labels=[
 {id:'ascii80',text:('https://example.invalid/repositories/'+'synthetic-repository-job-'.repeat(10)).slice(0,80)},
 {id:'ascii150',text:('https://example.invalid/repositories/'+'synthetic-repository-job-'.repeat(10)).slice(0,150)},
 {id:'korean',text:'현재 학교의 공동 연구 프로젝트와 장비 제작 요청을 확인하고 담당자가 처리할 작업을 선택해 주세요. '.repeat(3)},
];
const source=`import React,{useState}from'react';import{createRoot}from'react-dom/client';import{Dropdown}from'@/components/ui/dropdown';import{Select,SelectTrigger,SelectValue,SelectContent,SelectItem}from'@/components/ui/select';const params=new URLSearchParams(location.search),widget=params.get('widget'),label=${JSON.stringify(labels)}.find(item=>item.id===params.get('label')).text;function App(){const[value,setValue]=useState('short');return <main className="w-full p-4 space-y-4"><h1>긴 라벨 폭 확인</h1>{widget==='dropdown'?<Dropdown aria-label="작업 선택" name="job" value={value} onChange={event=>setValue(event.target.value)}><option value="short">짧은 항목</option><option value="long">{label}</option></Dropdown>:<Select value={value} onValueChange={setValue}><SelectTrigger aria-label="작업 선택"><SelectValue/></SelectTrigger><SelectContent position={widget==='popper'?'popper':'item-aligned'}><SelectItem value="short">짧은 항목</SelectItem><SelectItem value="long">{label}</SelectItem></SelectContent></Select>}<p>일반 본문 영역</p><output data-model>{value}</output></main>}createRoot(document.getElementById('root')).render(<App/>);`;
const bundle=await build({absWorkingDir:repo,stdin:{contents:source,resolveDir:repo,loader:'tsx'},tsconfig:path.join(repo,'tsconfig.json'),bundle:true,write:false,outfile:'width-fixture.js',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env':'{}'}});
const js=bundle.outputFiles.find(file=>file.path.endsWith('.js'))!.text;
const css=(await postcss([tailwind({base:repo})]).process(await fs.readFile(path.join(repo,'src/app/globals.css'),'utf8'),{from:path.join(repo,'src/app/globals.css')})).css;
const server=createServer((request,response)=>{
 const pathname=new URL(request.url||'/','http://fixture.invalid').pathname;
 if(request.method!=='GET'){response.writeHead(405);response.end();return;}
 if(pathname==='/fixture.js'){response.writeHead(200,{'Content-Type':'application/javascript'});response.end(js);return;}
 if(pathname==='/'){response.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});response.end(`<html><meta charset="utf-8"><style>${css}</style><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);return;}
 response.writeHead(404);response.end();
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const address=server.address();assert.ok(address&&typeof address!=='string');
const origin='http://127.0.0.1:'+address.port;
await fs.mkdir(output,{recursive:true});

async function assertMenu(page:Page,option:Locator,label:string,phase:string){
 await page.getByRole('listbox').waitFor();await page.waitForTimeout(100);
 // Check the painted menu and each text line; document.scrollWidth alone misses
 // fixed-position portals that extend beyond the viewport.
 const geometry=await option.evaluate((element)=>{
  const item=element as HTMLElement,menu=item.closest<HTMLElement>('[data-slot="select-content"]');
  const textIds=(item.getAttribute('aria-labelledby')||'').split(/\s+/);
  const text=textIds.map(id=>document.getElementById(id)).find(node=>node&&item.contains(node))||item.lastElementChild;
  if(!menu||!text)throw Error('Expected actual Select menu and ItemText');
  const box=(node:Element)=>{const r=node.getBoundingClientRect();return{left:r.left,right:r.right,width:r.width,clientWidth:node.clientWidth,scrollWidth:node.scrollWidth}};
  const range=document.createRange();range.selectNodeContents(text);
  return{viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,menu:box(menu),item:box(item),text:box(text),content:text.textContent,lines:Array.from(range.getClientRects(),rect=>({left:rect.left,right:rect.right,width:rect.width}))};
 });
 const detail=phase+': '+JSON.stringify(geometry);
 assert.ok(geometry.menu.left>=-1&&geometry.menu.right<=geometry.viewport+1,'Menu must fit viewport '+detail);
 assert.ok(geometry.item.left>=geometry.menu.left-1&&geometry.item.right<=geometry.menu.right+1,'Option must fit menu '+detail);
 assert.equal(geometry.content,label,'The full label must remain in ItemText '+detail);
 assert.ok(geometry.text.scrollWidth<=geometry.text.clientWidth+1,'ItemText must wrap rather than clip horizontally '+detail);
 assert.ok(geometry.lines.length>0&&geometry.lines.every(line=>line.left>=geometry.menu.left-1&&line.right<=geometry.menu.right+1),'Every painted label line must fit the menu '+detail);
 assert.ok(geometry.documentWidth<=geometry.viewport+1,'No document horizontal overflow '+detail);
 return geometry;
}
async function assertTrigger(page:Page,trigger:Locator,width:number){
 assert.equal(await page.locator('[data-model]').innerText(),'long');
 const box=await trigger.boundingBox();assert.ok(box&&box.x>=-1&&box.x+box.width<=width+1,'Closed trigger must remain inside viewport: '+JSON.stringify(box));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
}

let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
const results:Array<Record<string,unknown>>=[];
try{
 browser=await chromium.launch({headless:true,...(process.env.CBGPU_BROWSER_EXECUTABLE?{executablePath:process.env.CBGPU_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const width of[320,390])for(const widget of['dropdown','popper','item-aligned'])for(const label of labels){
  const context=await browser.newContext({viewport:{width,height:850},reducedMotion:'reduce'});
  const page=await context.newPage(),errors:string[]=[];let externalRequests=0;
  page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){externalRequests++;return route.abort();}return route.continue();});
  const caseId=widget+'-'+width+'-'+label.id;
  try{
   await page.goto(origin+'/?'+new URLSearchParams({widget,label:label.id}));
   const trigger=page.getByRole('combobox',{name:'작업 선택',exact:true});await trigger.click();
   const option=page.getByRole('option',{name:label.text,exact:true});await option.waitFor();
   await page.screenshot({path:path.join(output,caseId+'-open.png')});
   const opened=await assertMenu(page,option,label.text,caseId+' opened');
   await option.press('Enter');await page.getByRole('listbox').waitFor({state:'hidden'});
   await assertTrigger(page,trigger,width);assert.ok((await trigger.textContent())?.includes(label.text),'Selected full label remains accessible');
   await page.screenshot({path:path.join(output,caseId+'-selected.png')});
   await trigger.click();await option.waitFor();
   await page.screenshot({path:path.join(output,caseId+'-reopened.png')});
   const reopened=await assertMenu(page,option,label.text,caseId+' reopened after long selection');
   assert.equal(await option.getAttribute('data-state'),'checked','Long selection stays selected when reopened');
   await page.keyboard.press('Escape');await page.getByRole('listbox').waitFor({state:'hidden'});await assertTrigger(page,trigger,width);
   assert.equal(externalRequests,0);assert.deepEqual(errors,[]);
   results.push({width,widget,label:label.id,labelLength:label.text.length,opened,reopened});
  }finally{await context.close();}
 }
 await fs.writeFile(path.join(output,'results.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify({cases:results.length,viewportMenus:true,fullLabels:true,selectedAndReopened:true,output}));
}finally{await browser?.close();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
