import { barHeaderOptions } from '@/lib/header-options';
import { Stack } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';

export default function TidyStackLayout() {
  const { theme } = useUnistyles();
  return (
    <Stack
      screenOptions={{
        ...barHeaderOptions(theme.colors.background),
        headerShadowVisible: false,
      }}
    >
      {/* Root of the tab — nothing to pop, and the back-swipe gesture would
          otherwise steal the card's rightward "keep" swipe. */}
      <Stack.Screen name="index" options={{ title: 'Tidy', gestureEnabled: false }} />
    </Stack>
  );
}
