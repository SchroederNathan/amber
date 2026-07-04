import { Stack } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';

export default function SearchStackLayout() {
  const { theme } = useUnistyles();

  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerShadowVisible: false,
        headerLargeTitle: true,
        headerLargeTitleShadowVisible: false,
        headerLargeStyle: { backgroundColor: 'transparent' },
        headerBlurEffect: 'none',
        headerLargeTitleStyle: {
          fontFamily: theme.fonts.display,
          color: theme.colors.foreground,
        },
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Search' }} />
    </Stack>
  );
}
