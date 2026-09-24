import { SettingsRow } from '@/components/settings-list';
import { useAppLock } from '@/lib/app-lock';
import { biometricMethods } from '@/lib/app-lock-storage';
import { Host, Switch } from '@expo/ui';
import { accessibilityLabel, tint } from '@expo/ui/swift-ui/modifiers';
import { Switch as RNSwitch } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

/** "Face ID lock" row. The switch runs the biometric prompt before it flips. */
export function BiometricSetting() {
  const { enabled, available, label, busy, enable, disable } = useAppLock();
  const { theme } = useUnistyles();
  const disabled = busy || (!enabled && !available);
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
            value={enabled}
            disabled={disabled}
            onValueChange={(next) => void (next ? enable() : disable())}
            trackColor={{ true: theme.colors.toggle }}
            thumbColor={theme.colors.toggleThumb}
          />
        ) : (
          // A native toggle: RN's Switch mis-sizes on iOS 26+ and sits off-centre.
          <Host matchContents>
            <Switch
              testID="biometric-setting"
              value={enabled}
              disabled={disabled}
              onValueChange={(next) => void (next ? enable() : disable())}
              modifiers={[tint(theme.colors.toggle), accessibilityLabel(`${label} lock`)]}
            />
          </Host>
        )
      }
    />
  );
}

/** Footer copy for the privacy group: the lock's last error, or why it's unavailable. */
export function useBiometricFooter() {
  const { enabled, available, message } = useAppLock();
  if (message) return message;
  if (!available && !enabled) return `Set up ${biometricMethods} in your device settings to use the lock.`;
  // Only iOS has the home-screen widget.
  return enabled && process.env.EXPO_OS === 'ios' ? 'Widget previews are hidden while the lock is on.' : null;
}
