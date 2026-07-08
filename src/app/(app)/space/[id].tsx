import { EmptyState } from '@/components/empty-state';
import type { FeedItem } from '@/components/item-card';
import { MasonryFeed } from '@/components/masonry-feed';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMutation } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ProgressiveBlurHeader } from 'progressive-blur';
import { useMemo } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export default function SpaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useUnistyles();
  const { data: space } = useQuery(
    convexQuery(api.spaces.getSpace, { id: id as Id<'spaces'> }),
  );
  const deleteSpace = useMutation(api.spaces.deleteSpace);
  const acceptAllSuggestions = useMutation(api.spaces.acceptAllSuggestions);

  // Suggestions lead the feed (they're the ones asking for a decision),
  // wearing the sparkle badge; saved items follow. Item detail rebuilds this
  // exact ordering for swipe-paging, so keep the two in sync.
  const feedItems = useMemo<FeedItem[]>(() => {
    if (!space) return [];
    return [
      ...space.suggestions.map((item) => ({ ...item, suggested: true })),
      ...space.items,
    ];
  }, [space]);

  // `undefined` = loading (nothing cached yet); `null` = not found.
  if (space === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  if (space === null) {
    return (
      <View style={styles.loading}>
        <EmptyState title="Gone" message="This space no longer exists." />
      </View>
    );
  }

  const confirmDelete = () => {
    Alert.alert('Delete space?', 'Your saves stay in Home — only the shelf goes away.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          router.back();
          await deleteSpace({ id: space._id });
        },
      },
    ]);
  };

  const addAll = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    acceptAllSuggestions({ spaceId: space._id });
  };

  const suggestionCount = space.suggestions.length;

  return (
    <>
      <Stack.Title
        style={{
          fontFamily: theme.fonts.display,
          color: theme.colors.foreground,
        }}
      >
        {space.name}
      </Stack.Title>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="plus"
          tintColor={theme.colors.foreground}
          onPress={() =>
            router.push({ pathname: '/add', params: { spaceId: id } })
          }
        >
          Add
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Menu icon="ellipsis">
          <Stack.Toolbar.MenuAction
            icon="pencil"
            onPress={() =>
              router.push({ pathname: '/new-space', params: { id } })
            }
          >
            Edit space
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction icon="trash" destructive onPress={confirmDelete}>
            Delete space
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <View style={styles.container}>
        <MasonryFeed
          items={feedItems}
          source={{ from: 'space', spaceId: id }}
          firstItemZoomTarget
          ListHeaderComponent={
            suggestionCount > 0 ? (
              <Animated.View
                entering={FadeIn.duration(250)}
                exiting={FadeOut.duration(200)}
                style={styles.suggestionsPill}
              >
                <SymbolView name="sparkles" size={14} tintColor={theme.colors.primaryText} />
                <Text style={styles.suggestionsText}>
                  {suggestionCount === 1
                    ? '1 suggestion'
                    : `${suggestionCount} suggestions`}
                </Text>
                <Pressable
                  onPress={addAll}
                  hitSlop={8}
                  style={({ pressed }) => pressed && { opacity: 0.7 }}
                >
                  <Text style={styles.addAllText}>Add all</Text>
                </Pressable>
              </Animated.View>
            ) : undefined
          }
          ListEmptyComponent={
            <EmptyState
              title="Nothing here yet"
              message={'Amber is looking for saves that fit this space —\nor add your own with the + above.'}
            />
          }
        />
        <ProgressiveBlurHeader />
      </View>
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  suggestionsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1),
    alignSelf: 'center',
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 50,
    paddingVertical: theme.gap(1),
    paddingHorizontal: theme.gap(2),
    marginTop: theme.gap(0.5),
    marginBottom: theme.gap(1),
  },
  suggestionsText: {
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    color: theme.colors.primaryText,
  },
  addAllText: {
    fontFamily: theme.fonts.bold,
    fontSize: 13,
    color: theme.colors.primaryText,
    textDecorationLine: 'underline',
  },
}));
