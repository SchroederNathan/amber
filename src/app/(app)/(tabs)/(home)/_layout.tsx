import { HeaderButton } from '@/components/header-button';
import { Wordmark } from '@/components/wordmark';
import { Stack, useRouter } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';

export default function HomeStackLayout() {
  const router = useRouter();
  const { theme } = useUnistyles();

  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerTitle: () => <Wordmark />,
          headerLeft: () => (
            <HeaderButton icon="person" onPress={() => router.push('/profile')} />
          ),
          headerRight: () => (
            <HeaderButton icon="plus" onPress={() => router.push('/add')} />
          ),
        }}
      />
    </Stack>
  );
}
