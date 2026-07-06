import { Stack } from 'expo-router';
import { Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export default function SearchStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
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
    fontFamily: theme.fonts.display,
    fontSize: 26,
    letterSpacing: 0.5,
    color: theme.colors.foreground,
  },
}));
