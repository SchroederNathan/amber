import { ConvexQueryClient } from '@convex-dev/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { ConvexReactClient } from 'convex/react';
import { createMMKV } from 'react-native-mmkv';

// Single Convex socket shared by ConvexProviderWithClerk (reactive mutations)
// and the TanStack adapter (persisted reactive queries). One client => one
// WebSocket => shared auth.
export const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

const convexQueryClient = new ConvexQueryClient(convex);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Convex's hash/queryFn MUST be global defaults (not per-call) so that
      // restored persisted query hashes match — otherwise persistence silently
      // no-ops. See plan gotcha #1.
      queryKeyHashFn: convexQueryClient.hashFn(),
      queryFn: convexQueryClient.queryFn(),
      // Convex data is never stale (server pushes updates), and a long gcTime is
      // what actually lets the persister keep entries across launches.
      staleTime: Infinity,
      gcTime: 1000 * 60 * 60 * 24,
    },
  },
});

convexQueryClient.connect(queryClient);

// MMKV is synchronous, so use the sync storage persister with a small shim.
// MMKV v4 (Nitro) creates instances via createMMKV() and deletes with remove().
const mmkv = createMMKV({ id: 'tanstack-query-cache' });

const clientStorage = {
  setItem: (key: string, value: string) => mmkv.set(key, value),
  getItem: (key: string) => {
    const value = mmkv.getString(key);
    return value === undefined ? null : value;
  },
  removeItem: (key: string) => {
    mmkv.remove(key);
  },
};

export const persister = createSyncStoragePersister({ storage: clientStorage });
