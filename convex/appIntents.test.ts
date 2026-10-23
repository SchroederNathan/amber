/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api, internal } from './_generated/api';
import schema from './schema';
import { sha256Hex } from './model/tokens';

const modules = import.meta.glob('./**/*.ts');

function setup() {
  const t = convexTest(schema, modules);
  return { t, user: t.withIdentity({ subject: 'alice' }) };
}

test('a native commit with a lost response is not repeated by JavaScript', async () => {
  const { t, user } = setup();
  const tokenHash = await sha256Hex('device-token');
  await t.mutation(internal.appIntents.storeCaptureToken, { userId: 'alice', tokenHash });
  const input = { requestId: 'native-request', kind: 'note' as const, text: 'Remember the ramen place' };
  const native = await t.mutation(internal.appIntents.captureInternal, { ...input, tokenHash });
  const replay = await user.mutation(api.appIntents.capture, input);
  expect(replay).toEqual(native);
  expect(await user.query(api.items.listItems, {})).toHaveLength(1);
});

test('concurrent delivery of one request commits one item and one receipt', async () => {
  const { t, user } = setup();
  const input = { requestId: 'same-request', kind: 'note' as const, text: 'Use less salt' };
  const results = await Promise.all([
    user.mutation(api.appIntents.capture, input),
    user.mutation(api.appIntents.capture, input),
  ]);
  expect(results[0]).toEqual(results[1]);
  expect(await t.run((ctx) => ctx.db.query('captureReceipts').take(10))).toHaveLength(1);
  expect(await user.query(api.items.listItems, {})).toHaveLength(1);
});

test('request IDs are scoped to the authenticated account', async () => {
  const { t, user } = setup();
  const input = { requestId: 'same-request', kind: 'note' as const, text: 'My note' };
  const alice = await user.mutation(api.appIntents.capture, input);
  const bob = await t.withIdentity({ subject: 'bob' }).mutation(api.appIntents.capture, input);
  expect(bob.itemId).not.toEqual(alice.itemId);
  expect(await user.query(api.items.listItems, {})).toHaveLength(1);
});

test('a delayed replay cannot resurrect a deleted capture', async () => {
  const { t, user } = setup();
  const input = { requestId: 'deleted-request', kind: 'note' as const, text: 'A temporary note' };
  const saved = await user.mutation(api.appIntents.capture, input);
  await t.run((ctx) => ctx.db.delete(saved.itemId));
  expect(await user.mutation(api.appIntents.capture, input)).toEqual(saved);
  expect(await user.query(api.items.listItems, {})).toHaveLength(0);
});

test('invalid inputs do not create receipts and can be corrected', async () => {
  const { t, user } = setup();
  await expect(user.mutation(api.appIntents.capture, { requestId: 'corrected', kind: 'link', url: 'file:///private/data' })).rejects.toThrow('Invalid URL');
  await expect(user.mutation(api.appIntents.capture, { requestId: 'empty-note', kind: 'note', text: ' ' })).rejects.toThrow('Invalid note text');
  await expect(user.mutation(api.appIntents.capture, { requestId: ' ', kind: 'note', text: 'Hello' })).rejects.toThrow('Invalid capture request ID');
  expect(await t.run((ctx) => ctx.db.query('captureReceipts').take(10))).toHaveLength(0);
  await user.mutation(api.appIntents.capture, { requestId: 'corrected', kind: 'link', url: 'https://example.com/recipe' });
  expect(await user.query(api.items.listItems, {})).toHaveLength(1);
});

test('stale and foreign spaces do not prevent captures or create foreign memberships', async () => {
  const { t, user } = setup();
  const spaceId = await t.run((ctx) => ctx.db.insert('spaces', { userId: 'bob', name: 'Private' }));
  await user.mutation(api.appIntents.capture, { requestId: 'foreign-space', kind: 'note', text: 'Hello', spaceId });
  await user.mutation(api.appIntents.capture, { requestId: 'stale-space', kind: 'note', text: 'Hello', spaceId: 'missing' });
  expect(await t.run((ctx) => ctx.db.query('spaceItems').take(10))).toHaveLength(0);
  expect(await user.query(api.items.listItems, {})).toHaveLength(2);
});

test('image replay retains sticker metadata and commits only once', async () => {
  const { t, user } = setup();
  const storageId = await t.run((ctx) => ctx.storage.store(new Blob(['png'], { type: 'image/png' })));
  const input = { requestId: 'image-request', kind: 'image' as const, storageId, aspectRatio: 0.75, isSticker: true, text: 'Siri: save this chair' };
  await user.mutation(api.appIntents.capture, input);
  await user.mutation(api.appIntents.capture, input);
  const items = await user.query(api.items.listItems, {});
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ isSticker: true, aspectRatio: 0.75, storageId });
  expect(items[0].captureContext).toBeUndefined();
});

test('revoked tokens cannot resolve an existing capture receipt', async () => {
  const { t, user } = setup();
  const input = { requestId: 'private-request', kind: 'note' as const, text: 'Private note' };
  await user.mutation(api.appIntents.capture, input);
  expect(await t.mutation(internal.appIntents.captureInternal, { ...input, tokenHash: 'revoked' })).toBeNull();
  await expect(t.mutation(api.appIntents.capture, input)).rejects.toThrow('Not authenticated');
});

test('HTTP capture preserves request IDs across retries and validates them before mutation', async () => {
  const { t, user } = setup();
  const token = 'native-http-token';
  await t.mutation(internal.appIntents.storeCaptureToken, { userId: 'alice', tokenHash: await sha256Hex(token) });
  const post = (body: unknown) => t.fetch('/app-intents/capture', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const input = { requestId: 'http-request', kind: 'note', text: 'Try the ramen place on 5th' };
  const first = await post(input);
  const retry = await post(input);
  expect(first.status).toBe(200);
  expect(await retry.json()).toEqual(await first.json());
  expect((await post({ ...input, requestId: 123 })).status).toBe(400);
  expect(await user.query(api.items.listItems, {})).toHaveLength(1);
});

test('receipt lookup is private and lets image replays skip another upload', async () => {
  const { t, user } = setup();
  const input = { requestId: 'lookup-request', kind: 'note' as const, text: 'Private note' };
  const saved = await user.mutation(api.appIntents.capture, input);
  expect(await user.query(api.appIntents.getCaptureResult, { requestId: input.requestId })).toEqual(saved);
  expect(await t.withIdentity({ subject: 'bob' }).query(api.appIntents.getCaptureResult, { requestId: input.requestId })).toBeNull();
  await expect(t.query(api.appIntents.getCaptureResult, { requestId: input.requestId })).rejects.toThrow('Not authenticated');
});
