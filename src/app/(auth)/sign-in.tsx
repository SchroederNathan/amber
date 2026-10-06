import { isClerkAPIResponseError, useAuth, useSSO, useSignIn } from '@clerk/expo';
import { useSignInWithApple } from '@clerk/expo/apple';
import { useBiometricCredentials } from '@clerk/expo/biometrics';
import React from 'react';
import { Platform } from 'react-native';
import { Welcome } from '@/components/onboarding/welcome';
import { markBiometricSession } from '@/lib/biometric-session';
import { isBiometricCancel, isNetworkError, readSignInLabel, signInWithBiometrics } from '@/lib/biometric-sign-in';
import { useWelcomeTransition } from '@/lib/welcome-transition';

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
  const { cover, reveal } = useWelcomeTransition();
  const { startSSOFlow } = useSSO();
  const { startAppleAuthenticationFlow } = useSignInWithApple();
  const { signIn } = useSignIn();
  const { isLoaded } = useAuth();
  const credentials = useBiometricCredentials();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // "Face ID" when this device holds a biometric credential, else null.
  const [biometricLabel, setBiometricLabel] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isLoaded) return;
    let current = true;
    void readSignInLabel(credentials).then((label) => {
      if (current) setBiometricLabel(label);
    });
    return () => {
      current = false;
    };
  }, [isLoaded, credentials]);

  const handleBiometric = async () => {
    setPending(true);
    setError(null);
    try {
      const result = await signInWithBiometrics(credentials);
      if (result.status === 'complete' && result.createdSessionId) {
        // The lock would otherwise ask for the same biometric again.
        markBiometricSession(result.createdSessionId);
        cover();
        await result.setActive({ session: result.createdSessionId });
      } else {
        setError(`Sign-in did not complete (sign in: ${result.status})`);
      }
    } catch (err) {
      reveal();
      if (!isBiometricCancel(err)) {
        setError(isClerkAPIResponseError(err) || isNetworkError(err)
          ? describeError(err)
          : `${biometricLabel ?? 'Biometric'} sign-in didn’t work. Continue with Apple or Google.`);
      }
      // A failed sign-in may have cleared a stale credential.
      setBiometricLabel(await readSignInLabel(credentials));
    } finally {
      setPending(false);
    }
  };

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
        cover();
        const result = await signIn.finalize();
        if (result.error) {
          reveal();
          setError(describeError(result.error));
        }
      } else {
        setError(`Dev login incomplete: ${signIn.status}`);
      }
    } catch (err) {
      reveal();
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
    authSessionResult,
  }: Awaited<ReturnType<typeof startSSOFlow>>) => {
    if (createdSessionId && setActive) {
      cover();
      await setActive({ session: createdSessionId });
      return;
    }
    // The browser sheet closed without a redirect: a cancel. Clerk still hands
    // back the half-started sign-in (needs_identifier), which is not an error.
    if (authSessionResult && authSessionResult.type !== 'success') return;
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
      reveal();
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
      reveal();
      setError(describeError(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <Welcome
      pending={pending}
      error={error}
      biometricLabel={biometricLabel}
      onBiometric={handleBiometric}
      onApple={handleApple}
      onGoogle={handleGoogle}
      onDevLogin={handleDevLogin}
    />
  );
}
