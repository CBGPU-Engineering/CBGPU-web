import test from 'node:test';
import assert from 'node:assert/strict';
import { seededRandom, createArcadeRun } from '../src/lib/arcadeClient.ts';

const credential = async () => ({ userId: 'fixture-user', accessToken: 'fixture-start-token' });

test('xorshift32 matches replay protocol unsigned sequence', () => {
  const random = seededRandom(1);
  assert.deepEqual(Array.from({ length: 5 }, () => random() * 4294967296), [270369, 67634689, 2647435461, 307599695, 2398689233]);
  assert.equal(seededRandom(0xffffffff)(), 253983 / 4294967296);
});

test('local play never requests ranking and ranked submit is idempotent without claimed score', async () => {
  const original = globalThis.fetch;
  const calls: { url: string; body: unknown; auth: string | null }[] = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)), auth: new Headers(init?.headers).get('Authorization') });
    return Response.json(calls.length === 1 ? { id: 'session-1', seed: 1 } : { score: 4 });
  };
  try {
    const local = await createArcadeRun('2048', false);
    local.record('left');
    assert.equal(await local.finish(), false);
    assert.equal(calls.length, 0);
    const ranked = await createArcadeRun('2048', true, {}, credential);
    assert.equal(ranked.random(), seededRandom(1)());
    ranked.record('left');
    assert.deepEqual(await Promise.all([ranked.finish(), ranked.finish()]), [true, true]);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1].body, { actions: ['left'] });
    assert.equal(calls[0].auth, 'Bearer fixture-start-token');
    assert.equal(calls[1].auth, 'Bearer fixture-start-token');
  } finally { globalThis.fetch = original; }
});

test('unavailable sessions preserve local play, oversized replay is never submitted', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('', { status: 503 }); };
  try {
    const local = await createArcadeRun('memory', true, { pairs: 6 }, credential);
    local.record(1);
    assert.equal(await local.finish(), false);
    assert.equal(calls, 1);
    globalThis.fetch = async () => { calls++; return Response.json({ id: 'bounded', seed: 4 }); };
    const ranked = await createArcadeRun('mines', true, { level: 'easy' }, credential);
    for (let i = 0; i < 20001; i++) ranked.record({ type: 'flag', r: 0, c: 0 });
    assert.equal(await ranked.finish(), false);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});


test('missing credentials never fetch; changed or signed out owners cannot submit', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ id: 'owner-bound', seed: 3 }); };
  try {
    const anonymous = await createArcadeRun('2048', true);
    assert.equal(anonymous.ranked, false);
    assert.equal(calls, 0);
    for (const replacement of [null, { userId: 'fixture-other', accessToken: 'fixture-other-token' }]) {
      let auth: { userId: string; accessToken: string } | null = await credential();
      const run = await createArcadeRun('2048', true, {}, async () => auth);
      run.record('left');
      auth = replacement;
      const before = calls;
      assert.equal(await run.finish(), false);
      assert.equal(calls, before);
    }
  } finally { globalThis.fetch = original; }
});

test('submit uses the refreshed bearer for the original owner', async () => {
  const original = globalThis.fetch;
  const bearers: (string | null)[] = [];
  let token = 'fixture-initial';
  globalThis.fetch = async (_url, init) => {
    bearers.push(new Headers(init?.headers).get('Authorization'));
    return Response.json({ id: 'refreshed', seed: 7 });
  };
  try {
    const run = await createArcadeRun('2048', true, {}, async () => ({ userId: 'fixture-user', accessToken: token }));
    run.record('left'); token = 'fixture-refreshed';
    assert.equal(await run.finish(), true);
    assert.deepEqual(bearers, ['Bearer fixture-initial', 'Bearer fixture-refreshed']);
  } finally { globalThis.fetch = original; }
});
