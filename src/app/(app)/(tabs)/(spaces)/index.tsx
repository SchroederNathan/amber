import { EmptyState } from '@/components/empty-state';
import { api } from '@convex/_generated/api';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

export default function SpacesScreen() {
  const spaces = useQuery(api.spaces.listSpaces);

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
      numColumns={2}
      keyExtractor={(space) => space._id}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      renderItem={({ item: space, index }) => (
        <Animated.View
          style={styles.cell}
          entering={FadeInDown.delay(index * 60).duration(350)}
        >
          <Link href={`/space/${space._id}`} asChild>
            <Link.Trigger>
              <Pressable style={({ pressed }) => [styles.spaceCard, pressed && { opacity: 0.85 }]}>
                <View style={styles.previewRow}>
                  {space.previewImageUrls.length > 0 ? (
                    space.previewImageUrls.map((url, i) => (
                      <Image key={i} source={{ uri: url }} style={styles.previewImage} />
                    ))
                  ) : (
                    <View style={[styles.previewImage, styles.previewPlaceholder]}>
                      <Text style={styles.previewEmoji}>{space.emoji ?? '✶'}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.spaceMeta}>
                  <Text style={styles.spaceName} numberOfLines={1}>
                    {space.emoji ? `${space.emoji}  ${space.name}` : space.name}
                  </Text>
                  <Text style={styles.spaceCount}>
                    {space.itemCount === 1 ? '1 save' : `${space.itemCount} saves`}
                  </Text>
                </View>
              </Pressable>
            </Link.Trigger>
            <Link.Preview />
          </Link>
        </Animated.View>
      )}
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.gap(1.5),
  },
  cell: {
    flex: 1,
    padding: theme.gap(0.5),
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  spaceCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.gap(1),
    gap: theme.gap(1),
  },
  previewRow: {
    flexDirection: 'row',
    gap: 6,
  },
  previewImage: {
    flex: 1,
    aspectRatio: 1.4,
    borderRadius: theme.radius.sm,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surfaceMuted,
  },
  previewPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  previewEmoji: {
    fontSize: 28,
  },
  spaceMeta: {
    paddingHorizontal: theme.gap(0.5),
    paddingBottom: theme.gap(0.5),
    gap: 2,
  },
  spaceName: {
    fontFamily: theme.fonts.bold,
    fontSize: 17,
    color: theme.colors.foreground,
  },
  spaceCount: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.muted,
  },
}));
