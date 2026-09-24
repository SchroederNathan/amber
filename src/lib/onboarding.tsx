import { PrivacyScreen } from '@/components/privacy-screen';
import { LoadingScreen } from '@/lib/splash';
import { useAuth } from '@clerk/expo';
import * as SecureStore from 'expo-secure-store';
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
};
const OnboardingContext = createContext<OnboardingContextValue | null>(null);

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
        if (!cancelled) setOnboarded(value === 'true');
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
    setOnboarded(true);
  }, [key]);
  const value = useMemo(
    () => (onboarded === null ? null : { onboarded, completeOnboarding }),
    [onboarded, completeOnboarding],
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
