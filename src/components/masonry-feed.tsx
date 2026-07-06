import { FlashList } from '@shopify/flash-list';
import { Link } from 'expo-router';
import { ItemCard, type FeedItem, type ItemSource } from './item-card';

type Props = {
  items: FeedItem[];
  numColumns?: number;
  source?: ItemSource;
  // Marks the first item (top-left) as the Apple-zoom landing target, so a
  // withAppleZoom link that pushed this screen zooms into where the feed begins.
  firstItemZoomTarget?: boolean;
  ListEmptyComponent?: React.ComponentType | React.ReactElement;
  ListHeaderComponent?: React.ComponentType | React.ReactElement;
};

export function MasonryFeed({ items, numColumns = 2, source, firstItemZoomTarget, ListEmptyComponent, ListHeaderComponent }: Props) {
  return (
    <FlashList
      data={items}
      masonry
      numColumns={numColumns}
      optimizeItemArrangement
      keyExtractor={(item) => item._id}
      renderItem={({ item, index }) =>
        firstItemZoomTarget && index === 0 ? (
          <Link.AppleZoomTarget>
            <ItemCard item={item} source={source} />
          </Link.AppleZoomTarget>
        ) : (
          <ItemCard item={item} source={source} />
        )
      }
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingHorizontal: 0, paddingVertical: 8 }}
      ListEmptyComponent={ListEmptyComponent}
      ListHeaderComponent={ListHeaderComponent}
    />
  );
}
