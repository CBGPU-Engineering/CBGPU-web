import test from 'node:test';
import assert from 'node:assert/strict';
import { seededRandom, createArcadeRun } from '../src/lib/arcadeClient.ts';

test('xorshift32 matches replay protocol unsigned sequence', () => {
  const random = seededRandom(1);
  assert.deepEqual(Array.from({ length: 5 }, () => random() * 4294967296), [270369, 67634689, 2647435461, 307599695, 2398689233]);
  assert.equal(seededRandom(0xffffffff)(), 253983 / 4294967296);
});

test('local play never requests ranking and ranked submit is idempotent without claimed score', async () => {
  const original = globalThis.fetch;
  const calls: { url: string; body: unknown }[] = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return Response.json(calls.length === 1 ? { id: 'session-1', seed: 1 } : { score: 4 });
  };
  try {
    const local = await createArcadeRun('2048', false);
    local.record('left');
    assert.equal(await local.finish(), false);
    assert.equal(calls.length, 0);
    const ranked = await createArcadeRun('2048', true);
    assert.equal(ranked.random(), seededRandom(1)());
    ranked.record('left');
    assert.deepEqual(await Promise.all([ranked.finish(), ranked.finish()]), [true, true]);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1].body, { actions: ['left'] });
  } finally { globalThis.fetch = original; }
});

test('unavailable sessions preserve local play, oversized replay is never submitted', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('', { status: 503 }); };
  try {
    const local = await createArcadeRun('memory', true, { pairs: 6 });
    local.record(1);
    assert.equal(await local.finish(), false);
    assert.equal(calls, 1);
    globalThis.fetch = async () => { calls++; return Response.json({ id: 'bounded', seed: 4 }); };
    const ranked = await createArcadeRun('mines', true, { level: 'easy' });
    for (let i = 0; i < 20001; i++) ranked.record({ type: 'flag', r: 0, c: 0 });
    assert.equal(await ranked.finish(), false);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});
