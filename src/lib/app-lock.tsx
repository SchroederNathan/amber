import { PrivacyScreen } from '@/components/privacy-screen';
import { useAuth, useClerk } from '@clerk/expo';
import { useBiometricCredentials } from '@clerk/expo/biometrics';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { Alert, AppState } from 'react-native';
import { AppLockController } from './app-lock-controller';
import { canResetLock, type LockRecoveryRequest } from './app-lock-recovery';
import {
  createLockDependencies,
  getBiometricStatus,
  NO_BIOMETRICS,
  resetLockAfterSignIn,
  type BiometricStatus,
} from './app-lock-storage';
import { isFreshBiometricSession } from './biometric-session';
import { LoadingScreen, useSplashHold } from './splash';
import { resetAppIntents } from './app-intents';
import { hideRecentSavesWidget } from './widget-sync';

type AppLockValue = {
  enabled: boolean;
  busy: boolean;
  // Amber is in the foreground. It changes in the same update that locks, so
  // work gated on it never starts in a tree the lock is about to tear down.
  foreground: boolean;
  available: boolean;
  unavailable: BiometricStatus['unavailable'];
  label: string;
  message: string | null;
  enable: () => Promise<boolean>;
  disable: () => Promise<boolean>;
};
const AppLockContext = createContext<AppLockValue | null>(null);
export function useAppLock() {
  const value = use(AppLockContext);
  if (!value) throw new Error('useAppLock requires AppLockProvider');
  return value;
}

function AccountLock({
  userId,
  sessionId,
  recover,
  children,
}: {
  userId: string;
  sessionId: string;
  recover: () => void;
  children: React.ReactNode;
}) {
  const credentials = useBiometricCredentials();
  const [controller] = useState(
    () =>
      new AppLockController(
        createLockDependencies(userId, credentials),
        AppState.currentState === 'active',
        { startUnlocked: isFreshBiometricSession(sessionId) },
      ),
  );
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const [biometrics, setBiometrics] = useState<BiometricStatus>(NO_BIOMETRICS);
  const { status, busy, message, foreground } = snapshot;
  const enabled = status !== 'disabled';
  useEffect(() => {
    void controller.load();
    const subscription = AppState.addEventListener('change', (state) =>
      controller.activityChanged(state),
    );
    return () => {
      subscription.remove();
      controller.dispose();
    };
  }, [controller]);
  // Device biometrics can change while Amber is away, so check on each return.
  // Clerk's check only matters while the lock is off (can it be turned on?);
  // with a credential enrolled it would cost a server round trip.
  const checkService = status === 'disabled';
  useEffect(() => {
    if (!foreground) return;
    let current = true;
    void getBiometricStatus(checkService ? credentials : undefined)
      .then((next) => current && setBiometrics(next))
      .catch(() => current && setBiometrics(NO_BIOMETRICS));
    return () => {
      current = false;
    };
  }, [foreground, checkService, credentials]);

  // Inside the grace period the app stays mounted, so navigation survives a
  // quick trip away. The splash hides saves while Amber is not in the foreground.
  useSplashHold(status === 'unlocked' && !foreground && !busy, 'show');
  const value = useMemo(
    () => ({
      enabled,
      busy,
      foreground,
      ...biometrics,
      message,
      enable: () => controller.authenticate('enable'),
      disable: () => controller.authenticate('disable'),
    }),
    [enabled, busy, foreground, biometrics, message, controller],
  );
  if (status === 'loading') return <LoadingScreen />;
  if (status === 'error')
    return (
      <PrivacyScreen
        message={message}
        action={() => void controller.load()}
        actionLabel="Try again"
        recover={recover}
      />
    );
  if (status === 'locked') {
    // While Face ID runs (or is about to), only the splash shows. The full
    // screen appears once verification fails, so the user can retry or reset.
    if (busy || !foreground) return <LoadingScreen show />;
    return (
      <PrivacyScreen
        message={message}
        action={() => void controller.authenticate('unlock')}
        actionLabel={`Unlock with ${biometrics.label}`}
        recover={recover}
      />
    );
  }
  return <AppLockContext value={value}>{children}</AppLockContext>;
}

function ResetRecoveredLock({
  userId,
  complete,
}: {
  userId: string;
  complete: () => void;
}) {
  const credentials = useBiometricCredentials();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void resetLockAfterSignIn(userId, credentials)
      .then(() => {
        if (!cancelled) complete();
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, credentials, complete, attempt]);
  if (!failed) return <LoadingScreen />;
  return (
    <PrivacyScreen
      title="Resetting your lock"
      message="Could not reset your lock. Please try again."
      action={() => {
        setFailed(false);
        setAttempt(attempt + 1);
      }}
      actionLabel="Try again"
    />
  );
}

// Above all private routes, data providers, sheets, and incoming share links.
// A different Clerk session gets a fresh lock, even for the same account.
export function AppAccessBoundary({
  children,
  signedOut,
}: {
  children: React.ReactNode;
  signedOut: React.ReactNode;
}) {
  const { isLoaded, isSignedIn, userId, sessionId } = useAuth();
  const { signOut } = useClerk();
  const [recovery, setRecovery] = useState<LockRecoveryRequest | null>(null);
  const completeRecovery = useCallback(() => setRecovery(null), []);
  useEffect(() => {
    void hideRecentSavesWidget().catch(() =>
      console.warn('Could not clear Recent Saves widget'),
    );
  }, [sessionId]);
  useEffect(() => {
    if (!isLoaded || isSignedIn) return;
    void resetAppIntents().catch(() => console.warn('Could not reset Siri data'));
  }, [isLoaded, isSignedIn]);
  if (!isLoaded) return <LoadingScreen />;
  if (!isSignedIn || !userId || !sessionId) return signedOut;
  // Signing back in with biometrics proves the lock still works, so there is
  // nothing to reset.
  if (
    recovery &&
    (recovery.userId !== userId || isFreshBiometricSession(sessionId))
  )
    setRecovery(null);
  if (
    canResetLock(recovery, userId, sessionId) &&
    !isFreshBiometricSession(sessionId)
  ) {
    return <ResetRecoveredLock userId={userId} complete={completeRecovery} />;
  }
  const recover = () =>
    Alert.alert(
      'Reset biometric lock?',
      'This signs you out. Sign in to your account with Apple or Google to reset this device’s lock.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => {
            setRecovery({ userId, sessionId });
            void signOut().catch(() => {
              setRecovery(null);
              Alert.alert(
                'Could not sign out',
                'Your saves remain locked. Check your connection and try again.',
              );
            });
          },
        },
      ],
    );
  return (
    <AccountLock
      key={`${userId}:${sessionId}`}
      userId={userId}
      sessionId={sessionId}
      recover={recover}
    >
      {children}
    </AccountLock>
  );
}
