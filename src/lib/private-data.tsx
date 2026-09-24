import { PrivacyScreen } from '@/components/privacy-screen';
import { LoadingScreen } from '@/lib/splash';
import { useAuth, useClerk } from '@clerk/expo';
import { QueryClientProvider } from '@tanstack/react-query';
import { useConvexAuth } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { useEffect, useState } from 'react';
import {
  clearLegacyQueryCache,
  createPrivateQueryClients,
} from './query-client';

function VerifiedData({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useClerk();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated)
    return (
      <PrivacyScreen
        title="Could not verify your account"
        message="Check your connection, or sign out and try again."
        action={() => void signOut().catch(() => {})}
        actionLabel="Sign out"
      />
    );
  return children;
}

// Mounted only after Clerk AND the device lock allow access. Each mount owns its
// socket and memory cache. Locking/sign-out destroys them before another account
// can use identically named query keys. Private content is no longer saved to MMKV.
export function PrivateDataProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [clients, setClients] = useState<ReturnType<
    typeof createPrivateQueryClients
  > | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    // Native sockets must be created after commit, never by a render initializer.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      clearLegacyQueryCache();
      const value = createPrivateQueryClients();
      setClients(value);
      return () => value.dispose();
    } catch {
      setFailed(true);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  if (failed)
    return (
      <PrivacyScreen
        title="Opening Amber"
        message="Could not prepare private storage. Please restart Amber."
      />
    );
  if (!clients) return <LoadingScreen />;
  return (
    <ConvexProviderWithClerk client={clients.convex} useAuth={useAuth}>
      <QueryClientProvider client={clients.queryClient}>
        <VerifiedData>{children}</VerifiedData>
      </QueryClientProvider>
    </ConvexProviderWithClerk>
  );
}
