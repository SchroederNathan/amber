import { FlashList } from '@shopify/flash-list';
import { ItemCard, type FeedItem } from './item-card';

type Props = {
  items: FeedItem[];
  numColumns?: number;
  ListEmptyComponent?: React.ComponentType | React.ReactElement;
  ListHeaderComponent?: React.ComponentType | React.ReactElement;
};

export function MasonryFeed({ items, numColumns = 3, ListEmptyComponent, ListHeaderComponent }: Props) {
  return (
    <FlashList
      data={items}
      masonry
      numColumns={numColumns}
      optimizeItemArrangement
      keyExtractor={(item) => item._id}
      renderItem={({ item }) => <ItemCard item={item} />}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingHorizontal: 9, paddingVertical: 9 }}
      ListEmptyComponent={ListEmptyComponent}
      ListHeaderComponent={ListHeaderComponent}
    />
  );
}
