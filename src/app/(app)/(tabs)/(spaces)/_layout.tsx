import { HeaderButton } from '@/components/header-button';
import { Stack, useRouter } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';

export default function SpacesStackLayout() {
  const router = useRouter();
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
      <Stack.Screen
        name="index"
        options={{
          title: 'Spaces',
          headerRight: () => (
            <HeaderButton icon="plus" onPress={() => router.push('/new-space')} />
          ),
        }}
      />
    </Stack>
  );
}
