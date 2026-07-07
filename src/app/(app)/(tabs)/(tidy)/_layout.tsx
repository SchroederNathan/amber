import { Stack } from 'expo-router';

export default function TidyStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerShadowVisible: false,
      }}
    >
      {/* Root of the tab — nothing to pop, and the back-swipe gesture would
          otherwise steal the card's rightward "keep" swipe. */}
      <Stack.Screen name="index" options={{ title: 'Tidy', gestureEnabled: false }} />
    </Stack>
  );
}
