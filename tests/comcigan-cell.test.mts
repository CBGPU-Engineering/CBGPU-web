import test from 'node:test';
import assert from 'node:assert/strict';
import iconv from 'iconv-lite';
import {extractComciganCellKey,decodeComciganCell,extractComciganSchools} from '../src/lib/comciganSource.ts';

test('public viewer byte keys decode school names, school IDs and subject text without eval',()=>{
 const source='function QnmsbChange(text) { if(!text)return ""; var key=String.fromCharCode(61,28,49,79); }';
 const key=extractComciganCellKey(source);
 assert.deepEqual(key,[61,28,49,79]);
 const encode=value=>{
  const bytes=iconv.encode(value,'euc-kr');
  for(let i=0;i<bytes.length;i++)bytes[i]^=key[i%key.length];
  return bytes.toString('base64');
 };
 const rows=[[12000,encode('충북'),encode('충북과학고등학교'),encode('999'),encode('71507')]];
 assert.deepEqual(extractComciganSchools(rows,6000,key),[{region:'충북',name:'충북과학고등학교',code:71507}]);
 assert.equal(decodeComciganCell(encode('물리학'),key),'물리학');
 assert.equal(decodeComciganCell(encode('2026-11-09'),key),'2026-11-09');
 assert.equal(extractComciganCellKey('legacy public viewer'),null);
 assert.throws(()=>extractComciganCellKey('function QnmsbChange(text) { return executeSomething(); }'));
 assert.throws(()=>decodeComciganCell('invalid encoded value',key));
});
