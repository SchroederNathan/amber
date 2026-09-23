import { useAppLock } from '@/lib/app-lock';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export function BiometricSetting() {
  const { enabled, available, label, busy, message, enable, disable } =
    useAppLock();
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Keep your saves private</Text>
      <Text style={styles.description}>
        {enabled
          ? `${label} is required whenever you reopen Amber. Widget previews are hidden.`
          : 'Require Face ID or a fingerprint when you reopen Amber. Anyone enrolled in this phone’s biometrics can unlock it.'}
      </Text>
      {!available && !enabled && (
        <Text style={styles.description}>
          Set up Face ID or a fingerprint in your device settings to use this
          optional lock.
        </Text>
      )}
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{
          checked: enabled,
          disabled: busy || (!enabled && !available),
        }}
        testID="biometric-setting"
        disabled={busy || (!enabled && !available)}
        onPress={() => void (enabled ? disable() : enable())}
        style={styles.button}
      >
        <Text style={styles.buttonText}>
          {busy
            ? 'Verifying…'
            : enabled
              ? 'Turn off biometric lock'
              : `Enable ${label}`}
        </Text>
      </Pressable>
      {message && (
        <Text accessibilityRole="alert" style={styles.description}>
          {message}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    alignSelf: 'stretch',
    gap: theme.gap(1.5),
    padding: theme.gap(2),
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
  },
  title: { ...theme.type.button, color: theme.colors.foreground },
  description: { ...theme.type.footnote, color: theme.colors.muted },
  button: {
    paddingVertical: theme.gap(1),
    minHeight: 44,
    justifyContent: 'center',
  },
  buttonText: { ...theme.type.button, color: theme.colors.primaryText },
}));
