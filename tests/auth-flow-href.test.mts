import test from 'node:test';
import assert from 'node:assert/strict';
import {authFlowHref} from '../src/lib/authFlowHref.ts';
test('registration and password recovery keep the original public action context', () => {
 const next='/contests/example#participation';
 for(const path of ['/auth/signup','/auth/login','/auth/forgot-password','/auth/reset-password']) {
  const href=authFlowHref(path,'?next='+encodeURIComponent(next));
  assert.equal(new URL(href,'https://cbgpu.com').searchParams.get('next'),next);
 }
});
test('auth links do not propagate tokens, provider params or external redirects', () => {
 for(const next of ['//evil.invalid','https://evil.invalid','/auth/transfer?code=secret','/?access_token=secret','/%252fevil.invalid']) {
  const href=authFlowHref('/auth/signup','?next='+encodeURIComponent(next)+'&access_token=provider-secret');
  assert.equal(href,'/auth/signup?next=%2F');
 }
 assert.equal(authFlowHref('/auth/login','?code=provider-secret'),'/auth/login');
});

test('explicit return context overrides a fallback school onboarding link without duplicate query markers',()=>{assert.equal(authFlowHref('/auth/login?next=%2Fschools%2Fnew','?next=%2Fcontests%2Fexample'),'/auth/login?next=%2Fcontests%2Fexample');assert.equal(authFlowHref('/auth/login?next=%2Fschools%2Fnew',''),'/auth/login?next=%2Fschools%2Fnew')});
