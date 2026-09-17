import { Stack } from 'expo-router';
import { Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export default function MapStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index">
        <Stack.Title asChild>
          <Text style={styles.title}>map</Text>
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
