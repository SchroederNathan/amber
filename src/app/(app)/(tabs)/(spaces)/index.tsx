import { EmptyState } from '@/components/empty-state';
import { api } from '@convex/_generated/api';
import { convexQuery } from '@convex-dev/react-query';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

// Standard OpenGraph image shape (1200×630) — the default when a link's real
// hero dimensions weren't captured. Mirrors item-card so covers match the feed.
const OG_RATIO = 1.91;

function clampRatio(ratio: number | undefined, fallback: number) {
  const value = ratio && !Number.isNaN(ratio) ? ratio : fallback;
  return Math.min(Math.max(value, 0.5), 2);
}

function timeAgo(ms: number) {
  const mins = Math.floor((Date.now() - ms) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

// Tilt + drop each cover to fan them out; the center sits upright and on top.
function coverTransform(i: number, n: number) {
  if (n <= 1) return { zIndex: 2 };
  const offset = i - (n - 1) / 2;
  return {
    marginHorizontal: -14,
    zIndex: Math.abs(offset) < 0.5 ? 3 : 1,
    transform: [{ translateY: Math.abs(offset) * 10 }, { rotate: `${offset * 8}deg` }],
  };
}

export default function SpacesScreen() {
  const { theme } = useUnistyles();
  const { data: spaces } = useQuery(convexQuery(api.spaces.listSpaces, {}));

  if (spaces === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  if (spaces.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Make a space"
          message={'Spaces are shelves for a theme — design inspiration,\nrecipes, gift ideas. New saves file themselves.'}
        />
      </View>
    );
  }

  return (
    <FlashList
      data={spaces}
      keyExtractor={(space) => space._id}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      renderItem={({ item: space, index }) => {
        // `previews` can be briefly absent when the offline cache rehydrates an
        // older query shape before the live refetch lands.
        const previews = (space.previews ?? []).slice(0, 3);
        return (
          <Animated.View
            style={styles.card}
            entering={FadeInDown.delay(index * 60).duration(350)}
          >
            <Link href={`/space/${space._id}`} asChild>
              <Link.Trigger>
                <View style={styles.cardInner}>
                  <View style={styles.topRow}>
                    <View style={styles.meta}>
                      <SymbolView name="clock" size={16} tintColor={theme.colors.muted} />
                      <Text style={styles.metaText}>{timeAgo(space._creationTime)}</Text>
                    </View>
                    <View style={styles.meta}>
                      <SymbolView
                        name="square.stack"
                        size={16}
                        tintColor={theme.colors.muted}
                      />
                      <Text style={styles.metaText}>{space.itemCount}</Text>
                    </View>
                  </View>

                  <Text style={styles.title} numberOfLines={1}>
                    {space.name}
                  </Text>
                  {space.description ? (
                    <Text style={styles.subtitle} numberOfLines={1}>
                      {space.description}
                    </Text>
                  ) : null}

                  <View style={styles.covers}>
                    {previews.length > 0 ? (
                      previews.map((preview, i) => (
                        <Image
                          key={preview.url}
                          source={{ uri: preview.url }}
                          style={[
                            styles.cover,
                            {
                              aspectRatio: clampRatio(
                                preview.aspectRatio,
                                preview.type === 'link' ? OG_RATIO : 1,
                              ),
                            },
                            coverTransform(i, previews.length),
                          ]}
                        />
                      ))
                    ) : (
                      <View style={[styles.cover, styles.coverPlaceholder]}>
                        <Text style={styles.coverEmoji}>✶</Text>
                      </View>
                    )}
                  </View>
                </View>
              </Link.Trigger>
              <Link.Preview />
            </Link>
          </Animated.View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
  },
  content: {
    padding: theme.gap(2),
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The visible group panel. Styling lives on this outer view (not the inner
  // Pressable) so it always paints regardless of how Link.Trigger clones its
  // child. overflow:hidden clips the covers that bleed past the bottom edge.
  card: {
    marginBottom: theme.gap(2),
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  cardInner: {
    // paddingTop: theme.gap(1.5),
    // paddingHorizontal: theme.gap(1.5),
    // No paddingBottom: the covers bleed to the bottom edge and get clipped.
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.gap(2),
    paddingTop: theme.gap(2),
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontFamily: theme.fonts.bold,
    fontSize: 12,
    color: theme.colors.foreground,
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 18,
    color: theme.colors.foreground,
    textAlign: 'center',
    // marginTop: theme.gap(1),
  },
  subtitle: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: 3,
  },
  // Visible band for the fanned covers; taller covers spill below and are
  // clipped by the card's rounded bottom edge (card has overflow: hidden).
  covers: {
    height: 104,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginTop: theme.gap(1.5),
  },
  cover: {
    width: 96,
    borderRadius: theme.radius.sm,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surfaceMuted,
    boxShadow: `0 6px 14px rgba(0,0,0,0.22), inset 0 0 0 1px ${theme.colors.imageBorder}`,
  },
  coverPlaceholder: {
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  coverEmoji: {
    fontSize: 34,
  },
}));
