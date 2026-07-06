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
      <Stack.Screen name="index">
        <Stack.Title asChild>
          <Wordmark />
        </Stack.Title>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            icon="person"
            tintColor={PlatformColor('label')}
            onPress={tap('/profile')}
          >
            Profile
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon="plus"
            tintColor={PlatformColor('label')}
            onPress={tap('/add')}
          >
            Add
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      </Stack.Screen>
    </Stack>
  );
}
