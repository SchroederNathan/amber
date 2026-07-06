import { EmptyState } from '@/components/empty-state';
import { MasonryFeed } from '@/components/masonry-feed';
import { api } from '@convex/_generated/api';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { ProgressiveBlurHeader } from 'progressive-blur';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function SearchScreen() {
  const [search, setSearch] = useState('');
  const query = useDebounced(search.trim(), 250);

  const { data: results } = useQuery(convexQuery(api.items.searchItems, { query }));

  return (
    <View style={styles.container}>
      <Stack.SearchBar
        placeholder="Search your saves"
        autoCapitalize="none"
        hideWhenScrolling={false}
        onChangeText={(e) => setSearch(e.nativeEvent.text)}
        onCancelButtonPress={() => setSearch('')}
      />
      {query.length === 0 ? (
        <EmptyState
          title="Find anything"
          message={'Search goes through titles, tags, and\ndescriptions Amber wrote for your saves.'}
        />
      ) : results && results.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          message={`No saves match “${query}”.`}
        />
      ) : (
        <MasonryFeed items={results ?? []} source={{ from: 'search', q: query }} />
      )}
      <ProgressiveBlurHeader />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
  },
}));
