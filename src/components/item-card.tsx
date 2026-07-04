import { displayHost } from '@/lib/url';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, Share, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export type FeedItem = {
  _id: Id<'items'>;
  type: 'image' | 'link' | 'note';
  status: 'processing' | 'ready' | 'failed';
  title?: string;
  url?: string;
  siteName?: string;
  note?: string;
  imageUrl?: string | null;
  heroImageUrl?: string;
  aspectRatio?: number;
  tags: string[];
};

function clampRatio(ratio: number | undefined, fallback: number) {
  if (!ratio || Number.isNaN(ratio)) return fallback;
  return Math.min(Math.max(ratio, 0.6), 1.5);
}

export function ItemCard({ item }: { item: FeedItem }) {
  const { theme } = useUnistyles();
  const deleteItem = useMutation(api.items.deleteItem);

  const imageUri = item.imageUrl ?? item.heroImageUrl;

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.cell}>
      <Link href={`/item/${item._id}`} asChild>
        <Link.Trigger>
          <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                recyclingKey={item._id}
                transition={200}
                style={[
                  styles.image,
                  { aspectRatio: clampRatio(item.aspectRatio, item.type === 'link' ? 1.25 : 1) },
                ]}
              />
            ) : (
              <View style={[styles.textFace, item.type === 'note' && styles.noteFace]}>
                {item.type === 'link' && (
                  <SymbolView
                    name="link"
                    size={13}
                    tintColor={theme.colors.faint}
                    style={{ marginBottom: 6 }}
                  />
                )}
                <Text style={styles.textFaceTitle} numberOfLines={5}>
                  {item.title ?? item.note ?? displayHost(item.url)}
                </Text>
              </View>
            )}

            {item.type === 'link' && (
              <View style={styles.caption}>
                <Text style={styles.captionTitle} numberOfLines={2}>
                  {item.title ?? displayHost(item.url)}
                </Text>
                <Text style={styles.captionHost} numberOfLines={1}>
                  {item.siteName ?? displayHost(item.url)}
                </Text>
              </View>
            )}

            {item.status === 'processing' && (
              <View style={styles.processing}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            )}
          </Pressable>
        </Link.Trigger>
        <Link.Preview />
        <Link.Menu>
          {item.url ? (
            <Link.MenuAction
              title="Share"
              icon="square.and.arrow.up"
              onPress={() => Share.share({ url: item.url! })}
            />
          ) : null}
          <Link.MenuAction
            title="Delete"
            icon="trash"
            destructive
            onPress={() => deleteItem({ id: item._id })}
          />
        </Link.Menu>
      </Link>
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  cell: {
    padding: 3,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  image: {
    width: '100%',
    backgroundColor: theme.colors.surfaceMuted,
  },
  textFace: {
    padding: theme.gap(1.5),
    minHeight: 96,
    justifyContent: 'center',
  },
  noteFace: {
    backgroundColor: theme.colors.primarySoft,
  },
  textFaceTitle: {
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.foreground,
  },
  caption: {
    paddingHorizontal: theme.gap(1),
    paddingVertical: theme.gap(1),
    gap: 2,
  },
  captionTitle: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.foreground,
  },
  captionHost: {
    fontFamily: theme.fonts.regular,
    fontSize: 10,
    color: theme.colors.muted,
  },
  processing: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: 50,
    padding: 5,
    boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
  },
}));
