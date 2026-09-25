import { fadeOut, motion } from '@/theme/motion';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { ItemDetail, type DetailItem } from '@/components/item-detail';
import { ItemHeader } from '@/components/item-header';
import { convexQuery } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { FlashList, type FlashListRef, type ViewToken } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { useMutation } from 'convex/react';
import { AppEntityView } from 'expo-app-intents';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
  useRouter,
  type NativeStackNavigationProp,
} from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { SymbolView, useToolbarIcon } from '@/components/ui/symbol';
import { shareUrl } from '@/lib/url';
import Animated, { SlideInDown, ReduceMotion, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

const decisionBarEnter = SlideInDown.duration(motion.duration.enter)
  .easing(motion.easing.out)
  .reduceMotion(ReduceMotion.System);

export default function ItemScreen() {
  const { id, from, spaceId, q } = useLocalSearchParams<{
    id: string;
    from?: string;
    spaceId?: string;
    q?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation<NativeStackNavigationProp<{ 'item/[id]': { id: string } }>>();
  const { theme } = useUnistyles();
  const menuIcon = useToolbarIcon('ellipsis', 'more_vert');
  const shareIcon = useToolbarIcon('square.and.arrow.up');
  const copyIcon = useToolbarIcon('doc.on.doc');
  const deleteIcon = useToolbarIcon('trash');
  const reducedMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const deleteItem = useMutation(api.items.deleteItem);
  const acceptSuggestion = useMutation(api.spaces.acceptSuggestion);
  const dismissSuggestion = useMutation(api.spaces.dismissSuggestion);
  const listRef = useRef<FlashListRef<DetailItem>>(null);

  // Rebuild the ordered sibling list from whichever list the user opened from.
  // Each of these queries is already warm in the cache from the source screen,
  // so this is a cache read, not a network round-trip.
  const listQ = useQuery(
    convexQuery(api.items.listItems, from !== 'space' && from !== 'search' ? {} : 'skip'),
  );
  const spaceQ = useQuery(
    convexQuery(
      api.spaces.getSpace,
      from === 'space' && spaceId ? { id: spaceId as Id<'spaces'> } : 'skip',
    ),
  );
  const searchQ = useQuery(
    convexQuery(api.items.searchItems, from === 'search' && q ? { query: q } : 'skip'),
  );

  // A single-item fallback for deep links (no source) or a stale list that no
  // longer contains this id.
  const { data: single } = useQuery(
    convexQuery(api.items.getItem, { id: id as Id<'items'> }),
  );

  // Mirror the space screen's feed order exactly (suggestions first, then
  // saved) so swiping pages through what the user saw in the grid.
  const list = useMemo<DetailItem[] | undefined>(
    () =>
      from === 'space'
        ? spaceQ.data
          ? [...spaceQ.data.suggestions, ...spaceQ.data.items]
          : undefined
        : from === 'search'
          ? searchQ.data
          : listQ.data,
    [from, spaceQ.data, searchQ.data, listQ.data],
  );

  const suggestedIds = useMemo(
    () => new Set(spaceQ.data?.suggestions.map((i) => i._id) ?? []),
    [spaceQ.data],
  );

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
  const activeIdRef = useRef(id);

  // Keeping the route `id` param in sync writes navigation state, which
  // re-renders the entire native-stack tree — a ~16ms cascade profiled as the
  // single most expensive JS event per swipe. `activeId` (local state) already
  // drives the header/toolbar/actions, so only the deep-link/restore URL needs
  // the param. Debounce it so a run of swipes writes once, after it settles,
  // instead of paying the cascade on every page.
  const paramTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelParamUpdate = useCallback(() => {
    if (paramTimer.current !== null) {
      clearTimeout(paramTimer.current);
      paramTimer.current = null;
    }
  }, []);
  const onViewable = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<DetailItem>[] }) => {
      const first = viewableItems[0]?.item as DetailItem | undefined;
      if (!first || !navigation.isFocused() || first._id === activeIdRef.current) return;
      activeIdRef.current = first._id;
      setActiveId(first._id);
      cancelParamUpdate();
      paramTimer.current = setTimeout(() => {
        paramTimer.current = null;
        if (navigation.isFocused()) navigation.setParams({ id: first._id });
      }, 350);
    },
    [navigation, cancelParamUpdate],
  );
  useFocusEffect(
    useCallback(() => {
      // A covered screen stays mounted. Cancel its pending write on blur, then
      // restore the current page's URL when this screen receives focus again.
      if (activeIdRef.current !== id) navigation.setParams({ id: activeIdRef.current });
      return cancelParamUpdate;
    }, [id, navigation, cancelParamUpdate]),
  );
  const viewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 60 }),
    [],
  );

  // Stable so an ItemScreen re-render (setActiveId on every swipe) doesn't hand
  // FlashList a fresh renderItem/style and force every mounted page to re-render.
  const pageStyle = useMemo(() => ({ width, height }), [width, height]);
  const keyExtractor = useCallback((item: DetailItem) => item._id, []);
  const renderItem = useCallback(
    ({ item }: { item: DetailItem }) => (
      // Each page is bounded to the screen so the inner vertical ScrollView
      // has a fixed height to scroll within (rather than growing to fit).
      // AppEntityView tells Siri which save is on screen ("send this to Sam").
      <AppEntityView entity="item" entityId={item._id} style={pageStyle}>
        <ItemDetail item={item} isZoomTarget={item._id === pushedId} />
      </AppEntityView>
    ),
    [pageStyle, pushedId],
  );

  const activeItem = items?.find((i) => i._id === activeId) ?? items?.[0];

  // A link shares its URL; a saved image/sticker shares the picture itself.
  // `expo-sharing` needs a local file, so the remote image is cached first.
  const shareActive = useCallback(async () => {
    if (!activeItem) return;
    if (!activeItem.imageUrl) {
      if (activeItem.url) await shareUrl(activeItem.url);
      return;
    }
    try {
      if (!(await Sharing.isAvailableAsync())) {
        if (activeItem.url) await shareUrl(activeItem.url);
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

  // Suggested items (opened from a space) trade the normal footer for an
  // Add / Dismiss decision bar. Accepting keeps the page open — the bar just
  // drops away as the suggestion becomes a real membership.
  const activeIsSuggested =
    from === 'space' &&
    !!spaceId &&
    !!activeId &&
    suggestedIds.has(activeId as Id<'items'>);

  const onAccept = useCallback(() => {
    if (!spaceId || !activeId) return;
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    acceptSuggestion({
      itemId: activeId as Id<'items'>,
      spaceId: spaceId as Id<'spaces'>,
    });
  }, [spaceId, activeId, acceptSuggestion]);

  const onDismiss = useCallback(async () => {
    if (!spaceId || !activeId || !items) return;
    cancelParamUpdate();
    // The dismissed item leaves the space's list; slide to a neighbour first,
    // mirroring delete, so the pager never lands on a vanished page.
    const idx = items.findIndex((i) => i._id === activeId);
    const neighbor = items[idx + 1] ?? items[idx - 1];
    const dismissedId = activeId as Id<'items'>;
    if (neighbor) {
      activeIdRef.current = neighbor._id;
      listRef.current?.scrollToIndex({ index: items.indexOf(neighbor), animated: true });
      setActiveId(neighbor._id);
      navigation.setParams({ id: neighbor._id });
    } else {
      router.back();
    }
    await dismissSuggestion({
      itemId: dismissedId,
      spaceId: spaceId as Id<'spaces'>,
    });
  }, [spaceId, activeId, items, dismissSuggestion, router, navigation, cancelParamUpdate]);

  const onDelete = useCallback(async () => {
    if (!activeItem || !items) return;
    cancelParamUpdate();
    const idx = items.findIndex((i) => i._id === activeItem._id);
    const neighbor = items[idx + 1] ?? items[idx - 1];
    if (neighbor) {
      // Slide to the neighbour first, then remove the current save; Convex's
      // reactive query drops it from the list behind us.
      activeIdRef.current = neighbor._id;
      listRef.current?.scrollToIndex({ index: items.indexOf(neighbor), animated: true });
      setActiveId(neighbor._id);
      navigation.setParams({ id: neighbor._id });
    } else {
      router.back();
    }
    await deleteItem({ id: activeItem._id });
  }, [activeItem, items, deleteItem, router, navigation, cancelParamUpdate]);

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
      {/* Android's dropdown (and its icon button) take this fill; it matches the bar. */}
      <Stack.Toolbar placement="right" backgroundColor={theme.colors.background}>
        <Stack.Toolbar.Menu icon={menuIcon} accessibilityLabel="More">
          <Stack.Toolbar.MenuAction icon={shareIcon} onPress={shareActive}>
            Share
          </Stack.Toolbar.MenuAction>
          {activeItem?.url ? (
            <Stack.Toolbar.MenuAction icon={copyIcon} onPress={copyLink}>
              Copy link
            </Stack.Toolbar.MenuAction>
          ) : null}
          <Stack.Toolbar.MenuAction icon={deleteIcon} destructive onPress={onDelete}>
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
        keyExtractor={keyExtractor}
        initialScrollIndex={startIndex >= 0 ? startIndex : 0}
        renderItem={renderItem}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={viewabilityConfig}
      />

      {activeIsSuggested ? (
        // SlideInDown (not a fade) so the bar never mounts at opacity 0 — a
        // GlassView whose parent starts fully transparent silently fails to
        // render the liquid glass (expo/expo#41024).
        <Animated.View
          entering={reducedMotion ? undefined : decisionBarEnter}
          exiting={fadeOut}
          style={[styles.decisionBar, { bottom: insets.bottom + theme.gap(1.5) }]}
        >
          <Button title="Dismiss" variant="secondary" onPress={onDismiss} style={styles.dismissWrap} />
          <Button
            title="Add to space"
            icon={<SymbolView name="sparkles" size={15} tintColor={theme.colors.onPrimary} />}
            onPress={onAccept}
            style={styles.acceptWrap}
          />
        </Animated.View>
      ) : null}
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
  decisionBar: {
    position: 'absolute',
    left: theme.gap(2),
    right: theme.gap(2),
    flexDirection: 'row',
    gap: theme.gap(1),
  },
  dismissWrap: {
    flex: 1,
  },
  acceptWrap: {
    flex: 2,
  },
}));
