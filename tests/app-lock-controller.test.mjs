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
function fixture(overrides = {}, options = {}) {
  const writes = [];
  const clock = { now: 0 };
  const deps = {
    readEnabled: async () => true,
    writeEnabled: async (value) => {
      writes.push(value);
    },
    enroll: async () => {},
    verify: async () => true,
    preparePrivacy: async () => {},
    releasePrivacy: async () => {},
    ...overrides,
  };
  const lock = new AppLockController(deps, true, {
    graceMs: 120_000,
    autoPrompt: false,
    now: () => clock.now,
    ...options,
  });
  return { lock, writes, clock };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));

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

test('a short interruption keeps the app unlocked', async () => {
  const { lock, clock } = fixture();
  await lock.load();
  await lock.authenticate('unlock');
  lock.activityChanged('inactive');
  lock.activityChanged('background');
  clock.now = 119_999;
  lock.activityChanged('active');
  assert.equal(lock.getSnapshot().status, 'unlocked');
});

test('two minutes away relocks, counted from when the app first left', async () => {
  const { lock, clock } = fixture();
  await lock.load();
  await lock.authenticate('unlock');
  lock.activityChanged('inactive');
  clock.now = 60_000;
  lock.activityChanged('background');
  clock.now = 120_000;
  lock.activityChanged('active');
  assert.equal(lock.getSnapshot().status, 'locked');
});

test('a clock moved backwards relocks', async () => {
  const { lock, clock } = fixture();
  clock.now = 500_000;
  await lock.load();
  await lock.authenticate('unlock');
  lock.activityChanged('background');
  clock.now = 0;
  lock.activityChanged('active');
  assert.equal(lock.getSnapshot().status, 'locked');
});

test('the lock prompts automatically on launch and after the grace period', async () => {
  let prompts = 0;
  const { lock, clock } = fixture(
    { verify: async () => (++prompts, true) },
    { autoPrompt: true },
  );
  await lock.load();
  await settle();
  assert.equal(prompts, 1);
  assert.equal(lock.getSnapshot().status, 'unlocked');
  lock.activityChanged('background');
  clock.now = 120_000;
  lock.activityChanged('active');
  await settle();
  assert.equal(prompts, 2);
  assert.equal(lock.getSnapshot().status, 'unlocked');
});

test('a cancelled automatic prompt waits for a tap or the next return', async () => {
  let prompts = 0;
  const { lock } = fixture(
    { verify: async () => (++prompts, false) },
    { autoPrompt: true },
  );
  await lock.load();
  await settle();
  // The dismissed prompt makes iOS inactive, then active again.
  lock.activityChanged('inactive');
  lock.activityChanged('active');
  await settle();
  assert.equal(prompts, 1);
  assert.equal(lock.getSnapshot().status, 'locked');
  lock.activityChanged('background');
  lock.activityChanged('active');
  await settle();
  assert.equal(prompts, 2);
});

test('no automatic prompt starts while Amber is in the background', async () => {
  let prompts = 0;
  const { lock } = fixture(
    { verify: async () => (++prompts, true) },
    { autoPrompt: true },
  );
  lock.activityChanged('background');
  await lock.load();
  await settle();
  assert.equal(prompts, 0);
  lock.activityChanged('active');
  await settle();
  assert.equal(prompts, 1);
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
  const { lock, clock } = fixture({
    writeEnabled: async () => {
      throw new Error('disk full');
    },
  });
  await lock.load();
  await lock.authenticate('unlock');
  assert.equal(await lock.authenticate('disable'), false);
  assert.equal(lock.getSnapshot().status, 'unlocked');
  lock.activityChanged('background');
  clock.now = 120_000;
  lock.activityChanged('active');
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

test('turning the lock off lifts screen protection, and a failed lift still disables', async () => {
  let released = 0;
  const { lock, writes } = fixture({ releasePrivacy: async () => { released++; } });
  await lock.load();
  assert.equal(await lock.authenticate('disable'), true);
  assert.equal(released, 1);
  assert.deepEqual(writes, [false]);

  const failing = fixture({ releasePrivacy: async () => { throw new Error('unavailable'); } });
  await failing.lock.load();
  assert.equal(await failing.lock.authenticate('disable'), true);
  assert.equal(failing.lock.getSnapshot().status, 'disabled');
});
