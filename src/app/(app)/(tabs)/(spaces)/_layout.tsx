import { useToolbarIcon } from '@/components/ui/symbol';
import { barHeaderOptions } from '@/lib/header-options';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import { Platform, PlatformColor, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export default function SpacesStackLayout() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const addIcon = useToolbarIcon('plus');
  // `label` is an iOS system color; Android has no equivalent name.
  const tint = Platform.OS === 'ios' ? PlatformColor('label') : theme.colors.foreground;

  // Native bar-button items don't run JS on tap the way a Pressable does, so
  // the light haptic HeaderButton used to give is fired here instead.
  const newSpace = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push('/new-space');
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
          <Text style={styles.title}>spaces</Text>
        </Stack.Title>
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon={addIcon}
            accessibilityLabel="New space"
            tintColor={tint}
            onPress={newSpace}
          >
            New space
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      </Stack.Screen>
    </Stack>
  );
}

const styles = StyleSheet.create((theme) => ({
  title: {
    ...theme.type.largeTitle,
    letterSpacing: 0.5,
    color: theme.colors.foreground,
  },
}));
