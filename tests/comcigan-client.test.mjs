import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import iconv from 'iconv-lite';
import {createCipheriv,createHash,createHmac} from 'node:crypto';
import * as source from '../src/lib/comciganSource.ts';import * as payload from '../src/lib/comciganPayload.ts';
import * as cache from '../src/lib/timetableCache.ts';
const code=ts.transpileModule(fs.readFileSync(new URL('../src/lib/comcigan.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
function seal(value,key,version="enc2"){const iv=Buffer.alloc(16,3),bytes=Buffer.from(key,'hex'),cipher=createCipheriv('aes-256-cbc',bytes,iv);const data=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);const prefix=version+':'+iv.toString('base64')+':'+data.toString('base64');return prefix+':'+createHmac('sha256',createHash('sha256').update(bytes).digest()).update(prefix).digest('base64')}
test('full client uses encrypted search, encoded school-code column and fresh rotating transport metadata',async()=>{
 const requests=[];let revision=1;
 const key=()=>String(revision).repeat(64);
 const renderer=()=>`function school_ra(sc){$.ajax({url:'./123?456l'+sc+'_enc2'});} sc_data('789_',sc,1,'0');var u=btoa(s7+'_'+da1+'_'+r+'_enc2');var key=CryptoJS.enc.Hex.parse('${key()}');var r=Math.floor(학교명단[i][0]/5000)+2;원자료=Q자료(자료.자료101[학년][반]);일일자료=Q자료(자료.자료102[학년][반]);성명=Q성명(자료.자료103[th]);과목명=Q과목명(자료.자료104[sb]);globalThis.UPSTREAM_EXECUTED=true;`;
 const weekdays=[null,...Array.from({length:5},()=>[0,1001])];const table=[null,[null,weekdays]];
 const week=new Date(Date.now()+9*3600000);week.setUTCDate(week.getUTCDate()-((week.getUTCDay()+6)%7));
 const raw={시작일:week.toISOString().slice(0,10),자료101:table,자료102:table,자료103:['','김*'],자료104:['','수학'],학급수:[0,1,1,1],일과시간:['09:00'],분리:100};
 const upstream=async url=>{
  requests.push(url);
  if(url==='http://컴시간학생.kr')return new Response('<frame src="http://comci.net:4082/st">');
  if(url.endsWith('/st'))return new Response(iconv.encode(renderer(),'euc-kr'));
  if(url.includes('?456l')){assert.ok(url.endsWith('_enc2'));return new Response(seal({학교검색:[[10000,'충북','충북과학고등학교',999,71507]]},key()))}
  const decoded=Buffer.from(url.split('?')[1],'base64').toString();assert.equal(decoded,'789_71507_0_1_enc2');return new Response(seal(raw,key()));
 };
 const exports={};vm.runInNewContext(code,{exports,Buffer,URL,AbortSignal,Date,console,fetch:upstream,require(name){if(name==='iconv-lite')return iconv;if(name==='./comciganSource')return source;if(name==='./comciganPayload')return payload;if(name==='./timetableCache')return cache;if(name==='./timetableStore')return {fileTimetableStore:()=>({read:async()=>null,write:async()=>{}})};throw Error(name)}});
 const first=await exports.getTimetable(1,1);assert.equal(first.grid[0][1].subject,'수학');assert.equal(Object.keys(first.grid).length,5);assert.equal(globalThis.UPSTREAM_EXECUTED,undefined);
 const before=requests.length;await exports.getTimetable(1,1);assert.equal(requests.length,before,'valid data is cached');
 revision=2;const rotated=await exports.getTimetable(1,1,{forceRefresh:true});assert.equal(rotated.grid[4][1].subject,'수학');assert.equal(requests.filter(u=>u.endsWith('/st')).length,2,'authentication failure reloads current transport metadata');
});

test('nested enc5 viewer uses its public request token and shuffled literal key without eval',async()=>{
 const key='ab'.repeat(32),token='abcdef1234';
 const wrap=(s,k)=>{const value=Array.from(s,(c,i)=>(c.charCodeAt(0)^((k+i*13)&255)).toString(16).padStart(4,'0')).join('');return `/* hour-ajax-obfuscated-v1 */(function(a,k){})([[0,"${value}"]],${k});`};
 const transport=`function QAjaxSchool(sc,success){return $.ajax({url:'./123?'+encodeURIComponent(btoa('456l'+encodeURIComponent(sc)+'_enc5')),headers:{'X-Hour-Token':window.__HourRequestToken}})}function QAjaxTimetable(sc,sc2,da1,r,success){return $.ajax({url:'./123?'+btoa(sc+sc2+'_'+da1+'_'+r+'_enc5')})}var key=CryptoJS.enc.Hex.parse((function(a){return a[2]+a[1]+a[3]+a[0];})(['${key.slice(0,16)}','${key.slice(16,32)}','${key.slice(32,48)}','${key.slice(48)}']));`;
 const renderer=`<script>window.__HourRequestToken='${token}';</script><script>${wrap(wrap(transport,23),41)}</script> sc_data('789_',sc,1,'0');var r=Math.floor(학교명단[i][0]/5000)+2;원자료=Q자료(자료.자료101[학년][반]);일일자료=Q자료(자료.자료102[학년][반]);성명=Q성명(자료.자료103[th]);과목명=Q과목명(자료.자료104[sb]);`;
 const days=[null,...Array.from({length:5},()=>[0,1001])],table=[null,[null,days]];
 const raw={시작일:'2026-11-09',자료101:table,자료102:table,자료103:['','Teacher'],자료104:['','Math'],학급수:[0,1]};let calls=0;
 const fetch=async(url,options)=>{
  if(url==='http://컴시간학생.kr')return new Response('<frame src="http://comci.net:4082/st">');
  if(url.endsWith('/st'))return new Response(iconv.encode(renderer,'euc-kr'));
  assert.equal(options.headers['X-Hour-Token'],token);calls++;
  const request=Buffer.from(decodeURIComponent(url.split('?')[1]),'base64').toString();
  if(request.startsWith('456l')){assert.equal(request,'456l'+encodeURIComponent('충북과학고')+'_enc5');return new Response(seal({학교검색:[[10000,'충북','충북과학고등학교',999,71507]]},key,'enc5'))}
  assert.equal(request,'789_71507_0_1_enc5');return new Response(seal(raw,key,'enc5'));
 };
 const exports={};vm.runInNewContext(code,{exports,Buffer,URL,AbortSignal,Date,console,fetch,require(n){if(n==='iconv-lite')return iconv;if(n==='./comciganSource')return source;if(n==='./comciganPayload')return payload;if(n==='./timetableCache')return cache;if(n==='./timetableStore')return {fileTimetableStore:()=>({read:async()=>null,write:async()=>{}})};throw Error(n)}});
 const result=await exports.getTimetable(1,1);assert.equal(result.grid[0][1].subject,'Math');assert.equal(calls,2);
});
