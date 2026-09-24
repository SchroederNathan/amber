import { useToolbarIcon } from '@/components/ui/symbol';
import { barHeaderOptions } from '@/lib/header-options';
import { Wordmark } from '@/components/wordmark';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import { Platform, PlatformColor } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

export default function HomeStackLayout() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const profileIcon = useToolbarIcon('person');
  const addIcon = useToolbarIcon('plus');
  // `label` is an iOS system color; Android has no equivalent name.
  const tint = Platform.OS === 'ios' ? PlatformColor('label') : theme.colors.foreground;

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
        ...barHeaderOptions(theme.colors.background),
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index">
        <Stack.Title asChild>
          <Wordmark />
        </Stack.Title>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            icon={profileIcon}
            accessibilityLabel="Profile"
            tintColor={tint}
            onPress={tap('/profile')}
          >
            Profile
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon={addIcon}
            accessibilityLabel="Add"
            tintColor={tint}
            onPress={tap('/add')}
          >
            Add
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      </Stack.Screen>
    </Stack>
  );
}
