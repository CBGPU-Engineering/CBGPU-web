import test from 'node:test';import assert from 'node:assert/strict';
import {createCipheriv,createHash,createHmac} from 'node:crypto';
import {decodeComciganPayload} from '../src/lib/comciganPayload.ts';
import {extractComciganTransport,extractComciganSchools} from '../src/lib/comciganSource.ts';
const key='ab'.repeat(32);
function encrypt(value,encoding='base64'){
 const iv=Buffer.alloc(16,7),cipher=createCipheriv('aes-256-cbc',Buffer.from(key,'hex'),iv);
 const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
 const payload=[encoding==='base64'?'enc2':'enc1',iv.toString(encoding),data.toString(encoding)].join(':');
 return payload+':'+createHmac('sha256',createHash('sha256').update(Buffer.from(key,'hex')).digest()).update(payload).digest(encoding);
}
test('decodes authenticated enc2 and legacy enc1 Korean payloads and plain JSON',()=>{
 const value=JSON.stringify({학교검색:[[7000,'충북','충북과학고등학교',100,71507]]});
 for(const encoding of ['base64','hex'])assert.equal(decodeComciganPayload(encrypt(value,encoding)+'\x00',key),value);
 assert.equal(decodeComciganPayload(value,null),value);
});
test('fails closed for tampered ciphertext, wrong tags/keys and malformed encoding',()=>{
 const body=encrypt('{"학교검색":[]}');const parts=body.split(':');
 const bad=parts.slice();bad[2]=(bad[2][0]==='A'?'B':'A')+bad[2].slice(1);
 for(const input of [bad.join(':'),parts.slice(0,3).join(':'),body+'!',body.replace(parts[1],'AA==')])assert.throws(()=>decodeComciganPayload(input,key));
 assert.throws(()=>decodeComciganPayload(body,'cd'.repeat(32)));assert.throws(()=>decodeComciganPayload(body,null));
 assert.throws(()=>decodeComciganPayload('x'.repeat(8_000_001),key));
});
test('derives rotating public transport constants and school-code column from official source',()=>{
 const source=`var sc3='./123?'+btoa(s7+'_'+da1+'_'+r+'_enc2');var key=CryptoJS.enc.Hex.parse('${key}');var r=Math.floor(학교명단[i][0]/6000)+2;`;
 assert.deepEqual(extractComciganTransport(source),{suffix:'_enc2',key,schoolCodeDivisor:6000});
 assert.deepEqual(extractComciganSchools([[12000,'충북','충북과학고등학교',999,71507]],6000),[{region:'충북',name:'충북과학고등학교',code:71507}]);
 assert.deepEqual(extractComciganSchools([[0,'충북','School',123]],null),[{region:'충북',name:'School',code:123}]);
 assert.throws(()=>extractComciganSchools([[12000,'충북','School',999]],6000));
 assert.throws(()=>extractComciganTransport(source.replace(key,'bad')));
});
