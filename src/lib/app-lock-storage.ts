import * as LocalAuthentication from 'expo-local-authentication';
import * as ScreenCapture from 'expo-screen-capture';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { hideRecentSavesWidget } from './widget-sync';
import type { LockDependencies } from './app-lock-controller';

const policyOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
const keyOptions: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  keychainService: 'amber.biometric-lock.v1',
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  authenticationPrompt: 'Unlock your private saves in Amber',
};

export function lockKeys(userId: string) {
  return {
    policy: `amber.lock.${userId}`,
    proof: `amber.lock-proof.${userId}`,
  };
}

export async function resetLockAfterSignIn(userId: string) {
  // Called only after an explicitly requested recovery produced a new Clerk session.
  const keys = lockKeys(userId);
  await SecureStore.deleteItemAsync(keys.proof, keyOptions);
  await SecureStore.setItemAsync(keys.policy, 'disabled', policyOptions);
}

export function createLockDependencies(userId: string): LockDependencies {
  const keys = lockKeys(userId);
  return {
    async readEnabled() {
      if (Platform.OS === 'web') return false;
      const value = await SecureStore.getItemAsync(keys.policy, policyOptions);
      if (value !== null && value !== 'enabled' && value !== 'disabled')
        throw new Error('Invalid lock policy');
      return value === 'enabled';
    },
    async writeEnabled(enabled) {
      await SecureStore.setItemAsync(
        keys.policy,
        enabled ? 'enabled' : 'disabled',
        policyOptions,
      );
    },
    async enroll() {
      if (!SecureStore.canUseBiometricAuthentication())
        throw new Error('Biometrics unavailable');
      // iOS does not prompt when creating a key, so read it back before opting in.
      await SecureStore.deleteItemAsync(keys.proof, keyOptions);
      await SecureStore.setItemAsync(keys.proof, userId, keyOptions);
      if ((await SecureStore.getItemAsync(keys.proof, keyOptions)) !== userId)
        throw new Error('Verification failed');
    },
    async verify() {
      return (
        (await SecureStore.getItemAsync(keys.proof, keyOptions)) === userId
      );
    },
    async preparePrivacy() {
      if (Platform.OS === 'ios')
        await ScreenCapture.enableAppSwitcherProtectionAsync(1);
      if (Platform.OS === 'android')
        await ScreenCapture.preventScreenCaptureAsync('amber-lock');
      await hideRecentSavesWidget();
    },
  };
}

export async function getBiometricLabel() {
  if (Platform.OS === 'web') return { available: false, label: 'Biometrics' };
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  const label =
    Platform.OS === 'ios'
      ? types.includes(
          LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
        )
        ? 'Face ID'
        : 'Touch ID'
      : 'Biometrics';
  return { available: SecureStore.canUseBiometricAuthentication(), label };
}
