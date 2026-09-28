import { SettingsRow } from '@/components/settings-list';
import { useAppLock } from '@/lib/app-lock';
import { biometricMethods } from '@/lib/app-lock-storage';
import { Host, Switch } from '@expo/ui';
import { accessibilityLabel, tint } from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { Switch as RNSwitch } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

/**
 * "Face ID lock" row. The switch flips as soon as it is tapped and holds the
 * new value while the biometric prompt runs. If the prompt fails, it slides back.
 */
export function BiometricSetting() {
  const { enabled, available, label, enable, disable } = useAppLock();
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
      icon={label === 'Face ID' ? 'faceid' : label === 'Touch ID' ? 'touchid' : 'lock'}
      label={`${label} lock`}
      disabled={!enabled && !available}
      trailing={
        // @expo/ui's Android switch takes no colors and draws Material's
        // default accent, so Android uses RN's Switch with the theme roles.
        process.env.EXPO_OS === 'android' ? (
          <RNSwitch
            testID="biometric-setting"
            accessibilityLabel={`${label} lock`}
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
              testID="biometric-setting"
              value={value}
              disabled={disabled}
              onValueChange={toggle}
              modifiers={[tint(theme.colors.toggle), accessibilityLabel(`${label} lock`)]}
            />
          </Host>
        )
      }
    />
  );
}

/** Footer copy for the privacy group: the lock's last error, why it's unavailable, or the widget note. */
export function useBiometricFooter() {
  const { enabled, available, message } = useAppLock();
  if (message) return message;
  if (!available && !enabled) return `Set up ${biometricMethods} in your device settings to use the lock.`;
  // Only iOS has the home-screen widget. Shown whether the lock is on or off,
  // so the footer does not appear and vanish as the switch flips.
  return process.env.EXPO_OS === 'ios' ? 'Widget previews are hidden while the lock is on.' : null;
}
