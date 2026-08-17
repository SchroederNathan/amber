import { isClerkAPIResponseError, useSSO, useSignIn } from '@clerk/expo';
import { useSignInWithApple } from '@clerk/expo/apple';
import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

// Release builds have no console, so every auth failure has to reach the
// screen. Clerk API errors carry the useful text in `longMessage`.
function describeError(err: unknown) {
  if (isClerkAPIResponseError(err)) {
    const first = err.errors[0];
    return first?.longMessage ?? first?.message ?? err.message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export default function Page() {
  const { startSSOFlow } = useSSO();
  const { startAppleAuthenticationFlow } = useSignInWithApple();
  const { signIn } = useSignIn();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleDevLogin = async () => {
    if (!signIn) return;
    const password = process.env.EXPO_PUBLIC_DEV_PASSWORD;
    if (!password) {
      console.warn('Dev login: set EXPO_PUBLIC_DEV_PASSWORD in .env.local');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const { error: signInError } = await signIn.password({
        identifier: 'dev+clerk_test@example.com',
        password,
      });
      if (signInError) {
        setError(describeError(signInError));
      } else if (signIn.status === 'complete') {
        await signIn.finalize();
      } else {
        setError(`Dev login incomplete: ${signIn.status}`);
      }
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(false);
    }
  };

  // A null createdSessionId is ambiguous: the user cancelled, or the flow ran
  // but stopped short of a session (Clerk needs more sign-up data). Report the
  // second case, stay silent on a cancel.
  const activate = async ({
    createdSessionId,
    setActive,
    signIn: attempt,
    signUp,
  }: Awaited<ReturnType<typeof startSSOFlow>>) => {
    if (createdSessionId && setActive) {
      await setActive({ session: createdSessionId });
      return;
    }
    if (attempt?.status || signUp?.status) {
      setError(`Sign-in did not complete (sign in: ${attempt?.status ?? 'none'}, sign up: ${signUp?.status ?? 'none'})`);
    }
  };

  const handleApple = async () => {
    setPending(true);
    setError(null);
    try {
      if (Platform.OS === 'ios') {
        await activate({ ...(await startAppleAuthenticationFlow()), authSessionResult: null });
      } else {
        await activate(await startSSOFlow({ strategy: 'oauth_apple' }));
      }
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(false);
    }
  };

  const handleGoogle = async () => {
    setPending(true);
    setError(null);
    try {
      await activate(await startSSOFlow({ strategy: 'oauth_google' }));
    } catch (err) {
      setError(describeError(err));
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
        {__DEV__ && (
          <Pressable
            testID="dev-login-button"
            style={({ pressed }) => [
              styles.appleButton,
              pending && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleDevLogin}
            disabled={pending}
          >
            <Text style={styles.appleButtonText}>🔧 Dev login</Text>
          </Pressable>
        )}
      </View>

      {error && (
        <Text style={styles.error} selectable>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
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
    borderColor: theme.colors.border,
    paddingVertical: theme.gap(1.75),
    borderRadius: 12,
    alignItems: 'center',
  },
  googleButtonText: {
    color: theme.colors.foreground,
    fontFamily: theme.fonts.medium,
    fontSize: 16,
  },
  error: {
    alignSelf: 'stretch',
    marginTop: theme.gap(2),
    color: theme.colors.danger,
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.7,
  },
}));
