import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync(new URL('../src/lib/siteHref.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {siteHref}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('site links preserve paths and remain canonical outside local development',()=>{
 const mode=process.env.NODE_ENV,origins=process.env.NEXT_PUBLIC_CBGPU_SITE_ORIGINS;
 try{
  process.env.NEXT_PUBLIC_CBGPU_SITE_ORIGINS=JSON.stringify({'docs.cbgpu.com':'http://localhost:3004'});
  process.env.NODE_ENV='production';assert.equal(siteHref('https://docs.cbgpu.com/guide?q=test#step'),'https://docs.cbgpu.com/guide?q=test#step');
  process.env.NODE_ENV='development';assert.equal(siteHref('https://docs.cbgpu.com/guide?q=test#step'),'http://localhost:3004/guide?q=test#step');
  assert.equal(siteHref('/study'),'/study');assert.equal(siteHref('https://example.org/path'),'https://example.org/path');
  process.env.NEXT_PUBLIC_CBGPU_SITE_ORIGINS='invalid';assert.equal(siteHref('https://docs.cbgpu.com/guide'),'https://docs.cbgpu.com/guide');
 }finally{
  if(mode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=mode;
  if(origins===undefined)delete process.env.NEXT_PUBLIC_CBGPU_SITE_ORIGINS;else process.env.NEXT_PUBLIC_CBGPU_SITE_ORIGINS=origins;
 }
});
