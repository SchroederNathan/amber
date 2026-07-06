import { EmptyState } from '@/components/empty-state';
import { MasonryFeed } from '@/components/masonry-feed';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMutation } from 'convex/react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ProgressiveBlurHeader } from 'progressive-blur';
import { ActivityIndicator, Alert, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export default function SpaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useUnistyles();
  const { data: space } = useQuery(
    convexQuery(api.spaces.getSpace, { id: id as Id<'spaces'> }),
  );
  const deleteSpace = useMutation(api.spaces.deleteSpace);

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

  return (
    <>
      <Stack.Screen
        options={{
          title: space.name,
          headerTitleStyle: {
            fontFamily: theme.fonts.display,
            color: theme.colors.foreground,
          },
          unstable_headerRightItems: () => [
            {
              type: 'button',
              label: 'Delete',
              icon: { type: 'sfSymbol', name: 'trash' } as const,
              tintColor: theme.colors.danger,
              onPress: confirmDelete,
            },
          ],
        }}
      />
      <View style={styles.container}>
        <MasonryFeed
          items={space.items}
          source={{ from: 'space', spaceId: id }}
          firstItemZoomTarget
          ListEmptyComponent={
            <EmptyState
              title="Nothing filed yet"
              message={'When you save something that fits this space,\nAmber will shelve it here automatically.'}
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
}));
