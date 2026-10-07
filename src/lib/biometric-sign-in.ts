import { useAuth } from '@clerk/expo';
import {
  isBiometricCredentialError,
  useBiometricCredentials,
} from '@clerk/expo/biometrics';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useAppLock } from './app-lock';
import { biometricLabel, getDeviceBiometrics } from './device-biometrics';

// Sign in with Face ID: a Clerk biometric credential, enrolled from Settings and
// used on the sign-in screen. It is separate from the app lock, which stays a
// local check. Clerk's credentials authenticate with its server, and are not
// meant to unlock local content.

type BiometricCredentials = ReturnType<typeof useBiometricCredentials>;

const storeOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

// The credential this device enrolled, so turning the setting off revokes this
// device's credential and no other device's.
const credentialKey = (userId: string) => `amber.biometric-sign-in.${userId}`;

// Clerk reports these when it can't enroll anyone on this instance.
const SERVICE_OFF = new Set([
  'environment_unavailable',
  'native_api_disabled',
  'feature_disabled',
  'unsupported_platform',
]);
// What `revoke()` reports when Clerk no longer has the credential.
const CREDENTIAL_MISSING = new Set(['form_resource_not_found', 'trusted_device_not_registered']);
// The enrolled credential is gone, so the setting is off.
const CREDENTIAL_GONE = new Set([
  'no_local_credential',
  'local_key_missing',
  'server_credential_missing',
  'server_credential_revoked',
]);

export type BiometricSignInState = {
  loaded: boolean;
  enabled: boolean;
  available: boolean;
  // Why it can't be turned on: no usable biometrics, no hardware-backed key
  // storage on the device (the iOS Simulator), or the feature is off in Clerk.
  unavailable: 'device' | 'keystore' | 'service' | null;
  label: string;
  message: string | null;
};

const initialState: BiometricSignInState = {
  loaded: false,
  enabled: false,
  available: false,
  unavailable: 'device',
  label: 'Biometrics',
  message: null,
};

function errorCode(error: unknown) {
  return isBiometricCredentialError(error) ? error.code : null;
}

async function readState(
  userId: string,
  credentials: BiometricCredentials,
): Promise<Omit<BiometricSignInState, 'message'>> {
  const device = await getDeviceBiometrics();
  const label = biometricLabel(device?.biometryType);
  if (!device?.canEvaluateBiometrics) return { ...initialState, loaded: true, label };
  if (!device.secureKeyStorageAvailable)
    return { ...initialState, loaded: true, unavailable: 'keystore', label };
  const id = await SecureStore.getItemAsync(credentialKey(userId), storeOptions);
  let availability;
  try {
    // Signed in, this also asks Clerk whether the credential is still active.
    availability = await credentials.getAvailability(id ? { id } : undefined);
  } catch {
    // Offline: trust this device's record until Clerk can be asked.
    return { loaded: true, enabled: Boolean(id), available: true, unavailable: null, label };
  }
  const { isAvailable, unavailableReason } = availability;
  if (unavailableReason && SERVICE_OFF.has(unavailableReason))
    return { loaded: true, enabled: false, available: false, unavailable: 'service', label };
  if (id && !isAvailable && unavailableReason && CREDENTIAL_GONE.has(unavailableReason)) {
    // A changed biometric set deletes the key, but Clerk still has the
    // credential. Revoke it so it can't linger on the account.
    if (unavailableReason === 'no_local_credential' || unavailableReason === 'local_key_missing')
      await credentials.revoke(id).catch(() => {});
    await SecureStore.deleteItemAsync(credentialKey(userId), storeOptions);
  }
  return {
    loaded: true,
    enabled: Boolean(id) && isAvailable,
    available: true,
    unavailable: null,
    label,
  };
}

/** State and actions for the "Sign in with Face ID" setting. */
export function useBiometricSignIn() {
  const { userId } = useAuth();
  const credentials = useBiometricCredentials();
  const { whilePrompting } = useAppLock();
  const [state, setState] = useState(initialState);
  const [busy, setBusy] = useState(false);
  // The Face ID sheet sends Amber through inactive → active, which refreshes.
  // A read that started before enrollment saved its ID must not win.
  const changing = useRef(0);

  const refresh = useCallback(() => {
    if (!userId || Platform.OS === 'web') return Promise.resolve();
    const started = changing.current;
    return readState(userId, credentials)
      .then((next) => {
        if (started === changing.current) setState((current) => ({ ...current, ...next }));
      })
      .catch(() => setState((current) => ({ ...current, loaded: true })));
  }, [userId, credentials]);

  useEffect(() => {
    void refresh();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const enable = async () => {
    if (!userId || busy) return false;
    changing.current++;
    setBusy(true);
    setState((current) => ({ ...current, message: null }));
    try {
      const credential = await whilePrompting(() =>
        credentials.enroll({
          name: `Amber on ${Platform.OS === 'ios' ? 'iPhone' : 'Android'}`,
          reason: 'Turn on sign-in with biometrics for Amber',
        }),
      );
      try {
        await SecureStore.setItemAsync(credentialKey(userId), credential.id, storeOptions);
      } catch (error) {
        // Without the saved ID the switch can't turn it off again, so don't
        // leave a live credential behind.
        await credentials.revoke(credential.id).catch(() => {});
        throw error;
      }
      setState((current) => ({ ...current, enabled: true }));
      return true;
    } catch (error) {
      const code = errorCode(error);
      setState((current) => ({
        ...current,
        message:
          code === 'biometric_authentication_canceled'
            ? null
            : code === 'network_error'
              ? 'Connect to the internet and try again.'
              : 'Could not turn this on. Try again.',
      }));
      return false;
    } finally {
      changing.current++;
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!userId || busy) return false;
    changing.current++;
    setBusy(true);
    setState((current) => ({ ...current, message: null }));
    try {
      const id = await SecureStore.getItemAsync(credentialKey(userId), storeOptions);
      if (id) {
        try {
          await credentials.revoke(id);
        } catch (error) {
          // Already gone on the server: nothing is left to revoke. Clerk keeps
          // the local key in that case, and a signed-in availability check is
          // what deletes it, so sign-in stops offering it.
          if (!CREDENTIAL_MISSING.has(errorCode(error) ?? '')) throw error;
          await credentials.getAvailability({ id }).catch(() => {});
        }
        await SecureStore.deleteItemAsync(credentialKey(userId), storeOptions);
      }
      setState((current) => ({ ...current, enabled: false }));
      return true;
    } catch (error) {
      setState((current) => ({
        ...current,
        message:
          errorCode(error) === 'network_error'
            ? 'Connect to the internet to turn this off.'
            : 'Could not turn this off. Try again.',
      }));
      return false;
    } finally {
      changing.current++;
      setBusy(false);
    }
  };

  return { ...state, busy, enable, disable };
}

/**
 * The label for the sign-in button ("Face ID"), or null when this device has
 * no credential. Signed out, Clerk checks only local state. A credential
 * revoked elsewhere fails at sign-in, and Clerk then deletes the local copy.
 */
export async function readSignInLabel(credentials: BiometricCredentials) {
  try {
    const { isAvailable } = await credentials.getAvailability();
    if (!isAvailable) return null;
    return biometricLabel((await getDeviceBiometrics())?.biometryType);
  } catch {
    return null;
  }
}

export function signInWithBiometrics(credentials: BiometricCredentials) {
  return credentials.signIn({ reason: 'Sign in to Amber' });
}

export function isBiometricCancel(error: unknown) {
  return errorCode(error) === 'biometric_authentication_canceled';
}

export function isNetworkError(error: unknown) {
  return errorCode(error) === 'network_error';
}
