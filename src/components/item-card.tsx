import { displayHost } from '@/lib/url';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActionSheetIOS, ActivityIndicator, Pressable, Share, Text, View } from 'react-native';
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

// Standard OpenGraph image shape (1200×630) — the default when a link's real
// hero dimensions weren't captured.
const OG_RATIO = 1.91;

function clampRatio(ratio: number | undefined, fallback: number) {
  const value = ratio && !Number.isNaN(ratio) ? ratio : fallback;
  // Preserve the true aspect ratio so previews aren't cropped; only bound
  // pathological extremes so one very tall/wide image can't hijack a column.
  return Math.min(Math.max(value, 0.5), 2);
}

export function ItemCard({ item }: { item: FeedItem }) {
  const { theme } = useUnistyles();
  const deleteItem = useMutation(api.items.deleteItem);

  const imageUri = item.imageUrl ?? item.heroImageUrl;
  const captionTitle = item.title ?? item.note ?? (item.url ? displayHost(item.url) : undefined);

  const openMenu = () => {
    const options = item.url ? ['Share', 'Delete', 'Cancel'] : ['Delete', 'Cancel'];
    const destructiveButtonIndex = item.url ? 1 : 0;
    const cancelButtonIndex = options.length - 1;
    ActionSheetIOS.showActionSheetWithOptions(
      { options, destructiveButtonIndex, cancelButtonIndex },
      (index) => {
        if (item.url && index === 0) Share.share({ url: item.url });
        else if (index === destructiveButtonIndex) deleteItem({ id: item._id });
      },
    );
  };

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.cell}>
      <Link href={`/item/${item._id}`} asChild>
        <Link.Trigger withAppleZoom>
          <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                recyclingKey={item._id}
                transition={200}
                style={[
                  styles.image,
                  { aspectRatio: clampRatio(item.aspectRatio, item.type === 'link' ? OG_RATIO : 1) },
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

            <View style={styles.caption}>
              <Text style={styles.captionTitle} numberOfLines={1}>
                {captionTitle}
              </Text>
              <Pressable hitSlop={10} onPress={openMenu} style={styles.menuButton}>
                <SymbolView name="ellipsis" size={15} tintColor={theme.colors.muted} />
              </Pressable>
            </View>

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
    padding: 4,
  },
  card: {
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surfaceMuted,
  },
  textFace: {
    padding: theme.gap(1.5),
    minHeight: 96,
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surfaceMuted,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(0.5),
    paddingHorizontal: theme.gap(0.5),
    paddingTop: theme.gap(0.75),
  },
  captionTitle: {
    flex: 1,
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.foreground,
  },
  menuButton: {
    alignItems: 'center',
    justifyContent: 'center',
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
