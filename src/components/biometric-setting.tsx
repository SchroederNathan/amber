import { SettingsRow } from '@/components/settings-list';
import { useAppLock } from '@/lib/app-lock';
import { biometricMethods } from '@/lib/app-lock-storage';
import { useBiometricSignIn } from '@/lib/biometric-sign-in';
import { Host, Switch } from '@expo/ui';
import { accessibilityLabel, tint } from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { Switch as RNSwitch } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

/** "Face ID lock" row: the local lock that hides saves until Face ID passes. */
export function BiometricSetting() {
  const { enabled, available, label, enable, disable } = useAppLock();
  return (
    <BiometricRow
      testID="biometric-setting"
      label={`${label} lock`}
      biometry={label}
      enabled={enabled}
      available={available}
      enable={enable}
      disable={disable}
    />
  );
}

/** "Sign in with Face ID" row: a Clerk biometric credential for signing back in. */
export function BiometricSignInSetting({ signIn }: { signIn: ReturnType<typeof useBiometricSignIn> }) {
  const { loaded, enabled, available, label, enable, disable } = signIn;
  return (
    <BiometricRow
      testID="biometric-sign-in-setting"
      label={`Sign in with ${label}`}
      biometry={label}
      enabled={enabled}
      available={loaded && available}
      enable={enable}
      disable={disable}
    />
  );
}

/**
 * The switch flips as soon as it is tapped and holds the new value while the
 * biometric prompt runs. If the prompt fails, it slides back.
 */
function BiometricRow({ testID, label, biometry, enabled, available, enable, disable }: {
  testID: string;
  label: string;
  biometry: string;
  enabled: boolean;
  available: boolean;
  enable: () => Promise<boolean>;
  disable: () => Promise<boolean>;
}) {
  const { theme } = useUnistyles();
  // The value the user asked for, shown until the prompt settles. Both switches
  // are controlled, so without it the toggle stays put (and greys out) until
  // Face ID finishes, then jumps.
  const [pending, setPending] = useState<boolean | null>(null);
  const value = pending ?? enabled;
  const disabled = !enabled && !available;
  const toggle = (next: boolean) => {
    if (pending !== null) return;
    setPending(next);
    void (next ? enable() : disable()).finally(() => setPending(null));
  };
  return (
    <SettingsRow
      icon={biometry === 'Face ID' ? 'faceid' : biometry === 'Touch ID' ? 'touchid' : 'lock'}
      label={label}
      disabled={disabled}
      trailing={
        // @expo/ui's Android switch takes no colors and draws Material's
        // default accent, so Android uses RN's Switch with the theme roles.
        process.env.EXPO_OS === 'android' ? (
          <RNSwitch
            testID={testID}
            accessibilityLabel={label}
            value={value}
            disabled={disabled}
            onValueChange={toggle}
            trackColor={{ true: theme.colors.toggle }}
            thumbColor={theme.colors.toggleThumb}
          />
        ) : (
          // A native toggle: RN's Switch mis-sizes on iOS 26+ and sits off-centre.
          <Host matchContents>
            <Switch
              testID={testID}
              value={value}
              disabled={disabled}
              onValueChange={toggle}
              modifiers={[tint(theme.colors.toggle), accessibilityLabel(label)]}
            />
          </Host>
        )
      }
    />
  );
}

const HAS_WIDGET = process.env.EXPO_OS === 'ios' || process.env.EXPO_OS === 'android';

/** Footer copy for the privacy group: the lock's last error, why it's unavailable, or the widget note. */
export function useBiometricFooter() {
  const { enabled, available, message } = useAppLock();
  if (message) return message;
  if (!available && !enabled) return `Set up ${biometricMethods} in your device settings to use the lock.`;
  // The home-screen widget exists on iOS and Android. Shown whether the lock is
  // on or off, so the footer does not appear and vanish as the switch flips.
  return HAS_WIDGET ? 'Widget previews are hidden while the lock is on.' : null;
}

/** Footer copy for the sign-in group: the last error, why it's unavailable, or what it does. */
export function biometricSignInFooter({ enabled, available, unavailable, label, message }: ReturnType<typeof useBiometricSignIn>) {
  if (message) return message;
  if (!available && !enabled)
    return unavailable === 'service'
      ? 'Sign-in with biometrics is not available right now.'
      : unavailable === 'keystore'
        ? `This device can't store a key for ${label} sign-in.`
        : `Set up ${biometricMethods} in your device settings to sign in with it.`;
  return `After you sign out, sign back in with ${label} instead of Apple or Google.`;
}
