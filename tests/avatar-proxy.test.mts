import test from 'node:test';
import assert from 'node:assert/strict';
import { createAvatarProxy, parseAvatarRequest, AVATAR_LIMITS, fallbackAvatarSvg } from '../src/lib/avatarProxy.ts';

const seed = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
const q = (s: string, size = '256') => new URLSearchParams({ seed: s, size });
const request = (s: string, size = 256) => parseAvatarRequest('9.x', 'thumbs', 'png', q(s, String(size))) as any;
const upstreamOk = () => new Response(png, { status: 200, headers: { 'content-type': 'image/png' } });

test('only the exact URL shape the database produces is accepted', () => {
  assert.deepEqual(parseAvatarRequest('9.x', 'thumbs', 'png', q(seed(1))), { version: '9.x', style: 'thumbs', format: 'png', seed: seed(1), size: 256 });
  for (const bad of ['alice', 'kim.minseo@example.com', '20231234', '../etc/passwd', 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA', seed(1) + '&x=1'])
    assert.ok('error' in (parseAvatarRequest('9.x', 'thumbs', 'png', q(bad)) as object), `seed ${bad}`);
  assert.ok('error' in (parseAvatarRequest('9.x', 'thumbs', 'png', q(seed(1), '100')) as object), 'sizes are a fixed set');
  assert.ok('error' in (parseAvatarRequest('9.x', 'thumbs', 'png', q(seed(1), '99999')) as object));
  assert.ok('error' in (parseAvatarRequest('9.x', 'thumbs', 'png', new URLSearchParams(`seed=${seed(1)}&size=256&backgroundColor=ff0000`)) as object), 'no extra options');
  for (const [v, s, f] of [['latest', 'thumbs', 'png'], ['9.x', '../x', 'png'], ['9.x', 'thumbs', 'gif'], ['9.x', 'thumbs', 'png/../x'], ['9.x', 'Thumbs', 'png']] as const)
    assert.ok('error' in (parseAvatarRequest(v, s, f, q(seed(1))) as object), `${v}/${s}/${f}`);
});

test('first request fetches the provider once, later ones come from our cache with long cache headers', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const proxy = createAvatarProxy({ fetch: async (url: any, init: any) => { calls.push({ url: String(url), init }); return upstreamOk(); } });
  const first = await proxy.serve(request(seed(1)), '1.1.1.1');
  assert.equal(first.status, 200); assert.equal(first.headers['X-Avatar-Cache'], 'miss');
  assert.match(first.headers['Cache-Control'], /public/); assert.match(first.headers['Cache-Control'], /immutable/);
  assert.equal(first.headers['Content-Type'], 'image/png');
  const again = await proxy.serve(request(seed(1)), '2.2.2.2');
  assert.equal(again.headers['X-Avatar-Cache'], 'hit'); assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `https://api.dicebear.com/9.x/thumbs/png?seed=${seed(1)}&size=256`);
  // privacy: nothing about the viewer reaches the provider
  const sent = JSON.stringify(calls[0].init.headers).toLowerCase();
  for (const leak of ['cookie', 'authorization', 'x-forwarded-for', '1.1.1.1', '2.2.2.2', 'referer']) assert.ok(!sent.includes(leak), leak);
  assert.equal(calls[0].init.redirect, 'error'); assert.ok(calls[0].init.signal, 'has a timeout');
});

test('concurrent requests for the same avatar cost one provider request', async () => {
  let calls = 0, release!: () => void; const gate = new Promise<void>(r => (release = r));
  const proxy = createAvatarProxy({ fetch: async () => { calls++; await gate; return upstreamOk(); } });
  const all = Promise.all(Array.from({ length: 6 }, (_, i) => proxy.serve(request(seed(2)), `9.9.9.${i}`)));
  release(); const replies = await all;
  assert.equal(calls, 1); assert.ok(replies.every(r => r.status === 200));
});

