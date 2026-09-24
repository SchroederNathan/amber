import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { usePermissions, type PermissionResponse } from 'expo-media-library';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState, type FC } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { EmptyState } from '@/components/empty-state';
import { useToolbarIcon } from '@/components/ui/symbol';
import { Button } from '@/components/ui/button';
import { TidyDeck } from '@/components/tidy/tidy-deck';
import { TidyDone } from '@/components/tidy/tidy-done';
import { DeckAnimationProvider, useDeckAnimation } from '@/lib/tidy/deck-animation';
import { getSelectedAlbumId, setSelectedAlbumId } from '@/lib/tidy/storage';
import { ALL_PHOTOS_ID, useAlbums, type TidySource } from '@/lib/tidy/use-albums';
import { usePhotoBatch, type TidyPhoto } from '@/lib/tidy/use-photo-batch';
import { useTidyActions } from '@/lib/tidy/use-tidy-actions';

export default function TidyScreen() {
  // Tidy only reviews photos; without this Android also asks for music and video.
  const [permission, requestPermission] = usePermissions({ granularPermissions: ['photo'] });
  const granted = permission?.granted ?? false;

  const sources = useAlbums(granted);
  const [selectedId, setSelectedId] = useState<string>(
    () => getSelectedAlbumId() ?? ALL_PHOTOS_ID,
  );
  const source = useMemo(
    () => sources.find((s) => s.id === selectedId) ?? sources[0],
    [sources, selectedId],
  );

  const { batch, batchId, loading, loadNextBatch, noteDeleted } = usePhotoBatch({
    album: source.album,
    sourceId: source.id,
    enabled: granted,
  });

  const selectSource = useCallback((id: string) => {
    setSelectedId(id);
    setSelectedAlbumId(id === ALL_PHOTOS_ID ? null : id);
  }, []);

  if (!permission) {
    return <Loading />;
  }

  if (!granted) {
    return <PermissionGate permission={permission} requestPermission={requestPermission} />;
  }

  // `loading` is true until the batch for the active source has resolved
  // (initial grant or a source switch), which avoids showing a stale deck.
  if (loading || batch === null) {
    return <Loading />;
  }

  return (
    // Keyed by batch so every batch remounts fresh shared values and deck
    // state — indices always start at the top card.
    <DeckAnimationProvider key={batchId} lastIndex={batch.length - 1}>
      <TidyDeckView
        batch={batch}
        sources={sources}
        selectedId={source.id}
        selectSource={selectSource}
        limitedAccess={(permission as PermissionResponse).accessPrivileges === 'limited'}
        loadNextBatch={loadNextBatch}
        noteDeleted={noteDeleted}
      />
    </DeckAnimationProvider>
  );
}

type DeckViewProps = {
  batch: TidyPhoto[];
  sources: TidySource[];
  selectedId: string;
  selectSource: (id: string) => void;
  limitedAccess: boolean;
  loadNextBatch: () => Promise<void>;
  noteDeleted: (count: number) => void;
};

