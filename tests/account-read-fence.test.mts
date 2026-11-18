import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountReadFence } from '../src/lib/accountReadFence.ts';

test('delayed profile and printer roles cannot restore a signed-out or different account', async () => {
  const fence = createAccountReadFence();
  fence.setOwner('first');
  let finish!: () => void;
  const response = new Promise<void>(resolve => { finish = resolve; });
  const current = fence.lease('first');
  let role = '';
  const pending = response.then(() => { if (current()) role = 'first-admin'; });
  fence.setOwner(null);
  fence.setOwner('second');
  finish();
  await pending;
  assert.equal(role, '');
  assert.equal(fence.lease('second')(), true);
});

test('returning to the same account does not revive reads from its previous session', () => {
  const fence = createAccountReadFence();
  fence.setOwner('first');
  const stale = fence.lease('first');
  fence.setOwner('second');
  fence.setOwner('first');
  assert.equal(stale(), false);
  assert.equal(fence.lease('first')(), true);
});

test('same-account token refresh preserves reads; provider disposal invalidates them', () => {
  const fence = createAccountReadFence();
  fence.setOwner('first');
  const read = fence.lease('first');
  assert.equal(fence.setOwner('first'), false);
  assert.equal(read(), true);
  fence.invalidate();
  assert.equal(read(), false);
  assert.equal(fence.lease('someone-else')(), false);
});
