import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { canResetLock } from '../src/lib/app-lock-recovery.ts';

test('recovery requires an explicit request and a new session for the original account', () => {
  const request = { userId: 'account-a', sessionId: 'session-old' };
  assert.equal(canResetLock(null, 'account-a', 'session-new'), false);
  assert.equal(canResetLock(request, 'account-a', 'session-old'), false);
  assert.equal(canResetLock(request, 'account-b', 'session-new'), false);
  assert.equal(canResetLock(request, 'account-a', 'session-new'), true);
});
