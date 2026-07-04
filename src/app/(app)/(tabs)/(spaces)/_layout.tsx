import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import { PlatformColor, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export default function SpacesStackLayout() {
  const router = useRouter();

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
        headerTransparent: true,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerTitle: () => <Text style={styles.title}>spaces</Text>,
          unstable_headerRightItems: () => [
            {
              type: 'button',
              label: 'New space',
              icon: { type: 'sfSymbol', name: 'plus' } as const,
              tintColor: PlatformColor('label'),
              onPress: newSpace,
            },
          ],
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create((theme) => ({
  title: {
    fontFamily: theme.fonts.display,
    fontSize: 26,
    letterSpacing: 0.5,
    color: theme.colors.foreground,
  },
}));
