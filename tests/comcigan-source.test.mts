import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeComciganSource,extractComciganMetadata,extractComciganFields,extractComciganRequest,extractComciganCellKey,extractComciganWeekField,extractComciganTimesField} from '../src/lib/comciganSource.ts';
const source="function school_ra(sc){$.ajax({ url:'./142880?12350l'+sc });} sc_data('82753_',sc,1,'0');";
function wrap(text: string,key: number){const encoded=Array.from(text,(c,i)=>(c.charCodeAt(0)^((key+i*13)&255)).toString(16).padStart(4,'0')).join('');return `<script>/* hour-obfuscated-v2 */(function(a,k){ /* never executed */ })([[0,${JSON.stringify(encoded)}]],${key});</script>`}
test('reads the provider encoding without executing decoded JavaScript',()=>{
 const html=wrap(source+';globalThis.CBGPU_COMCI_EXECUTED=true;',83);
 assert.deepEqual(extractComciganMetadata(html),{extractCode:'/142880?12350l',scPrefix:'82753_',scSuffix:'1'});
 assert.equal(globalThis.CBGPU_COMCI_EXECUTED,undefined);
});
test('supports plain source and separately encoded script blocks',()=>{
 assert.deepEqual(extractComciganMetadata(source),extractComciganMetadata(wrap(source,100)+wrap('other code',22)));
});
test('rejects malformed payloads and oversized responses',()=>{
 assert.throws(()=>decodeComciganSource(wrap(source,1).replace('[[0,','[[2,')));
 assert.throws(()=>decodeComciganSource('x'.repeat(2_000_001)));
 assert.throws(()=>extractComciganMetadata('<html>upstream unavailable</html>'));
});

test('derives rotating data field names from renderer semantics',()=>{
 const renderer="원자료=Q자료(자료.자료137[학년][반]);일일자료=Q자료(자료.자료181[학년][반]);성명=Q성명(자료.자료197[th]);과목명=Q과목명(자료.자료148[sb]);";
 assert.deepEqual(extractComciganFields(wrap(renderer,83)),{base:'자료137',daily:'자료181',teachers:'자료197',subjects:'자료148'});
 assert.throws(()=>extractComciganFields('<html>no renderer</html>'));
});

test('reads a viewer with rotated function names and alphanumeric data fields',()=>{
 const transport="window.__HourRequestToken='aabbcc';function searchD(sc,done){$.ajax({url:'./123456?'+encodeURIComponent(btoa('54321l'+encodeURIComponent(sc)+'_1234')),success:done});}";
 const render="loadNow('12345_',sc,1,'0');원자료=Q자료(자료.ABC123[학년]);일일자료=Q자료(자료.DEF456[학년]);성명=lookupA(자료.GHI789[th]);과목명=lookupB(자료.JKL741[sb]);var 시작일=new Date(decodeA(자료.MNO852));요일출력하기(decodeA(자료.MNO852));p+=자료.PQR963[교시-1];";
 const decoder="function decodeA(data){var key=String.fromCharCode(10,20,30,40);var bytes=atob(data);}";
 const html=wrap(render,91)+wrap(transport+decoder,33);
 assert.deepEqual(extractComciganMetadata(html),{extractCode:'/123456?54321l',scPrefix:'12345_',scSuffix:'1'});
 assert.deepEqual(extractComciganRequest(html),{base64Search:true,token:'aabbcc'});
 assert.deepEqual(extractComciganFields(html),{base:'ABC123',daily:'DEF456',teachers:'GHI789',subjects:'JKL741'});
 assert.deepEqual(extractComciganCellKey(html),[10,20,30,40]);
 assert.equal(extractComciganWeekField(html),'MNO852');
 assert.equal(extractComciganTimesField(html),'PQR963');
});

test('reads the viewer that POSTs a text/plain body instead of a query string',()=>{
 // Mirrors the current provider script: relative fixed path, method held in an obfuscated variable.
 const transport="window.__HourRequestToken='aabbcc';var Q웹보호안내중=false,Qa='POST';function search9(sc,success){var s7='15565l'+encodeURIComponent(sc);    return $.ajax({        url:'./959975', method:Qa, contentType:'text/plain; charset=UTF-8',        data:encodeURIComponent(btoa(s7+'_8701')),        success:success    });}";
 const html=wrap("f856wT('40826_',storage.sc,1,'1');",57)+wrap(transport,29);
 assert.deepEqual(extractComciganMetadata(html),{extractCode:'/959975?15565l',scPrefix:'40826_',scSuffix:'1'});
 assert.deepEqual(extractComciganRequest(html),{base64Search:false,token:'aabbcc',post:true});
 // A method variable that is not POST must not switch the transport.
 const getViewer=wrap("f856wT('40826_',storage.sc,1,'1');",57)+wrap(transport.replace("Qa='POST'","Qa='GET'"),29);
 assert.equal(extractComciganRequest(getViewer).post,undefined);
});
