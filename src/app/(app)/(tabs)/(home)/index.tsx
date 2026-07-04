import { EmptyState } from '@/components/empty-state';
import { MasonryFeed } from '@/components/masonry-feed';
import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';
import { ActivityIndicator, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export default function HomeScreen() {
  const items = useQuery(api.items.listItems);

  if (items === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MasonryFeed
        items={items}
        numColumns={2}
        ListEmptyComponent={
          <EmptyState
            icon="sparkles"
            title="Save it for later"
            message={'Tap + to drop in a link, a photo, or a stray thought.\nAmber keeps it warm until you need it.'}
          />
        }
      />
    </View>
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
