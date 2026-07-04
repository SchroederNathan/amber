import { HeaderButton } from '@/components/header-button';
import { Wordmark } from '@/components/wordmark';
import { Stack, useRouter } from 'expo-router';

export default function HomeStackLayout() {
  const router = useRouter();

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
