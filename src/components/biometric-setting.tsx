import { SettingsRow } from '@/components/settings-list';
import { useAppLock } from '@/lib/app-lock';
import { Host, Switch } from '@expo/ui';
import { accessibilityLabel, tint } from '@expo/ui/swift-ui/modifiers';
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
        // A native toggle: RN's Switch mis-sizes on iOS 26+ and sits off-centre.
        <Host matchContents>
          <Switch
            testID="biometric-setting"
            value={enabled}
            disabled={disabled}
            onValueChange={(next) => void (next ? enable() : disable())}
            modifiers={
              process.env.EXPO_OS === 'ios'
                ? [tint(theme.colors.toggle), accessibilityLabel(`${label} lock`)]
                : undefined
            }
          />
        </Host>
      }
    />
  );
}

/** Footer copy for the privacy group: the lock's last error, or why it's unavailable. */
export function useBiometricFooter() {
  const { enabled, available, message } = useAppLock();
  if (message) return message;
  if (!available && !enabled) return 'Set up Face ID or a fingerprint in your device settings to use the lock.';
  return enabled ? 'Widget previews are hidden while the lock is on.' : null;
}
