import test from 'node:test';
import assert from 'node:assert/strict';
import { isNativeBearerRequest, writeOriginAllowed, schoolRequestOriginAllowed } from '../src/lib/schoolsProxySecurity.ts';

const h = (init: Record<string, string>) => new Headers(init);
const bearer = 'Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature';
const same = (value: string) => value === 'https://cbgpu.com';

test('a native app (Bearer, no Origin, no cookie, no browser metadata) may write', () => {
  assert.equal(isNativeBearerRequest(h({ authorization: bearer })), true);
  assert.equal(isNativeBearerRequest(h({ 'x-cbgpu-auth': 'eyJhbGciOiJIUzI1NiJ9.payload.signature' })), true, 'study routes use x-cbgpu-auth');
  assert.equal(isNativeBearerRequest(h({ 'x-cbgpu-auth': bearer })), true);
  assert.equal(writeOriginAllowed(null, h({ authorization: bearer }), same), true);
});

test('anything that looks like a browser is still held to the Origin rule', () => {
  // a web page can attach cookies and always sends Origin / Sec-Fetch-* on a cross-site write
  assert.equal(isNativeBearerRequest(h({ authorization: bearer, cookie: 'sb-access-token=abc' })), false, 'ambient credentials');
  for (const meta of ['sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest'])
    assert.equal(isNativeBearerRequest(h({ authorization: bearer, [meta]: 'cross-site' })), false, meta);
  assert.equal(isNativeBearerRequest(h({ authorization: bearer, origin: 'https://evil.example' })), false);
  assert.equal(writeOriginAllowed('https://evil.example', h({ authorization: bearer }), same), false, 'a present foreign Origin is rejected even with a Bearer token');
  assert.equal(writeOriginAllowed('https://cbgpu.com', h({}), same), true, 'our own pages keep working without a token header');
  assert.equal(writeOriginAllowed('https://cbgpu.com.evil.example', h({}), same), false);
});

test('no credentials, or a malformed one, never passes without an Origin', () => {
  assert.equal(isNativeBearerRequest(h({})), false);
  assert.equal(writeOriginAllowed(null, h({}), same), false);
  for (const bad of ['Bearer', 'Bearer ', 'Basic abc', 'Bearer a b', 'Bearer a,b', 'bearerabc', `Bearer ${'x'.repeat(32769)}`])
    assert.equal(isNativeBearerRequest(h({ authorization: bad })), false, bad.slice(0, 20));
  assert.equal(isNativeBearerRequest(h({ 'x-cbgpu-auth': 'a b' })), false);
  assert.equal(isNativeBearerRequest(h({ 'x-cbgpu-auth': '' })), false);
});

test('school/GPU/arcade proxies: unchanged for callers that pass no headers, native-aware when they do', () => {
  assert.equal(schoolRequestOriginAllowed('cbgpu.com', null), false, 'old two-argument behaviour is preserved (admin BFF stays browser-only)');
  assert.equal(schoolRequestOriginAllowed('cbgpu.com', 'https://cbgpu.com'), true);
  assert.equal(schoolRequestOriginAllowed('cbgpu.com', null, h({ authorization: bearer })), true);
  assert.equal(schoolRequestOriginAllowed('cbgpu.com', null, h({ authorization: bearer, cookie: 'a=b' })), false);
  assert.equal(schoolRequestOriginAllowed('cbgpu.com', 'https://evil.example', h({ authorization: bearer })), false);
  assert.equal(schoolRequestOriginAllowed('cbgpu.com', 'https://cbgpu.com.evil.example', h({ authorization: bearer })), false);
  assert.equal(schoolRequestOriginAllowed('admin.cbgpu.com', 'https://cbgpu.com', h({ authorization: bearer })), false, 'host and Origin must still match');
});
