import { Stack } from 'expo-router';
import { Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export default function SearchStackLayout() {
  const { theme } = useUnistyles();

  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{ headerTitle: () => <Text style={styles.title}>search</Text> }}
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
