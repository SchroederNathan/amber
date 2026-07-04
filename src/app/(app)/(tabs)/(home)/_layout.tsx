import { Wordmark } from '@/components/wordmark';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import { PlatformColor } from 'react-native';

export default function HomeStackLayout() {
  const router = useRouter();

  // Native bar-button items don't run JS on tap the way a Pressable does, so
  // the light haptic HeaderButton used to give is fired here instead.
  const tap = (href: '/profile' | '/add') => () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push(href);
  };

  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerTitle: () => <Wordmark />,
          unstable_headerLeftItems: () => [
            {
              type: 'button',
              label: 'Profile',
              icon: { type: 'sfSymbol', name: 'person' } as const,
              tintColor: PlatformColor('label'),
              onPress: tap('/profile'),
            },
          ],
          unstable_headerRightItems: () => [
            {
              type: 'button',
              label: 'Add',
              icon: { type: 'sfSymbol', name: 'plus' } as const,
              tintColor: PlatformColor('label'),
              onPress: tap('/add'),
            },
          ],
        }}
      />
    </Stack>
  );
}
