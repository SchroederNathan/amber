import { EmptyState } from '@/components/empty-state';
import { ItemDetail, type DetailItem } from '@/components/item-detail';
import { ItemHeader } from '@/components/item-header';
import { convexQuery } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { FlashList, type FlashListRef, type ViewToken } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { useMutation } from 'convex/react';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Share,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export default function ItemScreen() {
  const { id, from, spaceId, q } = useLocalSearchParams<{
    id: string;
    from?: string;
    spaceId?: string;
    q?: string;
  }>();
  const router = useRouter();
  const { theme } = useUnistyles();
  const { width, height } = useWindowDimensions();
  const deleteItem = useMutation(api.items.deleteItem);
  const listRef = useRef<FlashListRef<DetailItem>>(null);

  // Rebuild the ordered sibling list from whichever list the user opened from.
  // Each of these queries is already warm in the cache from the source screen,
  // so this is a cache read, not a network round-trip.
  const listQ = useQuery({
    ...convexQuery(api.items.listItems, {}),
    enabled: from !== 'space' && from !== 'search',
  });
  const spaceQ = useQuery({
    ...convexQuery(api.spaces.getSpace, { id: (spaceId ?? '') as Id<'spaces'> }),
    enabled: from === 'space' && !!spaceId,
  });
  const searchQ = useQuery({
    ...convexQuery(api.items.searchItems, { query: q ?? '' }),
    enabled: from === 'search' && !!q,
  });

  // A single-item fallback for deep links (no source) or a stale list that no
  // longer contains this id.
  const { data: single } = useQuery(
    convexQuery(api.items.getItem, { id: id as Id<'items'> }),
  );

  const list: DetailItem[] | undefined =
    from === 'space'
      ? spaceQ.data?.items
      : from === 'search'
        ? searchQ.data
        : listQ.data;

  const startIndex = list ? list.findIndex((i) => i._id === id) : -1;

  // Prefer the sibling list when it contains this item; otherwise page over the
  // single item alone. `undefined` means we're still loading.
  const items = useMemo<DetailItem[] | undefined>(
    () =>
      startIndex >= 0
        ? list
        : single
          ? [single]
          : single === null
            ? []
            : undefined,
    [startIndex, list, single],
  );

  // The id the screen was pushed with owns the Apple-zoom target; captured once
  // so swiping (which rewrites the `id` param) never re-pairs the transition.
  const [pushedId] = useState(id);
  const [activeId, setActiveId] = useState(id);
  const [editing, setEditing] = useState(false);

  const onViewable = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<DetailItem>[] }) => {
      const first = viewableItems[0]?.item as DetailItem | undefined;
      if (first) {
        setActiveId(first._id);
        router.setParams({ id: first._id });
      }
    },
    [router],
  );
  const viewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 60 }),
    [],
  );

  const activeItem = items?.find((i) => i._id === activeId) ?? items?.[0];

  // A link shares its URL; a saved image/sticker shares the picture itself.
  // `expo-sharing` needs a local file, so the remote image is cached first.
  const shareActive = useCallback(async () => {
    if (!activeItem) return;
    if (!activeItem.imageUrl) {
      if (activeItem.url) await Share.share({ url: activeItem.url });
      return;
    }
    try {
      if (!(await Sharing.isAvailableAsync())) {
        if (activeItem.url) await Share.share({ url: activeItem.url });
        return;
      }
      const ext = activeItem.isSticker ? 'png' : 'jpg';
      const file = new File(Paths.cache, `${activeItem._id}.${ext}`);
      if (file.exists) file.delete();
      await File.downloadFileAsync(activeItem.imageUrl, file);
      await Sharing.shareAsync(file.uri, {
        mimeType: activeItem.isSticker ? 'image/png' : 'image/jpeg',
        UTI: activeItem.isSticker ? 'public.png' : 'public.jpeg',
        dialogTitle: activeItem.title ?? 'Share',
      });
    } catch {
      // User cancelled the sheet, or the download/share failed — nothing to do.
    }
  }, [activeItem]);

  const copyLink = useCallback(async () => {
    if (!activeItem?.url) return;
    await Clipboard.setStringAsync(activeItem.url);
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [activeItem]);

  const onDelete = useCallback(async () => {
    if (!activeItem || !items) return;
    const idx = items.findIndex((i) => i._id === activeItem._id);
    const neighbor = items[idx + 1] ?? items[idx - 1];
    if (neighbor) {
      // Slide to the neighbour first, then remove the current save; Convex's
      // reactive query drops it from the list behind us.
      listRef.current?.scrollToIndex({ index: items.indexOf(neighbor), animated: true });
      setActiveId(neighbor._id);
      router.setParams({ id: neighbor._id });
    } else {
      router.back();
    }
    await deleteItem({ id: activeItem._id });
  }, [activeItem, items, deleteItem, router]);

  if (items === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.loading}>
        <EmptyState title="Gone" message="This save no longer exists." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      <Stack.Title asChild>
        <ItemHeader item={activeItem} />
      </Stack.Title>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon="ellipsis">
          <Stack.Toolbar.MenuAction icon="square.and.arrow.up" onPress={shareActive}>
            Share
          </Stack.Toolbar.MenuAction>
          {activeItem?.url ? (
            <Stack.Toolbar.MenuAction icon="doc.on.doc" onPress={copyLink}>
              Copy link
            </Stack.Toolbar.MenuAction>
          ) : null}
          <Stack.Toolbar.MenuAction icon="trash" destructive onPress={onDelete}>
            Delete
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>


      <FlashList
        ref={listRef}
        style={styles.container}
        data={items}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item._id}
        initialScrollIndex={startIndex >= 0 ? startIndex : 0}
        renderItem={({ item }) => (
          // Each page is bounded to the screen so the inner vertical ScrollView
          // has a fixed height to scroll within (rather than growing to fit).
          <View style={{ width, height }}>
            <ItemDetail item={item} isZoomTarget={item._id === pushedId} />
          </View>
        )}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={viewabilityConfig}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
}));
