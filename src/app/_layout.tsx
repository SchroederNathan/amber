import { OnboardingProvider } from '@/lib/onboarding';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { useUnistyles } from 'react-native-unistyles';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!publishableKey) {
  throw new Error('Add your Clerk Publishable Key to the .env file');
}

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

// Keeps the native root view background in sync with the active theme so the
// area behind React content (launch, overscroll, transparent sheets) matches
// light/dark. The static app.json `backgroundColor` only guards the initial
// flash; this handles theme changes at runtime.
function RootBackground() {
  const { theme } = useUnistyles();
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.background);
  }, [theme.colors.background]);
  return null;
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <OnboardingProvider>
          <RootBackground />
          <Slot />
          <StatusBar style="auto" />
        </OnboardingProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
