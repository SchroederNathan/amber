import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createIntentDelivery, InvalidAppIntent } from '../src/lib/app-intent-delivery.ts';

const invocation = { id: 'one', name: 'saveNote' };
function setup(overrides = {}) {
  const handled = new Set();
  const applied = [];
  const acknowledged = [];
  const errors = [];
  const operations = {
    isActive: () => true,
    isHandled: (id) => handled.has(id),
    markHandled: (id) => handled.add(id),
    handle: async ({ id }) => { applied.push(id); return true; },
    acknowledge: async (id) => { acknowledged.push(id); },
    onError: (_, error) => errors.push(error),
    ...overrides,
  };
  return { operations, handled, applied, acknowledged, errors, deliver: createIntentDelivery(operations) };
}

test('overlapping queue snapshots apply each invocation once', async () => {
  const state = setup();
  await Promise.all([state.deliver([invocation]), state.deliver([invocation])]);
  assert.deepEqual(state.applied, ['one']);
  assert.deepEqual(state.acknowledged, ['one', 'one']);
});

test('acknowledgement failure retries removal after remount without repeating the action', async () => {
  let fail = true;
  const state = setup({ acknowledge: async () => { if (fail) throw new Error('native write failed'); } });
  await state.deliver([invocation]);
  fail = false;
  await createIntentDelivery(state.operations)([invocation]);
  assert.deepEqual(state.applied, ['one']);
  assert.equal(state.errors.length, 1);
});

test('transient failures remain pending and do not block unrelated actions', async () => {
  let fail = true;
  const state = setup({ handle: async ({ id }) => { if (id === 'one' && fail) throw new Error('offline'); return true; } });
  await state.deliver([invocation, { id: 'two', name: 'search' }]);
  assert.deepEqual(state.acknowledged, ['two']);
  assert.equal(state.handled.has('one'), false);
  fail = false;
  await state.deliver([invocation]);
  assert.deepEqual(state.acknowledged, ['two', 'one']);
});

test('unknown actions stay pending; permanently invalid known actions are reported and removed', async () => {
  const state = setup({ handle: async ({ name }) => {
    if (name === 'unknown') return false;
    throw new InvalidAppIntent('Missing text');
  } });
  await state.deliver([{ id: 'unknown', name: 'unknown' }, invocation]);
  assert.deepEqual(state.acknowledged, ['one']);
  assert.equal(state.errors.length, 1);
});

test('unmount during an action leaves the queue for the next authenticated consumer', async () => {
  let active = true;
  const state = setup({ isActive: () => active, handle: async () => { active = false; return true; } });
  await state.deliver([invocation, { id: 'two', name: 'search' }]);
  assert.deepEqual(state.acknowledged, []);
  assert.equal(state.handled.size, 0);
});
