import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import nextConfig from '../next.config.ts';
const {getPathMatch}=createRequire(import.meta.url)('next/dist/shared/lib/router/utils/path-match');

test('effective Next headers allow external registration cancellation without ambient credentials',async()=>{
 const rules=await nextConfig.headers!();
 for(const path of ['/api/ai/v1/contests','/api/ai/v1/contests/register','/api/ai/v1/contests/00000000-0000-4000-8000-000000000001/registrations/me']){
  const headers=new Headers();
  for(const rule of rules)if(getPathMatch(rule.source)(path))for(const header of rule.headers)headers.set(header.key,header.value);
  assert.equal(headers.get('access-control-allow-origin'),'*');
  assert.equal(headers.get('access-control-allow-credentials'),null);
  for(const method of ['GET','POST','DELETE','OPTIONS'])assert.ok(headers.get('access-control-allow-methods')?.split(/,\s*/).includes(method));
  for(const name of ['Authorization','Content-Type'])assert.ok(headers.get('access-control-allow-headers')?.includes(name));
 }
});