const TidyDeckView: FC<DeckViewProps> = ({
  batch,
  sources,
  selectedId,
  selectSource,
  limitedAccess,
  loadNextBatch,
  noteDeleted,
}) => {
  const { undoIndex } = useDeckAnimation();
  const { topIndex, counts, pendingDeleteCount, canUndo, onDecision, undo, commitDeletes } =
    useTidyActions({ batch, noteDeleted });
  const [continuing, setContinuing] = useState(false);
  const undoIcon = useToolbarIcon('arrow.uturn.backward');
  const deleteIcon = useToolbarIcon('trash');
  const albumIcon = useToolbarIcon('photo.on.rectangle.angled');

  // Leaving the tab (or backgrounding the screen) flushes queued deletions so
  // the batch never silently outlives the session.
  useFocusEffect(
    useCallback(() => {
      return () => {
        commitDeletes();
      };
    }, [commitDeletes]),
  );

  const handleUndo = () => {
    const index = undo();
    if (index === null) return;
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    undoIndex.set(index);
  };

  const handleContinue = async () => {
    setContinuing(true);
    try {
      await commitDeletes();
      await loadNextBatch();
    } finally {
      setContinuing(false);
    }
  };

  const currentSource = sources.find((s) => s.id === selectedId) ?? sources[0];
  const batchDone = topIndex < 0;
  const reviewedCount = batch.length - 1 - topIndex;

  return (
    <View style={styles.container}>
      <Stack.Title asChild>
        <Text style={styles.title}>{currentSource.title}</Text>
      </Stack.Title>

      {/* Native header controls (note 3): undo on the left, delete on the
          right with a live count badge. */}
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon={undoIcon} accessibilityLabel="Undo" hidden={!canUndo} onPress={handleUndo}>
          Undo
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon={deleteIcon} accessibilityLabel="Delete" hidden={pendingDeleteCount === 0} onPress={commitDeletes}>
          <Stack.Toolbar.Label>Delete</Stack.Toolbar.Label>
          {pendingDeleteCount > 0 && (
            <Stack.Toolbar.Badge>{String(pendingDeleteCount)}</Stack.Toolbar.Badge>
          )}
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Menu icon={albumIcon} accessibilityLabel="Albums">
          {sources.map((s) => (
            <Stack.Toolbar.MenuAction
              key={s.id}
              isOn={s.id === selectedId}
              onPress={() => selectSource(s.id)}
            >
              {s.title}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>

      {/* Centered progress counter (note 2). */}
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          {Math.min(reviewedCount, batch.length)} / {batch.length}
        </Text>
      </View>

      <View style={styles.deckArea}>
        <TidyDeck photos={batch} onDecision={onDecision} />
        {batchDone && (
          <TidyDone
            counts={counts}
            pendingDeleteCount={pendingDeleteCount}
            sourceTitle={currentSource.title}
            empty={batch.length === 0}
            loading={continuing}
            onContinue={handleContinue}
          />
        )}
      </View>

      {limitedAccess && (
        <Pressable style={styles.limitedBanner} onPress={() => Linking.openSettings()}>
          <Text style={styles.limitedText}>
            Amber can only see some photos — tap to manage access.
          </Text>
        </Pressable>
      )}
    </View>
  );
};

const PermissionGate: FC<{
  permission: PermissionResponse;
  requestPermission: () => Promise<PermissionResponse>;
}> = ({ permission, requestPermission }) => {
  const handlePress = () => {
    if (permission.canAskAgain) {
      requestPermission();
    } else {
      Linking.openSettings();
    }
  };

  return (
    <View style={styles.gate}>
      <EmptyState
        title="Tidy your camera roll"
        message={
          'Swipe through your photos one by one.\nKeep them, delete them, or save them into Amber.'
        }
      />
      <Button
        title={permission.canAskAgain ? 'Allow photo access' : 'Open Settings'}
        style={styles.gateButton}
        onPress={handlePress}
      />
    </View>
  );
};

const Loading: FC = () => (
  <View style={styles.loading}>
    <ActivityIndicator />
  </View>
);

// iOS lays the deck under a transparent header and a floating tab bar, so it
// pads past both. Android's opaque header and bottom navigation already sit
// outside the content, so there the deck only needs a small gap.
const underBars = process.env.EXPO_OS === 'ios';

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  title: {
    ...theme.type.largeTitle,
    letterSpacing: 0.5,
    color: theme.colors.foreground,
  },
  progressRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: underBars ? rt.insets.top + theme.gap(6) : theme.gap(2),
    paddingBottom: theme.gap(1),
  },
  progressText: {
    ...theme.type.label,
    color: theme.colors.muted,
  },
  deckArea: {
    flex: 1,
    marginHorizontal: theme.gap(2),
    // Clear the floating native tab bar with a comfortable gap (note 5).
    marginBottom: underBars ? rt.insets.bottom + theme.gap(11) : theme.gap(4),
  },
  limitedBanner: {
    position: 'absolute',
    bottom: underBars ? rt.insets.bottom + theme.gap(11) : theme.gap(4),
    left: theme.gap(2),
    right: theme.gap(2),
    paddingHorizontal: theme.gap(2),
    paddingVertical: theme.gap(1),
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surfaceMuted,
  },
  limitedText: {
    ...theme.type.caption,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  gate: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingBottom: theme.gap(6),
  },
  gateButton: {
    alignSelf: 'center',
    marginBottom: theme.gap(6),
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
}));
