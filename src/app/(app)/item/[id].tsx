import { EmptyState } from '@/components/empty-state';
import { TagChip } from '@/components/tag-chip';
import { Wordmark } from '@/components/wordmark';
import { displayHost } from '@/lib/url';
import { convexQuery } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useQuery } from '@tanstack/react-query';
import { useMutation } from 'convex/react';
import { File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useHeaderHeight } from 'expo-router/build/react-navigation';
import { SymbolView } from 'expo-symbols';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useUnistyles();
  const { data: item } = useQuery(
    convexQuery(api.items.getItem, { id: id as Id<'items'> }),
  );
  const deleteItem = useMutation(api.items.deleteItem);

  // `undefined` = loading (nothing cached yet); `null` = not found.
  if (item === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  if (item === null) {
    return (
      <View style={styles.loading}>
        <EmptyState title="Gone" message="This save no longer exists." />
      </View>
    );
  }

  const heroUri = item.imageUrl ?? item.heroImageUrl;

  // A link shares its URL; a saved image/sticker shares the picture itself.
  // `expo-sharing` needs a local file, so the remote image is cached first.
  const shareImage = async () => {
    if (!item.imageUrl) return;
    try {
      if (!(await Sharing.isAvailableAsync())) {
        if (item.url) await Share.share({ url: item.url });
        return;
      }
      const ext = item.isSticker ? 'png' : 'jpg';
      const file = new File(Paths.cache, `${item._id}.${ext}`);
      if (file.exists) file.delete();
      await File.downloadFileAsync(item.imageUrl, file);
      await Sharing.shareAsync(file.uri, {
        mimeType: item.isSticker ? 'image/png' : 'image/jpeg',
        UTI: item.isSticker ? 'public.png' : 'public.jpeg',
        dialogTitle: item.title ?? 'Share',
      });
    } catch {
      // User cancelled the sheet, or the download/share failed — nothing to do.
    }
  };

  const onShare = item.imageUrl
    ? shareImage
    : () => Share.share({ url: item.url! });

  const paragraphs =
    item.content
      ?.split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0) ?? [];

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: () => <Wordmark />,
          headerBackButtonDisplayMode: 'minimal',
          unstable_headerRightItems: () => [
            ...(item.imageUrl || item.url
              ? [
                  {
                    type: 'button' as const,
                    label: 'Share',
                    icon: { type: 'sfSymbol', name: 'square.and.arrow.up' } as const,
                    tintColor: theme.colors.primary,
                    onPress: onShare,
                  },
                ]
              : []),
            {
              type: 'button' as const,
              label: 'Delete',
              icon: { type: 'sfSymbol', name: 'trash' } as const,
              tintColor: theme.colors.primary,
              onPress: async () => {
                router.back();
                await deleteItem({ id: item._id });
              },
            },
          ],
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        style={[styles.container, { paddingTop: headerHeight + theme.gap(5) }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {heroUri ? (
          <View style={!item.isSticker && styles.heroContainer}>
            <Link.AppleZoomTarget>
              <Image
                source={{ uri: heroUri }}
                contentFit={item.isSticker ? 'contain' : 'cover'}
                style={[
                  item.isSticker ? styles.hero : styles.heroImage,
                  // Match the source shape; OG images default to 1200×630 (≈1.91).
                  { aspectRatio: item.aspectRatio ?? (item.type === 'link' ? 1.91 : 1.4) },
                ]}
                // transition={200}
              />
            </Link.AppleZoomTarget>
          </View>
        ) : null}

        <View
          style={[
            styles.body,
            // Without a native header the text needs to clear the notch and
            // the floating controls when there's no hero to sit under.
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
            <Text style={styles.description}>
              {item.description}
            </Text>
          ) : null}

          {item.tags.length > 0 ? (
            <View style={styles.chipsRow}>
              {item.tags.map((tag) => (
                <TagChip key={tag} label={tag} />
              ))}
            </View>
          ) : null}

          {item.spaces.length > 0 ? (
            <View style={styles.chipsRow}>
              {item.spaces.map((space) => (
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
    </View>
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
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
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
