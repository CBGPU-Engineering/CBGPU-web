import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeComciganSource,extractComciganMetadata} from '../src/lib/comciganSource.ts';
const source="function school_ra(sc){$.ajax({ url:'./142880?12350l'+sc });} sc_data('82753_',sc,1,'0');";
function wrap(text,key){const encoded=Array.from(text,(c,i)=>(c.charCodeAt(0)^((key+i*13)&255)).toString(16).padStart(4,'0')).join('');return `<script>/* hour-obfuscated-v2 */(function(a,k){ /* never executed */ })([[0,${JSON.stringify(encoded)}]],${key});</script>`}
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
