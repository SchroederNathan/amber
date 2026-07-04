import { EmptyState } from '@/components/empty-state';
import { TagChip } from '@/components/tag-chip';
import { displayHost } from '@/lib/url';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMutation } from 'convex/react';
import { Image } from 'expo-image';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import * as WebBrowser from 'expo-web-browser';
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
  const paragraphs =
    item.content
      ?.split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0) ?? [];

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          // Native transparent header: the back button and toolbar items pick
          // up the system liquid-glass treatment on iOS 26 for free.
          headerShown: true,
          headerTitle: '',
          headerBackButtonDisplayMode: 'minimal',
          headerRight: () => (
            <View style={styles.headerActions}>
              {item.url ? (
                <Pressable hitSlop={8} onPress={() => Share.share({ url: item.url! })}>
                  <SymbolView
                    name="square.and.arrow.up"
                    size={20}
                    tintColor={theme.colors.primary}
                  />
                </Pressable>
              ) : null}
              <Pressable
                hitSlop={8}
                onPress={async () => {
                  router.back();
                  await deleteItem({ id: item._id });
                }}
              >
                <SymbolView name="trash" size={20} tintColor={theme.colors.primary} />
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {heroUri ? (
          <Link.AppleZoomTarget>
            <Image
              source={{ uri: heroUri }}
              style={[
                styles.hero,
                // Match the source shape; OG images default to 1200×630 (≈1.91).
                { aspectRatio: item.aspectRatio ?? (item.type === 'link' ? 1.91 : 1.4) },
              ]}
              transition={200}
            />
          </Link.AppleZoomTarget>
        ) : null}

        <View
          style={[
            styles.body,
            // Without a native header the text needs to clear the notch and
            // the floating controls when there's no hero to sit under.
            { paddingTop: heroUri ? theme.gap(2) : insets.top + 52 },
          ]}
        >
          {item.status === 'processing' ? (
            <View style={styles.processingRow}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.processingText}>Amber is reading this…</Text>
            </View>
          ) : null}

          <Text selectable style={styles.title}>
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

          {item.description ? (
            <Text selectable style={styles.description}>
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
                    <TagChip
                      emphasized
                      label={space.emoji ? `${space.emoji} ${space.name}` : space.name}
                    />
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
    // Full-bleed so the card image zooms edge-to-edge into place.

  },
  body: {
    gap: theme.gap(1.5),
    paddingHorizontal: theme.gap(2),
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
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
  title: {
    fontFamily: theme.fonts.display,
    fontSize: 28,
    lineHeight: 34,
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
    color: theme.colors.muted,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(0.75),
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
