import { type FC } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import type { TidyCounts } from '@/lib/tidy/use-tidy-actions';

type Props = {
  counts: TidyCounts;
  /** Deletes queued but not yet confirmed via the system dialog. */
  pendingDeleteCount: number;
  /** Name of the current source, for the empty-source message. */
  sourceTitle: string;
  /** True when the source had no unreviewed photos at all. */
  empty: boolean;
  loading: boolean;
  onContinue: () => void;
};

/** Batch checkpoint: summarizes the sweep and gates the next batch behind
 * one delete-confirmation dialog. Also covers a source with nothing left. */
export const TidyDone: FC<Props> = ({
  counts,
  pendingDeleteCount,
  sourceTitle,
  empty,
  loading,
  onContinue,
}) => {
  const summary = [
    counts.kept === 1 ? '1 kept' : `${counts.kept} kept`,
    counts.saved === 1 ? '1 saved to Amber' : `${counts.saved} saved to Amber`,
    pendingDeleteCount + counts.deleted === 1
      ? '1 deleted'
      : `${pendingDeleteCount + counts.deleted} deleted`,
  ].join('  ·  ');

  return (
    <Animated.View entering={FadeIn.duration(250)} style={styles.container}>
      <Text style={styles.title}>{empty ? 'All tidied' : 'Batch tidied'}</Text>
      <Text style={styles.summary}>
        {empty ? `Nothing left to sort in ${sourceTitle}. Pick another source above.` : summary}
      </Text>
      {pendingDeleteCount > 0 && (
        <Text style={styles.note}>
          {pendingDeleteCount === 1
            ? "You'll be asked to confirm 1 deletion."
            : `You'll be asked to confirm ${pendingDeleteCount} deletions.`}
        </Text>
      )}
      {!empty && (
        <Pressable style={styles.button} onPress={onContinue} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Keep going</Text>
          )}
        </Pressable>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(1.5),
    paddingHorizontal: theme.gap(4),
    backgroundColor: theme.colors.background,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: 26,
    color: theme.colors.foreground,
  },
  summary: {
    fontFamily: theme.fonts.regular,
    fontSize: 15,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  note: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.faint,
    textAlign: 'center',
  },
  button: {
    marginTop: theme.gap(2),
    minWidth: 160,
    alignItems: 'center',
    paddingHorizontal: theme.gap(3),
    paddingVertical: theme.gap(1.5),
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.primary,
  },
  buttonText: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    color: 'white',
  },
}));
