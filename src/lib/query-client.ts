import { ConvexQueryClient } from '@convex-dev/react-query';
import { QueryClient } from '@tanstack/react-query';
import { ConvexReactClient } from 'convex/react';
import { createMMKV } from 'react-native-mmkv';

export function clearLegacyQueryCache() {
  // The old cache had neither account scoping nor encryption. Never hydrate it.
  createMMKV({ id: 'tanstack-query-cache' }).clearAll();
}

export function createPrivateQueryClients() {
  const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
    unsavedChangesWarning: false,
  });
  const adapter = new ConvexQueryClient(convex);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: adapter.hashFn(),
        queryFn: adapter.queryFn(),
        staleTime: Infinity,
        gcTime: 1000 * 60 * 60 * 24,
      },
    },
  });
  adapter.connect(queryClient);
  return {
    convex,
    queryClient,
    dispose() {
      // React runs parent cleanups before child cleanups. Let Clerk's Convex
      // provider clear its auth and observers before closing this socket.
      queueMicrotask(() => {
        queryClient.clear();
        adapter.unsubscribe?.();
        void convex.close();
      });
    },
  };
}
