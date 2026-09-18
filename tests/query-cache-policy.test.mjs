import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { dehydrate, QueryClient, QueryObserver } from '@tanstack/react-query';
import {
  relatedItemsQueryPolicy,
  restorePersistentClient,
  shouldDehydrateAppQuery,
} from '../src/lib/query-cache-policy.ts';

const savedKey = ['convexQuery', 'items:getItem', { id: 'saved-1' }];
const relatedKey = ['convexQuery', 'items:similarItems', { id: 'saved-1' }];

test('dehydration preserves saved items and omits derived and pending queries', () => {
  const client = new QueryClient({
    defaultOptions: {
      dehydrate: { shouldDehydrateQuery: shouldDehydrateAppQuery },
    },
  });
  try {
    client.setQueryData(savedKey, { title: 'Available offline' });
    client.setQueryData(relatedKey, [{ title: 'Derived recommendation' }]);
    client.getQueryCache().build(client, { queryKey: ['pending'] });
    client.setQueryDefaults(['ephemeral'], { meta: { persist: false } });
    client.setQueryData(['ephemeral'], { temporary: true });

    const state = dehydrate(client);
    assert.deepEqual(state.queries.map((query) => query.queryKey), [savedKey]);
    assert.deepEqual(state.queries[0].state.data, { title: 'Available offline' });
  } finally {
    client.clear();
  }
});

test('restore removes legacy related results without discarding offline saves', () => {
  const client = new QueryClient();
  try {
    client.setQueryData(savedKey, { title: 'Available offline' });
    // Simulate the old persisted format, without the new persist:false meta.
    client.setQueryData(relatedKey, [{ title: 'Previously cached result' }]);
    const restored = restorePersistentClient(JSON.stringify({
      buster: 'v1',
      timestamp: 123,
      clientState: dehydrate(client),
    }));

    assert.equal(restored.buster, 'v1');
    assert.equal(restored.timestamp, 123);
    assert.deepEqual(restored.clientState.queries.map((query) => query.queryKey), [savedKey]);
  } finally {
    client.clear();
  }
});

test('derived results are removed 30 seconds after their last observer leaves', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: 24 * 60 * 60 * 1000 } },
  });
  const observer = new QueryObserver(client, {
    queryKey: relatedKey,
    initialData: [],
    staleTime: Infinity,
    ...relatedItemsQueryPolicy,
  });
  try {
    const unsubscribe = observer.subscribe(() => {});
    context.mock.timers.tick(60_000);
    assert.ok(client.getQueryCache().find({ queryKey: relatedKey }));
    unsubscribe();
    context.mock.timers.tick(29_999);
    assert.ok(client.getQueryCache().find({ queryKey: relatedKey }));
    context.mock.timers.tick(1);
    assert.equal(client.getQueryCache().find({ queryKey: relatedKey }), undefined);
  } finally {
    observer.destroy();
    client.clear();
  }
});
