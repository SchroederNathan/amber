import { useReducedMotion } from 'react-native-reanimated';
import { useEffect } from 'react';
import { useWelcomeTransition } from '@/lib/welcome-transition';
import { useAppLock } from '@/lib/app-lock';
import { useOnboarding } from '@/lib/onboarding';
import { RecentSavesWidgetSync } from '@/lib/widget-sync';
import { useAuth } from '@clerk/expo';
import { Redirect, Stack } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';

export default function AppLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;
  return <AuthenticatedAppLayout />;
}

function AuthenticatedAppLayout() {
  const { reveal } = useWelcomeTransition();
  useEffect(() => { reveal(); }, [reveal]);
  const reducedMotion = useReducedMotion();
  const { onboarded } = useOnboarding();
  const { enabled: lockEnabled } = useAppLock();
  const { theme } = useUnistyles();

  return (
    <>
      {!lockEnabled && <RecentSavesWidgetSync />}
      <Stack
        screenOptions={{
          animation: reducedMotion ? 'fade' : 'default',
          headerTransparent: true,
          headerShadowVisible: false,
          headerTintColor: theme.colors.primary,
        }}
      >
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="share" options={{ headerShown: false }} />
          <Stack.Screen
            name="item/[id]"
            options={{
              // Transparent native header over the full-bleed hero; the screen
              // fills in the toolbar buttons (share/delete) once the item loads.
              title: '',
              headerBackButtonDisplayMode: 'minimal',
            }}
          />
          <Stack.Screen
            name="space/[id]"
            options={{
              title: '',
              headerBackButtonDisplayMode: 'minimal',
            }}
          />
          <Stack.Screen
            name="add"
            options={{
              presentation: 'formSheet',
              headerShown: true,
              headerTransparent: false,
              headerStyle: { backgroundColor: theme.colors.background },
              sheetGrabberVisible: true,
              sheetAllowedDetents: 'fitToContents',
              contentStyle: { backgroundColor: theme.colors.background },
            }}
          />
          <Stack.Screen
            name="new-space"
            options={{
              presentation: 'formSheet',
              headerShown: false,
              sheetGrabberVisible: true,
              sheetAllowedDetents: 'fitToContents',
              contentStyle: { backgroundColor: theme.colors.background },
            }}
          />
          <Stack.Screen
            name="manage-spaces"
            options={{
              presentation: 'formSheet',
              headerShown: false,
              sheetGrabberVisible: true,
              sheetAllowedDetents: 'fitToContents',
              contentStyle: { backgroundColor: theme.colors.background },
            }}
          />
          <Stack.Screen
            name="profile"
            options={{
              presentation: 'modal',
              title: '',
              contentStyle: { backgroundColor: theme.colors.background },
            }}
          />
          <Stack.Screen
            name="camera"
            options={{
              presentation: 'fullScreenModal',
              headerShown: false,
              contentStyle: { backgroundColor: theme.colors.background },
            }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}
