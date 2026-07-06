import { FlashList } from '@shopify/flash-list';
import { ItemCard, type FeedItem, type ItemSource } from './item-card';

type Props = {
  items: FeedItem[];
  numColumns?: number;
  source?: ItemSource;
  ListEmptyComponent?: React.ComponentType | React.ReactElement;
  ListHeaderComponent?: React.ComponentType | React.ReactElement;
};

export function MasonryFeed({ items, numColumns = 2, source, ListEmptyComponent, ListHeaderComponent }: Props) {
  return (
    <FlashList
      data={items}
      masonry
      numColumns={numColumns}
      optimizeItemArrangement
      keyExtractor={(item) => item._id}
      renderItem={({ item }) => <ItemCard item={item} source={source} />}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingHorizontal: 0, paddingVertical: 8 }}
      ListEmptyComponent={ListEmptyComponent}
      ListHeaderComponent={ListHeaderComponent}
    />
  );
}
