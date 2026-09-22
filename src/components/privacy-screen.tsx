import { Wordmark } from '@/components/wordmark';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export function PrivacyScreen({
  title = 'Amber is locked',
  message,
  busy = false,
  action,
  actionLabel,
  recover,
}: {
  title?: string;
  message?: string | null;
  busy?: boolean;
  action?: () => void;
  actionLabel?: string;
  recover?: () => void;
}) {
  return (
    <View style={styles.container} testID="privacy-screen">
      <Wordmark size={44} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>
        {message ?? 'Unlock to see your private saves.'}
      </Text>
      {busy && <ActivityIndicator accessibilityLabel="Verifying access" />}
      {action && (
        <Pressable
          accessibilityRole="button"
          testID="unlock-button"
          disabled={busy}
          onPress={action}
          style={styles.button}
        >
          <Text style={styles.buttonText}>{actionLabel ?? 'Unlock Amber'}</Text>
        </Pressable>
      )}
      {recover && (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={recover}
          style={styles.secondary}
        >
          <Text style={styles.message}>Sign out and reset lock</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(2),
    padding: theme.gap(3),
    paddingTop: rt.insets.top + theme.gap(3),
    paddingBottom: rt.insets.bottom + theme.gap(3),
  },
  title: { ...theme.type.headline, color: theme.colors.foreground },
  message: {
    ...theme.type.body,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    padding: theme.gap(2),
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  buttonText: { ...theme.type.button, color: theme.colors.onTint },
  secondary: { padding: theme.gap(1.5) },
}));
