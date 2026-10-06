import {
  isBiometricCredentialError,
  type useBiometricCredentials,
} from '@clerk/expo/biometrics';
import { getAvailability as getDeviceBiometrics } from '@clerk/expo-biometrics';
import * as ScreenCapture from 'expo-screen-capture';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { hideRecentSavesWidget } from './widget-sync';
import { LockFailure, type LockDependencies } from './app-lock-controller';

export type BiometricCredentials = ReturnType<typeof useBiometricCredentials>;

const storeOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
// The proof the lock used before it moved to Clerk biometric credentials.
// Read once to carry an existing opt-in over, then deleted.
const legacyProofOptions: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  keychainService: 'amber.biometric-lock.v1',
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  authenticationPrompt: 'Unlock your private saves in Amber',
};

const reasons = {
  enable: 'Turn on the lock for Amber',
  unlock: 'Unlock your private saves in Amber',
  disable: 'Turn off the lock for Amber',
  signIn: 'Sign in to Amber',
};

export function lockKeys(userId: string) {
  return {
    policy: `amber.lock.${userId}`,
    // The Clerk biometric credential this device enrolled, so turning the
    // lock off revokes this device's credential and no other.
    credential: `amber.lock-credential.${userId}`,
    legacyProof: `amber.lock-proof.${userId}`,
  };
}

function errorCode(error: unknown) {
  return isBiometricCredentialError(error) ? error.code : null;
}

// Clerk puts some reasons (no credential on this device, feature turned off)
// only at the end of the message: "…is unavailable: no_local_credential."
function unavailableReason(error: unknown) {
  return error instanceof Error
    ? /: ([a-z_]+)\.$/.exec(error.message)?.[1] ?? null
    : null;
}

const SETUP_LOST = new Set([
  'key_invalidated',
  'key_not_found',
  'biometric_credential_policy_incompatible',
]);
const SERVICE_UNAVAILABLE = new Set([
  'environment_unavailable',
  'native_api_disabled',
  'feature_disabled',
  'unsupported_platform',
]);

/** A user-facing reason for a failed Clerk biometric call, or the error itself. */
function toLockFailure(error: unknown, action: 'enable' | 'unlock' | 'disable') {
  const code = errorCode(error);
  const reason = unavailableReason(error);
  if (code === 'network_error')
    return new LockFailure(
      'Amber needs an internet connection to check it’s you. Connect and try again.',
    );
  if (action === 'enable' && reason && SERVICE_UNAVAILABLE.has(reason))
    return new LockFailure('The lock is not available right now. Try again later.');
  if (
    action !== 'enable' &&
    ((code && SETUP_LOST.has(code)) ||
      reason === 'no_local_credential' ||
      reason === 'local_key_missing')
  )
    return new LockFailure(
      'Your biometrics changed on this device, so the lock must be set up again. Sign out and sign in to reset it.',
    );
  return error;
}

export async function resetLockAfterSignIn(
  userId: string,
  credentials: BiometricCredentials,
) {
  // Called only after an explicitly requested recovery produced a new Clerk session.
  const keys = lockKeys(userId);
  const credentialId = await SecureStore.getItemAsync(keys.credential, storeOptions);
  if (credentialId) {
    // Usually the key is already gone (that is why the user reset), so the
    // server copy is the one left to revoke. Offline, it stays until the
    // lock is turned on again, which replaces it.
    await credentials.revoke(credentialId).catch(() => {});
    await SecureStore.deleteItemAsync(keys.credential, storeOptions);
  }
  await SecureStore.deleteItemAsync(keys.legacyProof, legacyProofOptions);
  await SecureStore.setItemAsync(keys.policy, 'disabled', storeOptions);
}

