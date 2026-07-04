import { EmptyState } from '@/components/empty-state';
import { MasonryFeed } from '@/components/masonry-feed';
import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';
import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
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
  const navigation = useNavigation();
  const [search, setSearch] = useState('');
  const query = useDebounced(search.trim(), 250);

  useEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: {
        placeholder: 'Search your saves',
        autoCapitalize: 'none',
        hideWhenScrolling: false,
        onChangeText: (e: { nativeEvent: { text: string } }) =>
          setSearch(e.nativeEvent.text),
        onCancelButtonPress: () => setSearch(''),
      },
    });
  }, [navigation]);

  const results = useQuery(api.items.searchItems, { query });

  return (
    <View style={styles.container}>
      {query.length === 0 ? (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.emptyContent}
        >
          <EmptyState
            title="Find anything"
            message={'Search goes through titles, tags, and\ndescriptions Amber wrote for your saves.'}
          />
        </ScrollView>
      ) : results && results.length === 0 ? (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.emptyContent}
        >
          <EmptyState
            title="Nothing yet"
            message={`No saves match “${query}”.`}
          />
        </ScrollView>
      ) : (
        <MasonryFeed items={results ?? []} />
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  emptyContent: {
    flexGrow: 1,
  },
}));
