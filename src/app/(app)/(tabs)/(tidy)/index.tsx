import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { usePermissions, type PermissionResponse } from 'expo-media-library';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState, type FC } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { EmptyState } from '@/components/empty-state';
import { TidyDeck } from '@/components/tidy/tidy-deck';
import { TidyDone } from '@/components/tidy/tidy-done';
import { DeckAnimationProvider, useDeckAnimation } from '@/lib/tidy/deck-animation';
import { getSelectedAlbumId, setSelectedAlbumId } from '@/lib/tidy/storage';
import { ALL_PHOTOS_ID, useAlbums, type TidySource } from '@/lib/tidy/use-albums';
import { usePhotoBatch, type TidyPhoto } from '@/lib/tidy/use-photo-batch';
import { useTidyActions } from '@/lib/tidy/use-tidy-actions';

export default function TidyScreen() {
  const [permission, requestPermission] = usePermissions();
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
        limitedAccess={permission.accessPrivileges === 'limited'}
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
      <Stack.Screen options={{ title: currentSource.title }} />

      {/* Native header controls (note 3): undo on the left, delete on the
          right with a live count badge. */}
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon="arrow.uturn.backward" hidden={!canUndo} onPress={handleUndo}>
          Undo
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="trash" hidden={pendingDeleteCount === 0} onPress={commitDeletes}>
          <Stack.Toolbar.Label>Delete</Stack.Toolbar.Label>
          {pendingDeleteCount > 0 && (
            <Stack.Toolbar.Badge>{String(pendingDeleteCount)}</Stack.Toolbar.Badge>
          )}
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Menu icon="photo.on.rectangle.angled">
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
      <Pressable style={styles.gateButton} onPress={handlePress}>
        <Text style={styles.gateButtonText}>
          {permission.canAskAgain ? 'Allow photo access' : 'Open Settings'}
        </Text>
      </Pressable>
    </View>
  );
};

const Loading: FC = () => (
  <View style={styles.loading}>
    <ActivityIndicator />
  </View>
);

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  progressRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: rt.insets.top + theme.gap(6),
    paddingBottom: theme.gap(1),
  },
  progressText: {
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    color: theme.colors.muted,
  },
  deckArea: {
    flex: 1,
    marginHorizontal: theme.gap(2),
    // Clear the floating native tab bar with a comfortable gap (note 5).
    marginBottom: rt.insets.bottom + theme.gap(11),
  },
  limitedBanner: {
    position: 'absolute',
    bottom: rt.insets.bottom + theme.gap(11),
    left: theme.gap(2),
    right: theme.gap(2),
    paddingHorizontal: theme.gap(2),
    paddingVertical: theme.gap(1),
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surfaceMuted,
  },
  limitedText: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
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
    paddingHorizontal: theme.gap(3),
    paddingVertical: theme.gap(1.5),
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.primary,
  },
  gateButtonText: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    color: 'white',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
}));
