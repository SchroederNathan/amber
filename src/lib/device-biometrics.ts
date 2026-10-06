import { getAvailability } from '@clerk/expo-biometrics';
import { Platform } from 'react-native';

/**
 * The device's biometry and whether it can hold a hardware-backed key, from
 * Clerk's native biometrics module. A local check with no prompt, cheap enough
 * to repeat on every return to the foreground. Null on the web.
 */
export async function getDeviceBiometrics() {
  if (Platform.OS === 'web') return null;
  return getAvailability();
}

/** How to name the device's biometry in copy. */
export function biometricLabel(type: string | undefined) {
  if (type === 'faceID') return 'Face ID';
  if (type === 'touchID') return 'Touch ID';
  if (type === 'opticID') return 'Optic ID';
  return 'Biometrics';
}