test('provider failure: stale copy first, otherwise a local placeholder that is retried soon', async () => {
  let t = 1_000_000, up = true;
  const proxy = createAvatarProxy({ now: () => t, fetch: async () => { if (!up) throw new Error('provider down'); return upstreamOk(); } });
  assert.equal((await proxy.serve(request(seed(3)), 'a')).headers['X-Avatar-Cache'], 'miss');
  up = false; t += AVATAR_LIMITS.fresh + 1000;
  const stale = await proxy.serve(request(seed(3)), 'a');
  assert.equal(stale.status, 200); assert.equal(stale.headers['X-Avatar-Cache'], 'stale'); assert.equal(stale.headers['Content-Type'], 'image/png');
  const none = await proxy.serve(request(seed(4)), 'a');
  assert.equal(none.status, 200); assert.equal(none.headers['X-Avatar-Fallback'], '1'); assert.equal(none.headers['Content-Type'], 'image/svg+xml');
  assert.match(none.headers['Cache-Control'], /max-age=300/); assert.ok(!/immutable/.test(none.headers['Cache-Control']));
  assert.match(String(none.body), /^<svg /); assert.equal(none.body, fallbackAvatarSvg(seed(4)), 'deterministic per seed');
  assert.notEqual(fallbackAvatarSvg(seed(4)), fallbackAvatarSvg(seed(5)));
  up = true; assert.equal((await proxy.serve(request(seed(4)), 'a')).headers['X-Avatar-Cache'], 'miss', 'recovers as soon as the provider is back');
});

test('wrong or oversized provider answers are never cached or relayed', async () => {
  for (const make of [
    () => new Response('<html>boom</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    () => new Response(png, { status: 500, headers: { 'content-type': 'image/png' } }),
    () => new Response(new Uint8Array(AVATAR_LIMITS.maxBody + 1), { status: 200, headers: { 'content-type': 'image/png' } }),
    () => new Response(new Uint8Array(0), { status: 200, headers: { 'content-type': 'image/png' } }),
  ]) {
    const proxy = createAvatarProxy({ fetch: async () => make() });
    const reply = await proxy.serve(request(seed(6)), 'a');
    assert.equal(reply.headers['X-Avatar-Fallback'], '1'); assert.equal(proxy.cacheSize(), 0);
  }
});

test('only cache misses are rate limited, per address; hits stay free', async () => {
  const proxy = createAvatarProxy({ fetch: async () => upstreamOk() });
  for (let i = 0; i < AVATAR_LIMITS.missesPerIpPerMinute; i++) assert.equal((await proxy.serve(request(seed(100 + i)), 'abuser')).status, 200);
  const limited = await proxy.serve(request(seed(999)), 'abuser');
  assert.equal(limited.status, 429); assert.equal(limited.headers['Retry-After'], '60'); assert.equal(limited.headers['Cache-Control'], 'no-store');
  assert.equal((await proxy.serve(request(seed(100)), 'abuser')).status, 200, 'an already cached avatar is still served');
  assert.equal((await proxy.serve(request(seed(998)), 'someone-else')).status, 200, 'other addresses are unaffected');
});

test('global provider pressure degrades to placeholders instead of failing pages', async () => {
  let release!: () => void; const gate = new Promise<void>(r => (release = r));
  const proxy = createAvatarProxy({ fetch: async () => { await gate; return upstreamOk(); } });
  const slow = Array.from({ length: AVATAR_LIMITS.concurrentUpstream }, (_, i) => proxy.serve(request(seed(200 + i)), `ip${i}`));
  const extra = await proxy.serve(request(seed(300)), 'ipX');
  assert.equal(extra.status, 200); assert.equal(extra.headers['X-Avatar-Fallback'], '1');
  release(); await Promise.all(slow);
});

test('the cache is bounded', async () => {
  const proxy = createAvatarProxy({ fetch: async () => upstreamOk() });
  for (let i = 0; i < 40; i++) await proxy.serve(request(seed(400 + i)), `ip${i}`);
  assert.ok(proxy.cacheSize() <= AVATAR_LIMITS.entries);
});

test('switching avatar_settings.base_url to this proxy needs no client change: the database URL is accepted as-is', () => {
  // base_url = https://cbgpu.com/api/avatars  ->  <base>/<version>/<style>/<format>?seed=<seed>&size=<size>
  const fromDatabase = new URL(`https://cbgpu.com/api/avatars/9.x/thumbs/png?seed=${seed(7)}&size=256`);
  const [, , , version, style, format] = fromDatabase.pathname.split('/');
  assert.deepEqual(parseAvatarRequest(version, style, format, fromDatabase.searchParams), { version: '9.x', style: 'thumbs', format: 'png', seed: seed(7), size: 256 });
});
