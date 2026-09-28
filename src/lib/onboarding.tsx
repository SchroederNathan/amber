import { PrivacyScreen } from '@/components/privacy-screen';
import { LoadingScreen } from '@/lib/splash';
import { useAuth } from '@clerk/expo';
import * as SecureStore from 'expo-secure-store';
import { createMMKV } from 'react-native-mmkv';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

type OnboardingContextValue = {
  onboarded: boolean;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
};
const OnboardingContext = createContext<OnboardingContextValue | null>(null);

// Onboarding asks for permissions, and a reinstall resets them. Each store
// alone can outlive a reinstall: the iOS Keychain (SecureStore) is kept after
// uninstall, and Android can restore app files (MMKV) from a backup but never
// SecureStore. Onboarding counts as done only when both stores say so.
const installStore = createMMKV({ id: 'onboarding' });

export function OnboardingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = useAuth();
  const key = `amber.onboarded.v2.${userId}`;
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void SecureStore.getItemAsync(key)
      .then((value) => {
        if (!cancelled)
          setOnboarded(value === 'true' && installStore.getBoolean(key) === true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [key, attempt]);
  const completeOnboarding = useCallback(async () => {
    await SecureStore.setItemAsync(key, 'true');
    installStore.set(key, true);
    setOnboarded(true);
  }, [key]);
  // Dev-only: the (app) layout guard sends the user back to onboarding.
  const resetOnboarding = useCallback(async () => {
    await SecureStore.deleteItemAsync(key);
    installStore.remove(key);
    setOnboarded(false);
  }, [key]);
  const value = useMemo(
    () =>
      onboarded === null
        ? null
        : { onboarded, completeOnboarding, resetOnboarding },
    [onboarded, completeOnboarding, resetOnboarding],
  );
  if (failed)
    return (
      <PrivacyScreen
        title="Opening Amber"
        message="Could not read your setup. Please try again."
        action={() => {
          setFailed(false);
          setAttempt(attempt + 1);
        }}
        actionLabel="Try again"
      />
    );
  if (onboarded === null) return <LoadingScreen />;
  return <OnboardingContext value={value}>{children}</OnboardingContext>;
}

export function useOnboarding() {
  const context = use(OnboardingContext);
  if (!context) throw new Error('useOnboarding requires OnboardingProvider');
  return context;
}
