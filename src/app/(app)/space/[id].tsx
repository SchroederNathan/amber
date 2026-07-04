import { EmptyState } from '@/components/empty-state';
import { MasonryFeed } from '@/components/masonry-feed';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export default function SpaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useUnistyles();
  const space = useQuery(api.spaces.getSpace, { id: id as Id<'spaces'> });
  const deleteSpace = useMutation(api.spaces.deleteSpace);

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
          title: space.emoji ? `${space.emoji} ${space.name}` : space.name,
          headerTitleStyle: {
            fontFamily: theme.fonts.display,
            color: theme.colors.foreground,
          },
          headerRight: () => (
            <Pressable hitSlop={8} onPress={confirmDelete}>
              <SymbolView name="trash" size={19} tintColor={theme.colors.danger} />
            </Pressable>
          ),
        }}
      />
      <View style={styles.container}>
        <MasonryFeed
          items={space.items}
          ListEmptyComponent={
            <EmptyState
              title="Nothing filed yet"
              message={'When you save something that fits this space,\nAmber will shelve it here automatically.'}
            />
          }
        />
      </View>
    </>
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
}));
