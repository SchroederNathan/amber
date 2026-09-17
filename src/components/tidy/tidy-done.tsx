import { type FC } from 'react';
import { Text } from 'react-native';
import { Button } from '@/components/ui/button';
import { fadeIn } from '@/styles/motion';
import Animated from 'react-native-reanimated';
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
    <Animated.View entering={fadeIn} style={styles.container}>
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
        <Button title="Keep going" style={styles.button} onPress={onContinue} loading={loading} />
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
    ...theme.type.largeTitle,
    color: theme.colors.foreground,
  },
  summary: {
    ...theme.type.subhead,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  note: {
    ...theme.type.caption,
    color: theme.colors.faint,
    textAlign: 'center',
  },
  button: {
    marginTop: theme.spacing.lg,
    minWidth: 160,
  },
}));
