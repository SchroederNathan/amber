import { SettingsRow, SettingsValue } from '@/components/settings-list';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { useUnistyles } from 'react-native-unistyles';

// Dev clients load JS from Metro, so there is nothing for EAS Update to swap in.
const updatesEnabled = Updates.isEnabled && !__DEV__;

/**
 * Manual EAS Update check. The native side already checks on launch; this lets
 * someone pull an update on their build's channel without cold-starting the app.
 * A found update downloads straight away, then the row offers the restart.
 */
export function UpdateSetting() {
  const { theme } = useUnistyles();
  const { isChecking, isDownloading, isUpdatePending } = Updates.useUpdates();
  const [status, setStatus] = useState<string | null>(null);
  const busy = isChecking || isDownloading;

  const check = async () => {
    setStatus(null);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setStatus('Up to date');
        return;
      }
      const fetched = await Updates.fetchUpdateAsync();
      if (!fetched.isNew && !fetched.isRollBackToEmbedded) setStatus('Up to date');
    } catch {
      setStatus('Couldn’t check');
    }
  };

  const restart = async () => {
    try {
      await Updates.reloadAsync({
        reloadScreenOptions: {
          backgroundColor: theme.colors.background,
          spinner: { color: theme.colors.tint },
        },
      });
    } catch {
      setStatus('Reopen Amber');
    }
  };

  const value = !updatesEnabled
    ? 'Off in dev'
    : isChecking
      ? 'Checking…'
      : isDownloading
        ? 'Downloading…'
        : isUpdatePending
          ? 'Restart'
          : status;

  return (
    <SettingsRow
      testID="update-setting"
      icon="arrow.triangle.2.circlepath"
      label={isUpdatePending ? 'Update ready' : 'Check for updates'}
      disabled={!updatesEnabled || busy}
      onPress={() => void (isUpdatePending ? restart() : check())}
      trailing={value ? <SettingsValue>{value}</SettingsValue> : undefined}
    />
  );
}

/** "Version 1.0.0 · Update from Sep 23, 2026 · production" footer line. */
export function useVersionLabel() {
  const { currentlyRunning } = Updates.useUpdates();
  const channel = currentlyRunning.channel ?? Updates.channel;
  const update =
    updatesEnabled && !currentlyRunning.isEmbeddedLaunch && currentlyRunning.createdAt
      ? `Update from ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(currentlyRunning.createdAt)}`
      : null;
  const version = Constants.expoConfig?.version;
  return [version && `Version ${version}`, update, channel].filter(Boolean).join(' · ') || null;
}
