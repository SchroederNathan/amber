import { useClerk, useUser } from '@clerk/expo';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export default function Home() {
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Hello {user?.primaryEmailAddress?.emailAddress}</Text>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={() => signOut()}
      >
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.gap(2),
    gap: theme.gap(2),
  },
  text: {
    color: theme.colors.foreground,
    fontFamily: theme.fonts.regular,
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.gap(1.5),
    paddingHorizontal: theme.gap(3),
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontFamily: theme.fonts.bold,
  },
}));
