import { useReducedMotion } from 'react-native-reanimated';
import { useAuth } from '@clerk/expo';
import { Redirect, Stack } from 'expo-router';

export default function AuthRoutesLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const reducedMotion = useReducedMotion();

  if (!isLoaded) {
    return null;
  }

  if (isSignedIn) {
    return <Redirect href={'/'} />;
  }

  return <Stack screenOptions={{ animation: reducedMotion ? 'fade' : 'default', headerShown: false }} />;
}
