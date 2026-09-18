import { defaultShouldDehydrateQuery, type Query } from '@tanstack/react-query';
import type { PersistedClient } from '@tanstack/react-query-persist-client';

// Similar results are derived data, not an offline copy of the user's saves.
// Convex keeps the subscription alive until TanStack removes the query.
export const relatedItemsQueryPolicy = {
  gcTime: 30_000,
  meta: { persist: false },
} as const;

function isPersistentQuery(query: {
  queryKey: Query['queryKey'];
  meta?: Query['meta'];
}): boolean {
  // Recognize old cache entries too: they were persisted before meta existed.
  const isRelatedItems =
    query.queryKey[0] === 'convexQuery' &&
    query.queryKey[1] === 'items:similarItems';
  return query.meta?.persist !== false && !isRelatedItems;
}

export function shouldDehydrateAppQuery(query: Query): boolean {
  return isPersistentQuery(query) && defaultShouldDehydrateQuery(query);
}

export function restorePersistentClient(cache: string): PersistedClient {
  const client: PersistedClient = JSON.parse(cache);
  return {
    ...client,
    clientState: {
      ...client.clientState,
      queries: client.clientState.queries.filter(isPersistentQuery),
    },
  };
}
