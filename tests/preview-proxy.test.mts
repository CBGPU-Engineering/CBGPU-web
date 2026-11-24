import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { trustedInternalServiceUrl } from '../src/lib/internalServiceUrl.ts';
const code = readFileSync(new URL('../src/lib/previewProxyTarget.ts', import.meta.url), 'utf8');
const exports: Record<string, typeof import('../src/lib/previewProxyTarget').previewProxyTarget> = {};
runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
  exports, URL, decodeURIComponent,
  require(name: string) { assert.equal(name, './internalServiceUrl'); return { trustedInternalServiceUrl }; },
});
const { previewProxyTarget } = exports;

const origin = 'http://127.0.0.1:14630';

test('preview marks an exact opt-in apex-only read zone', () => {
  for (const pathname of ['/new', '/new/', '/new/ai', '/new/_next/static/main.js']) {
    assert.equal(previewProxyTarget('cbgpu.com', 'GET', pathname, '?query=menu', origin)?.href,
      origin + pathname + '?query=menu');
  }
  assert.equal(previewProxyTarget('www.cbgpu.com', 'HEAD', '/new', '', origin)?.href, origin + '/new');
  for (const [host, method, pathname] of [
    ['admin.cbgpu.com', 'GET', '/new'], ['app.cbgpu.com', 'GET', '/new'],
    ['cbgpu.com', 'POST', '/new'], ['cbgpu.com', 'GET', '/newsletter'],
    ['cbgpu.com', 'GET', '/api/contests'], ['cbgpu.com', 'GET', '/backend/auth/v1/token'],
  ]) assert.equal(previewProxyTarget(host, method, pathname, '', origin), null);
  assert.equal(previewProxyTarget('cbgpu.com', 'GET', '/new', ''), null);
});

test('preview never rewrites outside a declared loopback origin', () => {
  for (const outside of ['http://server.internal', 'https://example.com', origin + '/other', origin + '?a=b', 'http://a@127.0.0.1:42']) {
    assert.throws(() => previewProxyTarget('cbgpu.com', 'GET', '/new', '', outside));
  }
  for (const escape of ['/new/%2fadmin', '/new/%252fadmin', '/new/%2e%2e/admin', '/new/%00', '/new/\\admin']) {
    assert.throws(() => previewProxyTarget('cbgpu.com', 'GET', escape, '', origin));
  }
});
