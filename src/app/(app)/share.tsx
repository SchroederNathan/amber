import { useAppLock } from '@/lib/app-lock';
import {
  pendingSharedPayloads,
  requestShareIntake,
  useShareIntakeSaving,
} from '@/lib/share-intake';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

/**
 * Landing screen for content shared into Amber from another app (Safari, Photos,
 * etc.). `ShareIntake` in the app layout does the saving; this screen shows
 * progress and drops the user on Home once nothing is left to save.
 */
export default function ShareScreen() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const { foreground } = useAppLock();
  const saving = useShareIntakeSaving();

  useEffect(() => {
    requestShareIntake();
  }, []);

  // Also leaves when the route opens with nothing pending, e.g. restored
  // after a reload, so the spinner never waits on a share that isn't coming.
  useEffect(() => {
    if (!foreground || saving) return;
    if (pendingSharedPayloads().length === 0) router.replace('/');
  }, [foreground, saving, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={theme.colors.tint} />
      <Text style={styles.label}>Saving to Amber…</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(1.5),
    backgroundColor: theme.colors.background,
  },
  label: {
    ...theme.type.subheadLabel,
    color: theme.colors.muted,
  },
}));
