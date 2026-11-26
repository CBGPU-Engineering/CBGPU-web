import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as schoolsProxySecurity from '../src/lib/schoolsProxySecurity.ts';

const jwt = 'h.' + Buffer.from(JSON.stringify({ session_id: 'sess-1' })).toString('base64url') + '.s';
const source = ts.transpileModule(fs.readFileSync(new URL('../src/app/api/latex/[action]/route.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function load(user: unknown, upstream: (url: string, init: RequestInit) => Promise<Response>) {
  const exports: Record<string, any> = {};
  vm.runInNewContext(source, {
    exports, Buffer, AbortSignal, JSON, Map, Set, Date, console: { error() {} },
    fetch: upstream,
    require: (name: string) => ({
      'next/server': { NextResponse: { json: (data: unknown, init?: ResponseInit) => Response.json(data, init) } },
      'node:fs/promises': { readFile: async () => 'synthetic-bridge-key\n' },
      '@/lib/preprintsServer': { personalProjectUser: async () => user },
      '@/lib/schoolsProxySecurity': schoolsProxySecurity,
    } as Record<string, unknown>)[name] ?? (() => { throw Error('Unexpected module ' + name); })(),
  });
  return exports;
}
const ctx = (action: string) => ({ params: Promise.resolve({ action }) });
const post = (headers: Record<string, string>, action = 'new') => new Request('https://cbgpu.com/api/latex/' + action, { method: 'POST', headers: { host: 'cbgpu.com', 'content-type': 'application/json', ...headers }, body: '{"title":"t"}' });
const user = { id: 'u1', email: 'u1@example.invalid', user_metadata: { full_name: 'U One' } };

test('the app (Bearer, no Origin, no cookie) can create a paper and import a ZIP; browsers keep the Origin rule', async () => {
  const calls: { url: string; identity: string }[] = [];
  const route = load(user, async (url, init) => { calls.push({ url, identity: (init.headers as Record<string, string>)['X-CBGPU-Identity'] }); return Response.json({ ok: true }); });
  for (const action of ['new', 'import', 'upload-begin', 'upload-chunk', 'upload-finish']) {
    const r = await route.POST(post({ authorization: `Bearer ${jwt}` }, action), ctx(action));
    assert.equal(r.status, 200, action);
  }
  assert.equal(calls.length, 5); assert.ok(calls.every(c => c.url.startsWith('http://127.0.0.1:3520/_api/')));
  assert.equal(JSON.parse(Buffer.from(calls[0].identity, 'base64').toString()).id, 'u1', 'identity still comes from the verified token');
  const before = calls.length;
  for (const [label, headers] of Object.entries({
    'own page': { authorization: `Bearer ${jwt}`, origin: 'https://cbgpu.com' },
  })) assert.equal((await route.POST(post(headers), ctx('new'))).status, 200, label);
  for (const [label, headers] of Object.entries({
    'foreign Origin': { authorization: `Bearer ${jwt}`, origin: 'https://evil.example' },
    'suffix-spoofed Origin': { authorization: `Bearer ${jwt}`, origin: 'https://cbgpu.com.evil.example' },
    'cookie without Origin': { authorization: `Bearer ${jwt}`, cookie: 'sb=1' },
    'browser metadata without Origin': { authorization: `Bearer ${jwt}`, 'sec-fetch-site': 'cross-site' },
    'no credentials': {},
  })) assert.equal((await route.POST(post(headers), ctx('new'))).status, 403, label);
  assert.equal(calls.length, before + 1, 'rejected requests never reach the editor service');
});

test('authentication and host rules are unchanged', async () => {
  const anonymous = load(null, async () => Response.json({}));
  assert.equal((await anonymous.POST(post({ authorization: `Bearer ${jwt}` }), ctx('new'))).status, 401, 'an invalid token is still rejected');
  const route = load(user, async () => Response.json({}));
  assert.equal((await route.POST(new Request('https://evil.example/api/latex/new', { method: 'POST', headers: { host: 'evil.example', authorization: `Bearer ${jwt}` }, body: '{}' }), ctx('new'))).status, 404);
  assert.equal((await route.POST(post({ authorization: `Bearer ${jwt}` }, 'not-an-action'), ctx('not-an-action'))).status, 404);
});
