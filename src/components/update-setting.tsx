import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

// Dev clients load JS from Metro, so there is nothing for EAS Update to swap in.
const updatesEnabled = Updates.isEnabled && !__DEV__;

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

/**
 * Manual EAS Update check. The native side already checks on launch; this lets
 * someone pull an update on their build's channel without cold-starting the app.
 * A found update downloads straight away, then the button offers the restart.
 */
export function UpdateSetting() {
  const { theme } = useUnistyles();
  const { currentlyRunning, isChecking, isDownloading, isUpdatePending } =
    Updates.useUpdates();
  const [message, setMessage] = useState<string | null>(null);
  const busy = isChecking || isDownloading;

  const check = async () => {
    setMessage(null);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setMessage('You’re on the latest version.');
        return;
      }
      const fetched = await Updates.fetchUpdateAsync();
      if (!fetched.isNew && !fetched.isRollBackToEmbedded) {
        setMessage('You’re on the latest version.');
      }
    } catch {
      setMessage('Could not check for updates. Check your connection and try again.');
    }
  };

  const restart = async () => {
    try {
      await Updates.reloadAsync({
        reloadScreenOptions: {
          backgroundColor: theme.colors.background,
          spinner: { color: theme.colors.primary },
        },
      });
    } catch {
      setMessage('Could not restart Amber. Close and reopen the app to finish updating.');
    }
  };

  const running = !updatesEnabled
    ? 'Updates are off in development builds.'
    : currentlyRunning.isEmbeddedLaunch || !currentlyRunning.createdAt
      ? 'Running the version this build shipped with.'
      : `Running the update from ${dateFormat.format(currentlyRunning.createdAt)}.`;
  const channel = currentlyRunning.channel ?? Updates.channel;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>App updates</Text>
      <Text style={styles.description}>
        {channel ? `${running} Channel: ${channel}.` : running}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !updatesEnabled || busy, busy }}
        testID="update-setting"
        disabled={!updatesEnabled || busy}
        onPress={() => void (isUpdatePending ? restart() : check())}
        style={styles.button}
      >
        <Text style={[styles.buttonText, !updatesEnabled && styles.buttonTextDisabled]}>
          {isChecking
            ? 'Checking…'
            : isDownloading
              ? 'Downloading…'
              : isUpdatePending
                ? 'Restart to update'
                : 'Check for updates'}
        </Text>
      </Pressable>
      {isUpdatePending && !busy && (
        <Text style={styles.description}>
          A new version is ready. Restart now, or it installs the next time you open Amber.
        </Text>
      )}
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
  buttonTextDisabled: { color: theme.colors.muted },
}));
