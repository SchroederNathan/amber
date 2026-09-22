import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AppLockController } from '../src/lib/app-lock-controller.ts';

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function fixture(overrides = {}) {
  const writes = [];
  const deps = {
    readEnabled: async () => true,
    writeEnabled: async (value) => {
      writes.push(value);
    },
    enroll: async () => {},
    verify: async () => true,
    preparePrivacy: async () => {},
    ...overrides,
  };
  return { lock: new AppLockController(deps, true), writes };
}

test('restored session starts closed and a stored opt-in requires verification', async () => {
  const { lock } = fixture();
  assert.equal(lock.getSnapshot().status, 'loading');
  await lock.load();
  assert.equal(lock.getSnapshot().status, 'locked');
  assert.equal(await lock.authenticate('unlock'), true);
  assert.equal(lock.getSnapshot().status, 'unlocked');
});

test('failed policy reads and failed native privacy protection fail closed', async () => {
  for (const name of ['readEnabled', 'preparePrivacy']) {
    const { lock } = fixture({
      [name]: async () => {
        throw new Error('unavailable');
      },
    });
    await lock.load();
    assert.equal(lock.getSnapshot().status, 'error');
    assert.equal(await lock.authenticate('unlock'), false);
  }
});

test('cancellation, lockout, and invalidated keys never unlock or disable the policy', async () => {
  for (const verify of [
    async () => false,
    async () => {
      throw new Error('cancelled');
    },
  ]) {
    const { lock, writes } = fixture({ verify });
    await lock.load();
    assert.equal(await lock.authenticate('unlock'), false);
    assert.equal(await lock.authenticate('disable'), false);
    assert.equal(lock.getSnapshot().status, 'locked');
    assert.deepEqual(writes, []);
    assert.equal(lock.getSnapshot().busy, false);
  }
});

test('successful verification followed by an interruption relocks immediately', async () => {
  const { lock } = fixture();
  await lock.load();
  await lock.authenticate('unlock');
  lock.activityChanged('inactive');
  assert.equal(lock.getSnapshot().status, 'locked');
  lock.activityChanged('active');
  assert.equal(lock.getSnapshot().status, 'locked');
});

test('the biometric prompt itself may go inactive without a prompt loop', async () => {
  const result = deferred();
  const { lock } = fixture({ verify: () => result.promise });
  await lock.load();
  const unlock = lock.authenticate('unlock');
  lock.activityChanged('inactive');
  result.resolve(true);
  assert.equal(await unlock, true);
  assert.equal(lock.getSnapshot().foreground, false);
  lock.activityChanged('active');
  assert.equal(lock.getSnapshot().status, 'unlocked');
});

test('backgrounding rejects late success even if the app becomes active again', async () => {
  const result = deferred();
  const { lock } = fixture({ verify: () => result.promise });
  await lock.load();
  const unlock = lock.authenticate('unlock');
  lock.activityChanged('background');
  lock.activityChanged('active');
  result.resolve(true);
  assert.equal(await unlock, false);
  assert.equal(lock.getSnapshot().status, 'locked');
});

test('duplicate unlock taps cannot launch concurrent prompts', async () => {
  const result = deferred();
  let prompts = 0;
  const { lock } = fixture({
    verify: () => {
      prompts++;
      return result.promise;
    },
  });
  await lock.load();
  const first = lock.authenticate('unlock');
  assert.equal(await lock.authenticate('unlock'), false);
  result.resolve(true);
  await first;
  assert.equal(prompts, 1);
});

test('account/session disposal ignores pending biometric success', async () => {
  const result = deferred();
  const { lock } = fixture({ verify: () => result.promise });
  await lock.load();
  const unlock = lock.authenticate('unlock');
  lock.dispose();
  result.resolve(true);
  assert.equal(await unlock, false);
  assert.equal(lock.getSnapshot().status, 'locked');
});

test('opt-in persists only after enrollment and widget/snapshot protection succeed', async () => {
  for (const step of ['enroll', 'preparePrivacy']) {
    const { lock, writes } = fixture({
      readEnabled: async () => false,
      [step]: async () => {
        throw new Error('failed');
      },
    });
    await lock.load();
    assert.equal(await lock.authenticate('enable'), false);
    assert.deepEqual(writes, []);
    assert.equal(lock.getSnapshot().status, 'disabled');
  }
  const { lock, writes } = fixture({ readEnabled: async () => false });
  await lock.load();
  assert.equal(await lock.authenticate('enable'), true);
  assert.deepEqual(writes, [true]);
  assert.equal(lock.getSnapshot().status, 'unlocked');
});

test('a late opt-in policy write after backgrounding leaves the app locked', async () => {
  const saved = deferred();
  const { lock } = fixture({
    readEnabled: async () => false,
    writeEnabled: () => saved.promise,
  });
  await lock.load();
  const enable = lock.authenticate('enable');
  await new Promise((resolve) => setImmediate(resolve));
  lock.activityChanged('background');
  saved.resolve();
  assert.equal(await enable, false);
  assert.equal(lock.getSnapshot().status, 'locked');
});

test('failed opt-out write preserves protection', async () => {
  const { lock } = fixture({
    writeEnabled: async () => {
      throw new Error('disk full');
    },
  });
  await lock.load();
  await lock.authenticate('unlock');
  assert.equal(await lock.authenticate('disable'), false);
  assert.equal(lock.getSnapshot().status, 'unlocked');
  lock.activityChanged('background');
  assert.equal(lock.getSnapshot().status, 'locked');
});

test('an opted-out account does not require biometric hardware or a prompt', async () => {
  const { lock } = fixture({ readEnabled: async () => false });
  await lock.load();
  lock.activityChanged('background');
  lock.activityChanged('active');
  assert.equal(lock.getSnapshot().status, 'disabled');
  assert.equal(await lock.authenticate('unlock'), false);
});
