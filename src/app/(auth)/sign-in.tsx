import { useSSO } from '@clerk/expo';
import { useSignInWithApple } from '@clerk/expo/apple';
import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export default function Page() {
  const { startSSOFlow } = useSSO();
  const { startAppleAuthenticationFlow } = useSignInWithApple();
  const [pending, setPending] = React.useState(false);

  const activate = async ({
    createdSessionId,
    setActive,
  }: Pick<Awaited<ReturnType<typeof startSSOFlow>>, 'createdSessionId' | 'setActive'>) => {
    // A null createdSessionId means the user cancelled — not an error
    if (createdSessionId && setActive) {
      await setActive({ session: createdSessionId });
    }
  };

  const handleApple = async () => {
    setPending(true);
    try {
      if (Platform.OS === 'ios') {
        await activate(await startAppleAuthenticationFlow());
      } else {
        await activate(await startSSOFlow({ strategy: 'oauth_apple' }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPending(false);
    }
  };

  const handleGoogle = async () => {
    setPending(true);
    try {
      await activate(await startSSOFlow({ strategy: 'oauth_google' }));
    } catch (err) {
      console.error(err);
    } finally {
      setPending(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>amber</Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>

      <View style={styles.buttons}>
        <Pressable
          style={({ pressed }) => [
            styles.appleButton,
            pending && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleApple}
          disabled={pending}
        >
          <Text style={styles.appleButtonText}> Continue with Apple</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.googleButton,
            pending && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleGoogle}
          disabled={pending}
        >
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.gap(2.5),
    paddingTop: rt.insets.top + theme.gap(8),
    alignItems: 'center',
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: 48,
    color: theme.colors.primary,
  },
  subtitle: {
    fontFamily: theme.fonts.regular,
    fontSize: 16,
    color: theme.colors.foreground,
    marginTop: theme.gap(1),
  },
  buttons: {
    alignSelf: 'stretch',
    gap: theme.gap(1.5),
    marginTop: theme.gap(6),
  },
  appleButton: {
    backgroundColor: theme.colors.foreground,
    paddingVertical: theme.gap(1.75),
    borderRadius: 12,
    alignItems: 'center',
  },
  appleButtonText: {
    color: theme.colors.background,
    fontFamily: theme.fonts.medium,
    fontSize: 16,
  },
  googleButton: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.secondary,
    paddingVertical: theme.gap(1.75),
    borderRadius: 12,
    alignItems: 'center',
  },
  googleButtonText: {
    color: theme.colors.foreground,
    fontFamily: theme.fonts.medium,
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.7,
  },
}));
