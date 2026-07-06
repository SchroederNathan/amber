import { TagChip } from '@/components/tag-chip';
import { displayHost } from '@/lib/url';
import { convexQuery } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useHeaderHeight } from 'expo-router/build/react-navigation';
import { SymbolView } from 'expo-symbols';
import * as WebBrowser from 'expo-web-browser';
import type { FunctionReturnType } from 'convex/server';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

// A row as returned by the list queries (listItems / searchItems / getSpace) —
// carries every display field except the space memberships, which only
// getItem resolves.
export type DetailItem = FunctionReturnType<typeof api.items.listItems>[number];

type Props = {
  item: DetailItem;
  // Only the page matching the pushed id owns the Apple-zoom transition target;
  // pairing more than one target with a single push confuses the animation.
  isZoomTarget: boolean;
};

export function ItemDetail({ item, isZoomTarget }: Props) {
  const headerHeight = useHeaderHeight();
  const { theme } = useUnistyles();

  // The list row already has everything but the item's spaces; fetch those
  // separately (cached and cheap) so the space chips can appear. Everything
  // else renders instantly from `item`, so swiping never shows a spinner.
  const { data: withSpaces } = useQuery(
    convexQuery(api.items.getItem, { id: item._id }),
  );
  const spaces = withSpaces?.spaces ?? [];

  const heroUri = item.imageUrl ?? item.heroImageUrl;

  const paragraphs =
    item.content
      ?.split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0) ?? [];

  const hero = heroUri ? (
    <Image
      source={{ uri: heroUri }}
      contentFit={item.isSticker ? 'contain' : 'cover'}
      style={[
        item.isSticker ? styles.hero : styles.heroImage,
        // Match the source shape; OG images default to 1200×630 (≈1.91).
        { aspectRatio: item.aspectRatio ?? (item.type === 'link' ? 1.91 : 1.4) },
      ]}
    />
  ) : null;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      style={[styles.container, { paddingTop: headerHeight + theme.gap(5) }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {heroUri ? (
        <View style={!item.isSticker && styles.heroContainer}>
          {isZoomTarget ? <Link.AppleZoomTarget>{hero}</Link.AppleZoomTarget> : hero}
        </View>
      ) : null}

      <View
        style={[
          styles.body,
          // Without a hero to sit under, the text needs to clear the notch and
          // the floating controls.
          { paddingTop: heroUri ? theme.gap(5) : headerHeight + theme.gap(5) },
        ]}
      >
        {item.status === 'processing' ? (
          <View style={styles.processingRow}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.processingText}>Amber is reading this…</Text>
          </View>
        ) : null}

        <View style={styles.titleContainer}>
          <Text style={styles.title}>
            {item.title ?? item.note ?? displayHost(item.url)}
          </Text>
          {item.url ? (
            <Pressable
              style={styles.sourceRow}
              onPress={() => WebBrowser.openBrowserAsync(item.url!)}
            >
              <SymbolView name="safari" size={15} tintColor={theme.colors.muted} />
              <Text style={styles.sourceText}>
                {item.siteName ?? displayHost(item.url)}
              </Text>
              <SymbolView
                name="arrow.up.right"
                size={11}
                tintColor={theme.colors.faint}
              />
            </Pressable>
          ) : null}
        </View>

        {item.description ? (
          <Text style={styles.description}>{item.description}</Text>
        ) : null}

        {item.tags.length > 0 ? (
          <View style={styles.chipsRow}>
            {item.tags.map((tag) => (
              <TagChip key={tag} label={tag} />
            ))}
          </View>
        ) : null}

        {spaces.length > 0 ? (
          <View style={styles.chipsRow}>
            {spaces.map((space) => (
              <Link key={space._id} href={`/space/${space._id}`} asChild>
                <Pressable>
                  <TagChip emphasized label={space.name} />
                </Pressable>
              </Link>
            ))}
          </View>
        ) : null}

        {item.type === 'note' && item.note && item.title ? (
          <Text selectable style={styles.paragraph}>
            {item.note}
          </Text>
        ) : null}

        {paragraphs.length > 0 ? (
          <View style={styles.article}>
            {paragraphs.map((paragraph, index) => (
              <Text selectable key={index} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingBottom: theme.gap(6),
  },
  hero: {
    width: '100%',
    // Full-bleed so the card image (a die-cut sticker) zooms edge-to-edge.
  },
  // Non-sticker heroes get the same white matted frame as the home cards, so
  // the padded look carries through the Apple zoom into this screen.
  heroContainer: {
    backgroundColor: 'white',
    marginHorizontal: theme.gap(2),
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    padding: theme.gap(1),
    boxShadow: `0 0 4px 0 ${theme.colors.imageBorder}`,
  },
  heroImage: {
    width: '100%',
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surfaceMuted,
  },
  body: {
    gap: theme.gap(5),
    paddingHorizontal: theme.gap(2),
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1),
  },
  processingText: {
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    color: theme.colors.primaryText,
  },
  titleContainer: {
    gap: theme.gap(1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: 32,
    textAlign: 'center',
    color: theme.colors.foreground,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourceText: {
    fontFamily: theme.fonts.medium,
    fontSize: 14,
    color: theme.colors.muted,
  },
  description: {
    fontFamily: theme.fonts.medium,
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
    color: theme.colors.muted,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(0.75),
    justifyContent: 'center',
  },
  article: {
    gap: theme.gap(1.5),
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.gap(2),
  },
  paragraph: {
    fontFamily: theme.fonts.regular,
    fontSize: 16,
    lineHeight: 25,
    color: theme.colors.foreground,
  },
}));