export function createLockDependencies(
  userId: string,
  credentials: BiometricCredentials,
): LockDependencies {
  const keys = lockKeys(userId);
  const name = `Amber on ${Platform.OS === 'ios' ? 'iPhone' : 'Android'}`;

  async function enroll() {
    try {
      const credential = await credentials.enroll({ name, reason: reasons.enable });
      await SecureStore.setItemAsync(keys.credential, credential.id, storeOptions);
    } catch (error) {
      throw toLockFailure(error, 'enable');
    }
  }

  // An opt-in from before the Clerk migration has no credential yet. Its old
  // proof still verifies, and an unlock enrolls the device in its place.
  async function verifyLegacy(action: 'unlock' | 'disable') {
    const proof = await SecureStore.getItemAsync(keys.legacyProof, legacyProofOptions);
    if (proof !== userId) throw toLockFailure(new Error('No credential: no_local_credential.'), action);
    if (action === 'unlock') {
      try {
        await enroll();
        await SecureStore.deleteItemAsync(keys.legacyProof, legacyProofOptions);
      } catch {
        // Keep the old proof so the next unlock tries again.
      }
    }
    return true;
  }

  return {
    async readEnabled() {
      if (Platform.OS === 'web') return false;
      const value = await SecureStore.getItemAsync(keys.policy, storeOptions);
      if (value !== null && value !== 'enabled' && value !== 'disabled')
        throw new Error('Invalid lock policy');
      return value === 'enabled';
    },
    async writeEnabled(enabled) {
      await SecureStore.setItemAsync(
        keys.policy,
        enabled ? 'enabled' : 'disabled',
        storeOptions,
      );
    },
    enroll,
    async unenroll() {
      const credentialId = await SecureStore.getItemAsync(keys.credential, storeOptions);
      if (credentialId) {
        try {
          await credentials.revoke(credentialId);
        } catch (error) {
          // Already gone on the server: nothing is left to revoke.
          if (errorCode(error) !== 'form_resource_not_found')
            throw toLockFailure(error, 'disable');
        }
        await SecureStore.deleteItemAsync(keys.credential, storeOptions);
      }
      await SecureStore.deleteItemAsync(keys.legacyProof, legacyProofOptions);
    },
    async verify(action) {
      if (!(await SecureStore.getItemAsync(keys.credential, storeOptions)))
        return verifyLegacy(action);
      try {
        // Clerk checks the signature on its server and marks the session as
        // freshly verified. No new session is created.
        const result = await credentials.reverify({
          level: 'first_factor',
          reason: reasons[action],
        });
        return result.status === 'complete';
      } catch (error) {
        throw toLockFailure(error, action);
      }
    },
    async preparePrivacy() {
      if (Platform.OS === 'ios')
        await ScreenCapture.enableAppSwitcherProtectionAsync(1);
      if (Platform.OS === 'android')
        await ScreenCapture.preventScreenCaptureAsync('amber-lock');
      await hideRecentSavesWidget();
    },
    async releasePrivacy() {
      if (Platform.OS === 'ios')
        await ScreenCapture.disableAppSwitcherProtectionAsync();
      if (Platform.OS === 'android')
        await ScreenCapture.allowScreenCaptureAsync('amber-lock');
    },
  };
}

/** How to name the unlock methods in copy; Face ID is Apple-only. */
export const biometricMethods =
  Platform.OS === 'ios' ? 'Face ID or a fingerprint' : 'a fingerprint or face unlock';

export type BiometricStatus = {
  available: boolean;
  // Why the lock can't be turned on: no usable biometrics on the device, or
  // biometric credentials are off for Amber's Clerk instance.
  unavailable: 'device' | 'service' | null;
  label: string;
};

export const NO_BIOMETRICS: BiometricStatus = {
  available: false,
  unavailable: 'device',
  label: 'Biometrics',
};

function biometricLabel(type: string) {
  if (type === 'faceID') return 'Face ID';
  if (type === 'touchID') return 'Touch ID';
  if (type === 'opticID') return 'Optic ID';
  return 'Biometrics';
}

/**
 * Whether this device can enroll a Clerk biometric credential, and what to
 * call it. Pass `credentials` to also check the Clerk instance allows it.
 */
export async function getBiometricStatus(
  credentials?: BiometricCredentials,
): Promise<BiometricStatus> {
  if (Platform.OS === 'web') return NO_BIOMETRICS;
  // A local check, cheap enough to repeat on every return to the foreground.
  // The simulator has no Secure Enclave, so it reports unavailable.
  const device = await getDeviceBiometrics();
  const label = biometricLabel(device.biometryType);
  if (!device.canEvaluateBiometrics || !device.secureKeyStorageAvailable)
    return { available: false, unavailable: 'device', label };
  if (credentials) {
    const { unavailableReason } = await credentials.getAvailability();
    if (unavailableReason && SERVICE_UNAVAILABLE.has(unavailableReason))
      return { available: false, unavailable: 'service', label };
  }
  return { available: true, unavailable: null, label };
}

export async function signInWithBiometrics(credentials: BiometricCredentials) {
  return credentials.signIn({ reason: reasons.signIn });
}

export function isBiometricCancel(error: unknown) {
  return errorCode(error) === 'biometric_authentication_canceled';
}
