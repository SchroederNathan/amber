import { HeaderButton } from '@/components/header-button';
import { Stack, useRouter } from 'expo-router';
import { Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export default function SpacesStackLayout() {
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
          headerTitle: () => <Text style={styles.title}>spaces</Text>,
          headerRight: () => (
            <HeaderButton icon="plus" onPress={() => router.push('/new-space')} />
          ),
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
