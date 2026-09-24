import { barHeaderOptions } from '@/lib/header-options';
import { Stack } from 'expo-router';
import { Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export default function SearchStackLayout() {
  const { theme } = useUnistyles();
  return (
    <Stack
      screenOptions={{
        ...barHeaderOptions(theme.colors.background),
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index">
        <Stack.Title asChild>
          <Text style={styles.title}>search</Text>
        </Stack.Title>
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
