import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import iconv from 'iconv-lite';
import {createCipheriv,createHash,createHmac} from 'node:crypto';
import * as source from '../src/lib/comciganSource.ts';import * as payload from '../src/lib/comciganPayload.ts';
const code=ts.transpileModule(fs.readFileSync(new URL('../src/lib/comcigan.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
function seal(value,key){const iv=Buffer.alloc(16,3),bytes=Buffer.from(key,'hex'),cipher=createCipheriv('aes-256-cbc',bytes,iv);const data=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);const prefix='enc2:'+iv.toString('base64')+':'+data.toString('base64');return prefix+':'+createHmac('sha256',createHash('sha256').update(bytes).digest()).update(prefix).digest('base64')}
test('full client uses encrypted search, encoded school-code column and fresh rotating transport metadata',async()=>{
 const requests=[];let revision=1;
 const key=()=>String(revision).repeat(64);
 const renderer=()=>`function school_ra(sc){$.ajax({url:'./123?456l'+sc+'_enc2'});} sc_data('789_',sc,1,'0');var u=btoa(s7+'_'+da1+'_'+r+'_enc2');var key=CryptoJS.enc.Hex.parse('${key()}');var r=Math.floor(학교명단[i][0]/5000)+2;원자료=Q자료(자료.자료101[학년][반]);일일자료=Q자료(자료.자료102[학년][반]);성명=Q성명(자료.자료103[th]);과목명=Q과목명(자료.자료104[sb]);globalThis.UPSTREAM_EXECUTED=true;`;
 const weekdays=[null,...Array.from({length:5},()=>[0,1001])];const table=[null,[null,weekdays]];
 const raw={자료101:table,자료102:table,자료103:['','김*'],자료104:['','수학'],학급수:[0,1,1,1],일과시간:['09:00'],분리:100};
 const upstream=async url=>{
  requests.push(url);
  if(url==='http://컴시간학생.kr')return new Response('<frame src="http://comci.net:4082/st">');
  if(url.endsWith('/st'))return new Response(iconv.encode(renderer(),'euc-kr'));
  if(url.includes('?456l')){assert.ok(url.endsWith('_enc2'));return new Response(seal({학교검색:[[10000,'충북','충북과학고등학교',999,71507]]},key()))}
  const decoded=Buffer.from(url.split('?')[1],'base64').toString();assert.equal(decoded,'789_71507_0_1_enc2');return new Response(seal(raw,key()));
 };
 const exports={};vm.runInNewContext(code,{exports,Buffer,URL,AbortSignal,Date,fetch:upstream,require(name){if(name==='iconv-lite')return iconv;if(name==='./comciganSource')return source;if(name==='./comciganPayload')return payload;throw Error(name)}});
 const first=await exports.getTimetable(1,1);assert.equal(first.grid[0][1].subject,'수학');assert.equal(Object.keys(first.grid).length,5);assert.equal(globalThis.UPSTREAM_EXECUTED,undefined);
 const before=requests.length;await exports.getTimetable(1,1);assert.equal(requests.length,before,'valid data is cached');
 revision=2;const rotated=await exports.getTimetable(1,1,{forceRefresh:true});assert.equal(rotated.grid[4][1].subject,'수학');assert.equal(requests.filter(u=>u.endsWith('/st')).length,2,'authentication failure reloads current transport metadata');
});
